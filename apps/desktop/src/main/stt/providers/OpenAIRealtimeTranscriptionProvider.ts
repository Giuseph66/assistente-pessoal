import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import { getLogger } from '@ricky/logger';
import type { STTFinalEvent, STTPartialEvent, STTStatus } from '@ricky/shared';
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

    this.connect();
  }

  pushAudio(chunk: Buffer): void {
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
    this.sendJson({ type: 'input_audio_buffer.commit' });
    this.sendJson({ type: 'response.cancel' });
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
    const url = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(modelName)}`;

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

    ws.on('message', (data) => this.handleMessage(String(data)));
    ws.on('error', (error) => this.handleSocketError(error));
    ws.on('close', (code, reason) => this.handleSocketClose(code, reason.toString()));
  }

  private sendSessionUpdate(modelName: string): void {
    // Docs: https://platform.openai.com/docs/api-reference/realtime-beta-client-events
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
    this.emitStatus({ state: 'listening', providerId: this.id, modelId: modelName });
  }

  private sendAudioFrame(frame: Buffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const audio = frame.toString('base64');
    this.sendJson({ type: 'input_audio_buffer.append', audio });
  }

  private handleMessage(raw: string): void {
    let event: any;
    try {
      event = JSON.parse(raw);
    } catch (error) {
      this.emitDebug('openai: invalid json from server');
      return;
    }

    if (event?.type === 'error') {
      const message = event?.error?.message || 'Erro no OpenAI Realtime';
      const debug = event?.error?.code || event?.error?.type || undefined;
      this.emitError({ message, debug, providerId: this.id });
      return;
    }

    // Server events: https://platform.openai.com/docs/api-reference/realtime-beta-server-events
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
      return;
    }

    if (event?.type?.startsWith?.('transcription_session.')) {
      this.emitStatus({ state: 'listening', providerId: this.id, modelId: this.config?.modelName });
      return;
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
