import { EventEmitter } from 'events';
import { STTFinalEvent, STTPartialEvent, STTStatus } from '@ricky/shared';
import { VoskProvider } from './VoskProvider';
import type {
  LiveTranscriptionError,
  LiveTranscriptionProvider,
  LiveTranscriptionProviderConfig,
} from './LiveTranscriptionProvider';

export class VoskLiveProvider implements LiveTranscriptionProvider {
  id = 'vox' as const;
  private provider: VoskProvider | null = null;
  private emitter = new EventEmitter();

  async start(config: LiveTranscriptionProviderConfig): Promise<void> {
    if (this.provider) return;
    if (!config.modelPath) {
      throw new Error('Caminho do modelo Vosk nao informado');
    }

    this.emitStatus({ state: 'starting', providerId: this.id });

    const provider = new VoskProvider();
    this.provider = provider;

    provider.onPartial((event) => this.emitter.emit('partial', this.attachMeta(event)));
    provider.onFinal((event) => this.emitter.emit('final', this.attachMeta(event)));
    provider.onError((message) => this.emitError({ message, providerId: this.id }));
    provider.onDebug?.((message) => this.emitter.emit('debug', message));

    await provider.start(config, config.modelPath);

    const status = provider.getStatus();
    if (status.state === 'running' || status.state === 'listening') {
      this.emitStatus({
        state: 'listening',
        providerId: this.id,
        modelId: status.modelId,
        language: status.language,
      });
    }
  }

  pushAudio(chunk: Buffer): void {
    this.provider?.feedAudio(chunk);
  }

  async stop(): Promise<void> {
    if (!this.provider) return;
    this.emitStatus({ state: 'finalizing', providerId: this.id });
    await this.provider.stop();
    this.provider = null;
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

  private emitStatus(status: STTStatus): void {
    this.emitter.emit('status', status);
  }

  private emitError(error: LiveTranscriptionError): void {
    this.emitter.emit('error', error);
    this.emitStatus({ state: 'error', message: error.message, providerId: this.id, debug: error.debug });
  }

  private attachMeta<T extends STTPartialEvent | STTFinalEvent>(event: T): T {
    return {
      ...event,
      meta: {
        ...(event.meta || {}),
        providerId: this.id,
      },
    };
  }
}
