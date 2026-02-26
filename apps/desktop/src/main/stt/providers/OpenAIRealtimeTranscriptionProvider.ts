import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import { getLogger } from '@neo/logger';
import type { STTFinalEvent, STTPartialEvent, STTStatus } from '@neo/shared';
import type {
  LiveTranscriptionError,
  LiveTranscriptionProvider,
  LiveTranscriptionProviderConfig,
} from './LiveTranscriptionProvider';
import { PcmChunker } from './PcmChunker';

const logger = getLogger();

export class OpenAIRealtimeTranscriptionProvider implements LiveTranscriptionProvider {
  id = 'openai_realtime_transcribe' as const;
  private emitter = new EventEmitter();
  private ws: WebSocket | null = null;
  private config: LiveTranscriptionProviderConfig | null = null;
  private chunker: PcmChunker | null = null;
  private closing = false;
  private reconnectAttempts = 0;
  private partialBuffer = '';
  private firstAudioAt: number | null = null;
  private firstPartialAt: number | null = null;
  private readyPromise: Promise<void> | null = null;
  private readyResolve: (() => void) | null = null;
  private audioBytesSent = 0;
  private audioFramesSent = 0;
  private finalizePromise: Promise<void> | null = null;
  private finalizeResolve: (() => void) | null = null;
  private sessionReady = false;
  private audioBytesReceived = 0;
  private audioChunksReceived = 0;
  private useServerVad = true;
  private unhandledEventCount = 0;

  async start(config: LiveTranscriptionProviderConfig): Promise<void> {
    if (this.ws) return;
    if (!config.apiKey) {
      throw new Error('Chave OpenAI nao encontrada');
    }
    // Voice agents guide: https://platform.openai.com/docs/guides/voice-agents
    this.config = config;
    this.chunker = new PcmChunker(config.sampleRate, 20);
    this.closing = false;
    this.reconnectAttempts = 0;
    this.partialBuffer = '';
    this.firstAudioAt = null;
    this.firstPartialAt = null;
    this.audioBytesSent = 0;
    this.audioFramesSent = 0;
    this.sessionReady = false;
    this.audioBytesReceived = 0;
    this.audioChunksReceived = 0;
    this.readyPromise = new Promise<void>((resolve) => {
      this.readyResolve = resolve;
    });
    this.finalizePromise = null;
    this.finalizeResolve = null;

    this.connect();
    // Aguarda a sessão ser confirmada pelo servidor antes de aceitar áudio.
    await Promise.race([
      this.readyPromise,
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error('OpenAI realtime: timeout ao iniciar')), 8000)),
    ]);
  }

  pushAudio(chunk: Buffer): void {
    // Importante: se o WS ainda não estiver pronto, descartamos (ou poderíamos bufferizar).
    // Como o controller só começa o áudio após start() resolver, isso não deve acontecer.
    this.audioBytesReceived += chunk.length;
    this.audioChunksReceived += 1;
    if (this.audioChunksReceived === 1) {
      logger.info(
        { bytes: chunk.length, sampleRate: this.config?.sampleRate ?? 16000 },
        'OpenAI realtime: first audio chunk received'
      );
      this.emitDebug(`openai:first_chunk bytes=${chunk.length}`);
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.chunker) return;
    if (!this.firstAudioAt) {
      this.firstAudioAt = Date.now();
    }
    this.chunker.push(chunk, (frame) => this.sendAudioFrame(frame));
  }

  async stop(): Promise<void> {
    this.closing = true;
    this.emitStatus({ state: 'finalizing', providerId: this.id });
    if (this.chunker && this.partialBuffer) {
      this.emitFinal(this.partialBuffer);
      this.partialBuffer = '';
    }
    this.chunker?.flush((frame) => this.sendAudioFrame(frame));
    // Em modo server_vad, o servidor faz commit automaticamente quando detecta fala.
    // Mandar commit manual aqui pode causar "commit_empty" (buffer já foi commitado/limpo).
    // Então apenas damos um pequeno tempo para eventos finais chegarem e fechamos.
    if (this.useServerVad) {
      await new Promise<void>((resolve) => setTimeout(resolve, 300));
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.emitStatus({ state: 'idle' });
  }

  async dispose(): Promise<void> {
    await this.stop();
  }

  onPartial(cb: (event: STTPartialEvent) => void): () => void {
    this.emitter.on('partial', cb);
    return () => this.emitter.off('partial', cb);
  }

  onFinal(cb: (event: STTFinalEvent) => void): () => void {
    this.emitter.on('final', cb);
    return () => this.emitter.off('final', cb);
  }

  onStatus(cb: (status: STTStatus) => void): () => void {
    this.emitter.on('status', cb);
    return () => this.emitter.off('status', cb);
  }

  onError(cb: (error: LiveTranscriptionError) => void): () => void {
    this.emitter.on('error', cb);
    return () => this.emitter.off('error', cb);
  }

  onDebug(cb: (message: string) => void): () => void {
    this.emitter.on('debug', cb);
    return () => this.emitter.off('debug', cb);
  }

  private connect(): void {
    const config = this.config;
    if (!config?.apiKey) return;
    const modelName = config.modelName || 'gpt-4o-transcribe';
    const url = `wss://api.openai.com/v1/realtime?intent=transcription`;

    const ws = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'OpenAI-Beta': 'realtime=v1',
      },
    });

    this.ws = ws;
    this.emitStatus({ state: 'starting', providerId: this.id });

    ws.on('open', () => {
      // Docs: https://platform.openai.com/docs/api-reference/realtime-beta-client-events
      this.sendSessionUpdate(modelName);
    });

    ws.on('message', (data: unknown) => this.handleMessage(String(data)));
    ws.on('error', (error: unknown) =>
      this.handleSocketError(error instanceof Error ? error : new Error(String(error)))
    );
    ws.on('close', (code: number, reason: Buffer) => this.handleSocketClose(code, reason.toString()));
  }

  private sendSessionUpdate(modelName: string): void {
    // Docs: https://platform.openai.com/docs/guides/speech-to-text
    // Realtime transcription sessions are configured via transcription_session.update,
    // and the transcription model must be provided under input_audio_transcription.model.
    const payload = {
      type: 'transcription_session.update',
      session: {
        input_audio_format: 'pcm16',
        input_audio_transcription: { model: modelName },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
        input_audio_noise_reduction: { type: 'near_field' },
      },
    };
    this.sendJson(payload);
    this.useServerVad = true;
    // Não emitir listening aqui. Só após o servidor confirmar transcription_session.*
  }

  private sendAudioFrame(frame: Buffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (!this.sessionReady) return;
    const audio = frame.toString('base64');
    this.sendJson({ type: 'input_audio_buffer.append', audio });
    if (this.audioFramesSent === 0) {
      const sr = this.config?.sampleRate ?? 16000;
      logger.info({ sampleRate: sr, firstFrameBytes: frame.length }, 'OpenAI realtime: first audio frame sent');
      this.emitDebug(`openai:first_frame bytes=${frame.length} sampleRate=${sr}`);
    }
    this.audioBytesSent += frame.length;
    this.audioFramesSent += 1;
  }

  private handleMessage(raw: string): void {
    let event: any;
    try {
      event = JSON.parse(raw);
    } catch (error) {
      this.emitDebug('openai: invalid json from server');
      return;
    }

    // Log agressivo de todos os eventos para diagnóstico
    if (event?.type) {
      logger.info({ type: event.type }, 'OpenAI realtime: event received');
    }

    if (event?.type === 'error') {
      const message = event?.error?.message || 'Erro no OpenAI Realtime';
      const debug = event?.error?.code || event?.error?.type || undefined;
      // Se estivermos finalizando e o servidor reclamar de commit vazio, ignora (não é fatal).
      if (this.closing && debug === 'input_audio_buffer_commit_empty') {
        this.emitDebug(`openai:ignored_error code=${debug} message=${message}`);
        return;
      }
      this.emitError({ message, debug, providerId: this.id });
      return;
    }

    // Server events: https://platform.openai.com/docs/api-reference/realtime-beta-server-events
    // Newer transcription stream events:
    if (event?.type === 'transcript.text.delta') {
      const delta: string | undefined = event?.delta;
      if (typeof delta === 'string' && delta.length) {
        if (!this.firstPartialAt) {
          this.firstPartialAt = Date.now();
          if (this.firstAudioAt) {
            this.emitDebug(`openai:first_partial_ms=${this.firstPartialAt - this.firstAudioAt}`);
          }
        }
        this.partialBuffer += delta;
        this.emitPartial(this.partialBuffer);
      }
      return;
    }

    if (event?.type === 'transcript.text.done') {
      const text: string | undefined = event?.text || this.partialBuffer;
      if (text && text.trim()) {
        this.emitFinal(text);
      }
      this.partialBuffer = '';
      this.finalizeResolve?.();
      this.finalizeResolve = null;
      return;
    }

    if (event?.type === 'response.audio_transcript.delta') {
      const delta: string | undefined =
        event?.delta || event?.text || event?.transcript || event?.payload?.text;
      if (typeof delta === 'string' && delta.length) {
        if (!this.firstPartialAt) {
          this.firstPartialAt = Date.now();
          if (this.firstAudioAt) {
            this.emitDebug(`openai:first_partial_ms=${this.firstPartialAt - this.firstAudioAt}`);
          }
        }
        this.partialBuffer += delta;
        this.emitPartial(this.partialBuffer);
      }
      return;
    }

    if (event?.type === 'response.audio_transcript.done') {
      const text: string | undefined =
        event?.text || event?.transcript || event?.payload?.text || this.partialBuffer;
      if (text && text.trim()) {
        this.emitFinal(text);
      }
      this.partialBuffer = '';
      this.finalizeResolve?.();
      this.finalizeResolve = null;
      return;
    }

    if (event?.type?.startsWith?.('transcription_session.')) {
      if (!this.sessionReady) {
        this.sessionReady = true;
        this.emitDebug(`openai:session_ready type=${event?.type}`);
        logger.info({ eventType: event?.type }, 'OpenAI realtime: session ready');
        this.readyResolve?.();
        this.readyResolve = null;
      }
      this.emitStatus({ state: 'listening', providerId: this.id, modelId: this.config?.modelName });
      return;
    }

    // Eventos de VAD (voice activity detection)
    if (event?.type === 'input_audio_buffer.speech_started') {
      logger.info({}, 'OpenAI realtime: speech started (VAD)');
      this.emitDebug('openai:speech_started');
      return;
    }

    if (event?.type === 'input_audio_buffer.speech_stopped') {
      logger.info({}, 'OpenAI realtime: speech stopped (VAD)');
      this.emitDebug('openai:speech_stopped');
      return;
    }

    if (event?.type === 'input_audio_buffer.committed') {
      logger.info({ itemId: event?.item_id }, 'OpenAI realtime: audio committed');
      this.emitDebug(`openai:audio_committed item_id=${event?.item_id}`);
      return;
    }

    // Evento de item criado na conversa (indica que o servidor processou algo)
    if (event?.type === 'conversation.item.created') {
      logger.info({ itemId: event?.item?.id, role: event?.item?.role }, 'OpenAI realtime: conversation item created');
      this.emitDebug(`openai:item_created id=${event?.item?.id}`);
      return;
    }

    // Eventos de transcrição completada (formatos alternativos)
    if (event?.type === 'conversation.item.input_audio_transcription.completed') {
      const text = event?.transcript || '';
      logger.info({ text }, 'OpenAI realtime: transcription completed');
      if (text && text.trim()) {
        this.emitFinal(text);
      }
      return;
    }

    // Ajuda de diagnóstico: loga alguns eventos não tratados para descobrir o contrato real do servidor
    if (this.unhandledEventCount < 25 && typeof event?.type === 'string') {
      this.unhandledEventCount += 1;
      logger.info({ type: event.type, keys: Object.keys(event || {}) }, 'OpenAI realtime: unhandled event');
      this.emitDebug(`openai:unhandled_event type=${event.type}`);
    }
  }

  private handleSocketError(error: Error): void {
    if (this.closing) return;
    logger.warn({ err: error }, 'OpenAI realtime socket error');
    this.emitError({ message: 'Falha na conexao OpenAI Realtime', debug: error.message, providerId: this.id });
  }

  private handleSocketClose(code: number, reason: string): void {
    this.ws = null;
    if (this.closing) return;
    if (this.reconnectAttempts < 1) {
      this.reconnectAttempts += 1;
      this.emitDebug(`openai:reconnect_attempt=${this.reconnectAttempts}`);
      setTimeout(() => this.connect(), 400);
      return;
    }
    const debug = `code=${code} reason=${reason}`;
    this.emitError({ message: 'Conexao OpenAI Realtime encerrada', debug, providerId: this.id });
  }

  private sendJson(payload: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify(payload));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao enviar audio';
      this.emitError({ message: 'Falha ao enviar audio para OpenAI', debug: message, providerId: this.id });
    }
  }

  private emitPartial(text: string): void {
    const event: STTPartialEvent = {
      text,
      ts: Date.now(),
      meta: {
        providerId: this.id,
      },
    };
    this.emitter.emit('partial', event);
  }

  private emitFinal(text: string): void {
    if (this.firstAudioAt) {
      this.emitDebug(`openai:final_ms=${Date.now() - this.firstAudioAt}`);
    }
    this.firstAudioAt = null;
    this.firstPartialAt = null;
    const event: STTFinalEvent = {
      text,
      ts: Date.now(),
      meta: {
        providerId: this.id,
      },
    };
    this.emitter.emit('final', event);
  }

  private emitStatus(status: STTStatus): void {
    this.emitter.emit('status', status);
  }

  private emitError(error: LiveTranscriptionError): void {
    this.emitter.emit('error', error);
    this.emitStatus({ state: 'error', message: error.message, providerId: this.id, debug: error.debug });
  }

  private emitDebug(message: string): void {
    this.emitter.emit('debug', message);
  }
}
