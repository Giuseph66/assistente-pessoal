import { EventEmitter } from 'events';
import { STTConfig, STTFinalEvent, STTPartialEvent, STTStatus } from '@ricky/shared';
import { getLogger } from '@ricky/logger';
import { AudioSource } from './audio/AudioSource';
import { ArecordAudioSource } from './audio/ArecordAudioSource';
import { RendererAudioSource } from './audio/RendererAudioSource';
import { STTProvider } from './providers/STTProvider';
import { VoskProvider } from './providers/VoskProvider';
import { ModelManager } from './models/ModelManager';
import { getConfigStore } from '../storage/configStore';

const logger = getLogger();

export class STTController {
  private status: STTStatus = { state: 'idle' };
  private provider: STTProvider | null = null;
  private audioSource: AudioSource | null = null;
  private emitter = new EventEmitter();
  private modelManager: ModelManager;
  private configStore = getConfigStore();
  private audioBytes = 0;
  private lastAudioAt = 0;
  private audioTimer: NodeJS.Timeout | null = null;
  private level = 0;
  private lastLevelAt = 0;

  constructor(modelManager: ModelManager) {
    this.modelManager = modelManager;
  }

  getStatus(): STTStatus {
    return this.status;
  }

  getConfig(): STTConfig {
    return this.configStore.getConfig();
  }

  updateConfig(partial: Partial<STTConfig>): STTConfig {
    return this.configStore.setConfig(partial);
  }

  async start(configOverride?: STTConfig): Promise<void> {
    if (this.status.state === 'running' || this.status.state === 'starting') {
      return;
    }

    const storedConfig = configOverride || this.getConfig();
    const model = this.modelManager.listInstalled().find((item) => item.id === storedConfig.modelId);
    if (!model) {
      const message = 'Nenhum modelo Vosk instalado ou selecionado';
      this.setStatus({ state: 'error', message });
      throw new Error(message);
    }

    const targetSampleRate = model.defaultSampleRate || storedConfig.sampleRate;
    const config =
      targetSampleRate !== storedConfig.sampleRate
        ? { ...storedConfig, sampleRate: targetSampleRate }
        : storedConfig;

    this.setStatus({ state: 'starting' });
    this.emitDebug(`starting model=${model.id} path=${model.installPath}`);
    this.emitDebug(`sampleRate=${config.sampleRate}`);

    try {
      this.provider = new VoskProvider();
      this.provider.onPartial((event) => this.emitter.emit('partial', event));
      this.provider.onFinal((event) => this.emitter.emit('final', event));
      this.provider.onError((message) => this.handleError(message));
      this.provider.onDebug?.((message) => this.emitDebug(message));

      await this.provider.start(config, model.installPath);
      this.emitDebug('provider ready');

      const sourceType = process.env.RICKY_STT_SOURCE || 'arecord';
      this.audioSource = sourceType === 'arecord' ? new ArecordAudioSource() : new RendererAudioSource();
      this.audioBytes = 0;
      this.lastAudioAt = Date.now();
      this.audioSource.onData((chunk) => {
        this.audioBytes += chunk.length;
        this.lastAudioAt = Date.now();
        this.updateLevel(chunk);
        this.provider?.feedAudio(chunk);
      });
      this.audioSource.onError((error) => this.handleError(error.message));
      await this.audioSource.start({ sampleRate: config.sampleRate });
      if (this.audioSource instanceof ArecordAudioSource) {
        const deviceName = this.audioSource.getDeviceName();
        this.emitDebug(`arecord started device=${deviceName}`);
      } else {
        this.emitDebug('renderer audio source ativo');
      }
      this.startAudioMonitor();

      this.setStatus({ state: 'running', modelId: model.id, language: model.language });
    } catch (error) {
      this.handleError(error instanceof Error ? error.message : 'Falha ao iniciar STT');
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

  private setStatus(status: STTStatus): void {
    this.status = status;
    this.emitter.emit('status', status);
  }

  private emitDebug(message: string): void {
    this.emitter.emit('debug', message);
  }

  private startAudioMonitor(): void {
    if (this.audioTimer) return;
    this.audioTimer = setInterval(() => {
      const now = Date.now();
      const since = now - this.lastAudioAt;
      const kb = (this.audioBytes / 1024).toFixed(1);
      this.emitDebug(`audio ${kb} KB/s, ultimo ${since}ms`);
      this.audioBytes = 0;
    }, 1000);
  }

  private stopAudioMonitor(): void {
    if (this.audioTimer) {
      clearInterval(this.audioTimer);
      this.audioTimer = null;
    }
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

  private handleError(message: string): void {
    logger.error({ message }, 'STT error');
    this.emitter.emit('error', message);
    this.setStatus({ state: 'error', message });
  }

  private async cleanup(): Promise<void> {
    try {
      await this.audioSource?.stop();
    } catch (error) {
      logger.error({ err: error }, 'Failed to stop audio source');
    }

    try {
      await this.provider?.stop();
    } catch (error) {
      logger.error({ err: error }, 'Failed to stop STT provider');
    }

    this.stopAudioMonitor();
    this.level = 0;
    this.lastLevelAt = 0;
    this.emitter.emit('level', { level: 0, rms: 0, ts: Date.now() });
    this.audioSource = null;
    this.provider = null;
  }
}
