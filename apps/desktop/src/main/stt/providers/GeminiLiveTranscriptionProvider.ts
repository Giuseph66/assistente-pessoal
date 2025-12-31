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

export class GeminiLiveTranscriptionProvider implements LiveTranscriptionProvider {
  id = 'gemini_live' as const;
  private emitter = new EventEmitter();
  private ws: WebSocket | null = null;
  private config: LiveTranscriptionProviderConfig | null = null;
  private chunker: PcmChunker | null = null;
  private closing = false;
  private reconnectAttempts = 0;
  private partialBuffer = '';
  private lastPartialEmitted = '';
  private firstAudioAt: number | null = null;
  private firstPartialAt: number | null = null;

  async start(config: LiveTranscriptionProviderConfig): Promise<void> {
    if (this.ws) return;
    if (!config.apiKey) {
      throw new Error('Chave Gemini nao encontrada');
    }
    this.config = config;
    this.chunker = new PcmChunker(config.sampleRate, 20);
    this.closing = false;
    this.reconnectAttempts = 0;
    this.partialBuffer = '';
    this.lastPartialEmitted = '';
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
    this.lastPartialEmitted = '';
    this.chunker?.flush((frame) => this.sendAudioFrame(frame));
    this.sendJson({ realtimeInput: { audioStreamEnd: true } });
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
    const modelName = config.modelName || 'gemini-2.5-flash-native-audio-preview-12-2025';
    const apiVersion = this.resolveApiVersion(modelName);
    // API key auth (Google AI for Developers): https://ai.google.dev/gemini-api/docs/live
    const url =
      `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.${apiVersion}.GenerativeService.BidiGenerateContent` +
      `?key=${encodeURIComponent(config.apiKey)}`;

    const ws = new WebSocket(url);
    this.ws = ws;
    this.emitStatus({ state: 'starting', providerId: this.id });

    ws.on('open', () => {
      // Docs: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/live-api/get-started-websocket
      this.sendSetup(modelName);
    });
    ws.on('message', (data) => this.handleMessage(String(data)));
    ws.on('error', (error) => this.handleSocketError(error));
    ws.on('close', (code, reason) => this.handleSocketClose(code, reason.toString()));
  }

  private sendSetup(modelName: string): void {
    // Docs: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/live-api/get-started-websocket
    const useAudioResponse = this.isAudioModel(modelName);
    const payload = {
      setup: {
        model: `models/${modelName}`,
        generationConfig: {
          responseModalities: [useAudioResponse ? 'AUDIO' : 'TEXT'],
        },
        ...(useAudioResponse ? { inputAudioTranscription: {} } : {}),
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            silenceDurationMs: 500,
            prefixPaddingMs: 300,
            endOfSpeechSensitivity: 'END_SENSITIVITY_UNSPECIFIED',
            startOfSpeechSensitivity: 'START_SENSITIVITY_UNSPECIFIED',
          },
          activityHandling: 'ACTIVITY_HANDLING_UNSPECIFIED',
        },
      },
    };
    this.sendJson(payload);
    this.emitStatus({ state: 'listening', providerId: this.id, modelId: modelName });
  }

  private sendAudioFrame(frame: Buffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const data = frame.toString('base64');
    const sampleRate = this.config?.sampleRate || 16000;
    const payload = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: `audio/pcm;rate=${sampleRate}`,
            data,
          },
        ],
      },
    };
    this.sendJson(payload);
  }

  private handleMessage(raw: string): void {
    let event: any;
    try {
      event = JSON.parse(raw);
    } catch {
      this.logIncomingMessage(raw, null, 'invalid_json');
      this.emitDebug('gemini: invalid json from server');
      return;
    }

    this.logIncomingMessage(raw, event);

    if (event?.error) {
      const message = event?.error?.message || 'Erro no Gemini Live';
      const debug = event?.error?.status || undefined;
      this.emitError({ message, debug, providerId: this.id });
      return;
    }

    const inputTranscription = event?.serverContent?.inputTranscription;
    if (inputTranscription?.text) {
      const text = String(inputTranscription.text || '');
      const finished = Boolean(
        inputTranscription.finished || inputTranscription.isFinal || inputTranscription.final
      );
      if (!this.firstPartialAt) {
        this.firstPartialAt = Date.now();
        if (this.firstAudioAt) {
          this.emitDebug(`gemini:first_partial_ms=${this.firstPartialAt - this.firstAudioAt}`);
        }
      }
      this.partialBuffer = this.mergeStreamingText(this.partialBuffer, text);
      const stableText = this.getStablePartial(this.partialBuffer);
      if (stableText) {
        this.emitPartial(stableText, inputTranscription.languageCode);
      }
      if (finished) {
        this.emitFinal(this.partialBuffer || text, inputTranscription.languageCode);
        this.partialBuffer = '';
        this.lastPartialEmitted = '';
      }
      return;
    }

    if (event?.serverContent?.turnComplete) {
      if (this.partialBuffer) {
        this.emitFinal(this.partialBuffer);
        this.partialBuffer = '';
      }
      this.lastPartialEmitted = '';
      return;
    }
  }

  private handleSocketError(error: Error): void {
    if (this.closing) return;
    logger.warn({ err: error }, 'Gemini live socket error');
    this.emitError({ message: 'Falha na conexao Gemini Live', debug: error.message, providerId: this.id });
  }

  private handleSocketClose(code: number, reason: string): void {
    this.ws = null;
    if (this.closing) return;
    if (this.reconnectAttempts < 1) {
      this.reconnectAttempts += 1;
      this.emitDebug(`gemini:reconnect_attempt=${this.reconnectAttempts}`);
      setTimeout(() => this.connect(), 400);
      return;
    }
    const debug = `code=${code} reason=${reason}`;
    this.emitError({ message: 'Conexao Gemini Live encerrada', debug, providerId: this.id });
  }

  private sendJson(payload: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify(payload));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao enviar audio';
      this.emitError({ message: 'Falha ao enviar audio para Gemini', debug: message, providerId: this.id });
    }
  }

  private emitPartial(text: string, language?: string): void {
    const event: STTPartialEvent = {
      text,
      ts: Date.now(),
      meta: {
        providerId: this.id,
        language,
      },
    };
    this.emitter.emit('partial', event);
  }

  private emitFinal(text: string, language?: string): void {
    if (this.firstAudioAt) {
      this.emitDebug(`gemini:final_ms=${Date.now() - this.firstAudioAt}`);
    }
    this.firstAudioAt = null;
    this.firstPartialAt = null;
    const event: STTFinalEvent = {
      text,
      ts: Date.now(),
      meta: {
        providerId: this.id,
        language,
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

  private logIncomingMessage(raw: string, event: any, parseError?: string): void {
    const rawLength = raw ? raw.length : 0;
    if (!event) {
      logger.info(
        {
          rawLength,
          parseError,
          preview: raw ? raw.slice(0, 200) : '',
        },
        'Gemini live message'
      );
      return;
    }

    const inputText = event?.serverContent?.inputTranscription?.text;
    const outputText = event?.serverContent?.outputTranscription?.text;
    const modelParts = event?.serverContent?.modelTurn?.parts;
    logger.info(
      {
        rawLength,
        type: event?.type,
        hasError: Boolean(event?.error),
        hasServerContent: Boolean(event?.serverContent),
        hasInputTranscription: Boolean(inputText),
        inputTextLen: typeof inputText === 'string' ? inputText.length : 0,
        inputTextPreview: typeof inputText === 'string' ? inputText.slice(0, 120) : '',
        hasOutputTranscription: Boolean(outputText),
        outputTextLen: typeof outputText === 'string' ? outputText.length : 0,
        hasModelTurn: Boolean(event?.serverContent?.modelTurn),
        modelParts: Array.isArray(modelParts) ? modelParts.length : 0,
        turnComplete: Boolean(event?.serverContent?.turnComplete),
        interrupted: Boolean(event?.serverContent?.interrupted),
        hasUsageMetadata: Boolean(event?.usageMetadata),
      },
      'Gemini live message'
    );
  }

  private getStablePartial(text: string): string {
    if (!text) {
      this.lastPartialEmitted = '';
      return '';
    }
    if (!this.lastPartialEmitted) {
      this.lastPartialEmitted = text;
      return text;
    }
    if (text.length >= this.lastPartialEmitted.length) {
      this.lastPartialEmitted = text;
      return text;
    }
    return this.lastPartialEmitted;
  }

  private mergeStreamingText(base: string, next: string): string {
    const incoming = this.normalizeIncomingText(next);
    if (!incoming) return base;
    if (!base) return incoming;
    if (incoming === base) return base;

    if (incoming.startsWith(base)) {
      return incoming;
    }
    if (base.startsWith(incoming)) {
      return base;
    }
    if (base.endsWith(incoming)) {
      return base;
    }

    const overlap = this.findOverlap(base, incoming);
    if (overlap > 0) {
      return base + incoming.slice(overlap);
    }

    if (base.endsWith(' ') || incoming.startsWith(' ')) {
      return base + incoming;
    }

    if (this.isAlphaNumeric(base.slice(-1)) && this.isAlphaNumeric(incoming[0])) {
      return base + incoming;
    }

    return `${base} ${incoming}`;
  }

  private normalizeIncomingText(text: string): string {
    if (!text) return '';
    let cleaned = text.replace(/<noise>/gi, '');
    cleaned = cleaned.replace(/<silence>/gi, '');
    cleaned = cleaned.replace(/\s+/g, ' ');
    if (!cleaned.trim()) return '';
    return cleaned;
  }

  private findOverlap(base: string, next: string): number {
    const max = Math.min(base.length, next.length);
    for (let size = max; size > 0; size -= 1) {
      if (base.slice(-size) === next.slice(0, size)) {
        return size;
      }
    }
    return 0;
  }

  private isAlphaNumeric(char: string | undefined): boolean {
    if (!char) return false;
    return /[\p{L}\p{N}]/u.test(char);
  }

  private isAudioModel(modelName: string): boolean {
    return modelName.includes('native-audio') || modelName.includes('audio');
  }

  private resolveApiVersion(modelName: string): 'v1alpha' | 'v1beta' {
    if (modelName.includes('preview') || modelName.includes('native-audio')) {
      return 'v1alpha';
    }
    return 'v1beta';
  }
}
