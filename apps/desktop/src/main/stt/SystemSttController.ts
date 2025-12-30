import { EventEmitter } from 'events';
import { STTConfig, STTFinalEvent, STTPartialEvent, STTStatus } from '@ricky/shared';
import { getLogger } from '@ricky/logger';
import { VoskProvider } from './providers/VoskProvider';
import { ModelManager } from './models/ModelManager';
import { getConfigStore } from '../storage/configStore';
import { SystemAudioCapture } from '../audio/system/SystemAudioCapture';

const logger = getLogger();

type StartOptions = {
  sourceId: string;
};

export class SystemSttController {
  private status: STTStatus = { state: 'idle' };
  private provider: VoskProvider | null = null;
  private emitter = new EventEmitter();
  private modelManager: ModelManager;
  private configStore = getConfigStore();
  private audioSource: SystemAudioCapture | null = null;
  private level = 0;
  private lastLevelAt = 0;

  constructor(modelManager: ModelManager) {
    this.modelManager = modelManager;
  }

  getStatus(): STTStatus {
    return this.status;
  }

  async start(options: StartOptions): Promise<void> {
    if (this.status.state === 'running' || this.status.state === 'starting') {
      return;
    }
    if (!options.sourceId) {
      const message = 'Selecione um dispositivo de audio do sistema';
      this.setStatus({ state: 'error', message });
      throw new Error(message);
    }

    const storedConfig = this.getConfig();
    const model = this.modelManager.listInstalled().find((item) => item.id === storedConfig.modelId);
    if (!model) {
      const message = 'Nenhum modelo Vosk instalado ou selecionado';
      this.setStatus({ state: 'error', message });
      throw new Error(message);
    }

    const targetSampleRate = model.defaultSampleRate || storedConfig.sampleRate;
    const config: STTConfig =
      targetSampleRate !== storedConfig.sampleRate
        ? { ...storedConfig, sampleRate: targetSampleRate }
        : storedConfig;

    this.setStatus({ state: 'starting' });

    try {
      this.provider = new VoskProvider();
      this.provider.onPartial((event) => this.emitter.emit('partial', event));
      this.provider.onFinal((event) => this.emitter.emit('final', event));
      this.provider.onError((message) => this.handleError(message));
      this.provider.onDebug?.((message) => this.emitter.emit('debug', message));

      await this.provider.start(config, model.installPath);

      this.audioSource = new SystemAudioCapture();
      this.level = 0;
      this.lastLevelAt = 0;
      this.audioSource.onData((chunk) => {
        this.updateLevel(chunk);
        this.provider?.feedAudio(chunk);
      });
      this.audioSource.onError((error) => this.handleError(error.message));
      await this.audioSource.start({ sourceId: options.sourceId, sampleRate: config.sampleRate });

      this.setStatus({ state: 'running', modelId: model.id, language: model.language });
    } catch (error) {
      this.handleError(error instanceof Error ? error.message : 'Falha ao iniciar STT do sistema');
      await this.cleanup();
    }
  }

  async stop(): Promise<void> {
    if (this.status.state === 'idle' || this.status.state === 'stopping') {
      return;
    }

    this.setStatus({ state: 'stopping' });

    await this.cleanup();

    if (this.status.state !== 'error') {
      this.setStatus({ state: 'idle' });
    }
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

  onError(cb: (message: string) => void): () => void {
    this.emitter.on('error', cb);
    return () => this.emitter.off('error', cb);
  }

  onDebug(cb: (message: string) => void): () => void {
    this.emitter.on('debug', cb);
    return () => this.emitter.off('debug', cb);
  }

  onLevel(cb: (payload: { level: number; rms: number; ts: number }) => void): () => void {
    this.emitter.on('level', cb);
    return () => this.emitter.off('level', cb);
  }

  private getConfig(): STTConfig {
    return this.configStore.getConfig();
  }

  private setStatus(status: STTStatus): void {
    this.status = status;
    this.emitter.emit('status', status);
  }

  private handleError(message: string): void {
    logger.error({ message }, 'System STT error');
    this.emitter.emit('error', message);
    this.setStatus({ state: 'error', message });
  }

  private async cleanup(): Promise<void> {
    try {
      await this.audioSource?.stop();
    } catch (error) {
      logger.error({ err: error }, 'Failed to stop system audio capture');
    }

    try {
      await this.provider?.stop();
    } catch (error) {
      logger.error({ err: error }, 'Failed to stop system STT provider');
    }

    this.level = 0;
    this.lastLevelAt = 0;
    this.emitter.emit('level', { level: 0, rms: 0, ts: Date.now() });
    this.audioSource = null;
    this.provider = null;
  }

  private updateLevel(chunk: Buffer): void {
    const now = Date.now();
    if (chunk.length < 2) return;
    let sumSquares = 0;
    const sampleCount = Math.floor(chunk.length / 2);
    for (let i = 0; i < sampleCount; i += 1) {
      const sample = chunk.readInt16LE(i * 2);
      sumSquares += sample * sample;
    }
    const rms = Math.sqrt(sumSquares / sampleCount);
    const target = Math.min(1, rms / 4000);
    this.level = this.level * 0.8 + target * 0.2;

    if (now - this.lastLevelAt >= 50) {
      this.lastLevelAt = now;
      this.emitter.emit('level', { level: this.level, rms, ts: now });
    }
  }
}
