import { EventEmitter } from 'events';
import { LiveTranscriptionProviderId, STTConfig, STTFinalEvent, STTPartialEvent, STTStatus } from '@ricky/shared';
import { getLogger } from '@ricky/logger';
import { ModelManager } from './models/ModelManager';
import { getConfigStore } from '../storage/configStore';
import { SystemAudioCapture } from '../audio/system/SystemAudioCapture';
import { createLiveTranscriptionProvider, normalizeLiveProviderId } from './providers/LiveProviderRegistry';
import type { LiveTranscriptionError, LiveTranscriptionProvider } from './providers/LiveTranscriptionProvider';
import { DatabaseManager } from '../database';
import { ApiKeyPool } from '../ai/ApiKeyPool';
import { getKeyStorage } from '../ai/AIServiceManager';

const logger = getLogger();

type StartOptions = {
  sourceId: string;
};

export class SystemSttController {
  private status: STTStatus = { state: 'idle' };
  private provider: LiveTranscriptionProvider | null = null;
  private emitter = new EventEmitter();
  private modelManager: ModelManager;
  private configStore = getConfigStore();
  private db: DatabaseManager | null = null;
  private audioSource: SystemAudioCapture | null = null;
  private level = 0;
  private lastLevelAt = 0;

  constructor(modelManager: ModelManager, db?: DatabaseManager) {
    this.modelManager = modelManager;
    this.db = db || null;
  }

  getStatus(): STTStatus {
    return this.status;
  }

  async start(options: StartOptions): Promise<void> {
    if (this.status.state === 'listening' || this.status.state === 'running' || this.status.state === 'starting') {
      return;
    }
    if (!options.sourceId) {
      const message = 'Selecione um dispositivo de audio do sistema';
      this.setStatus({ state: 'error', message });
      throw new Error(message);
    }

    const storedConfig = this.getConfig();
    let effectiveConfig = storedConfig;
    const providerId = normalizeLiveProviderId(storedConfig.provider);
    let modelPath: string | undefined;
    let modelName: string | undefined;
    let modelLanguage: string | undefined;

    if (providerId === 'vox') {
      const model = this.modelManager.listInstalled().find((item) => item.id === storedConfig.modelId);
      if (!model) {
        const message = 'Nenhum modelo Vosk instalado ou selecionado';
        this.setStatus({ state: 'error', message, providerId });
        throw new Error(message);
      }
      const targetSampleRate = model.defaultSampleRate || storedConfig.sampleRate;
      if (targetSampleRate !== storedConfig.sampleRate) {
        effectiveConfig = { ...storedConfig, sampleRate: targetSampleRate };
      }
      modelPath = model.installPath;
      modelName = model.id;
      modelLanguage = model.language;
    } else if (providerId === 'openai_realtime_transcribe') {
      modelName = 'gpt-4o-transcribe';
      if (storedConfig.sampleRate !== 16000) {
        effectiveConfig = { ...storedConfig, sampleRate: 16000 };
      }
    } else if (providerId === 'gemini_live') {
      modelName = 'gemini-2.0-flash-live';
      if (storedConfig.sampleRate !== 16000) {
        effectiveConfig = { ...storedConfig, sampleRate: 16000 };
      }
    }

    this.setStatus({ state: 'starting', providerId });

    try {
      const provider = createLiveTranscriptionProvider(providerId);
      this.provider = provider;
      provider.onPartial((event) => this.emitter.emit('partial', event));
      provider.onFinal((event) => this.emitter.emit('final', event));
      provider.onStatus((status) => this.setStatus(status));
      provider.onError((error) => this.handleError(error));
      provider.onDebug?.((message) => this.emitter.emit('debug', message));

      const apiKey =
        providerId === 'openai_realtime_transcribe'
          ? this.resolveApiKey('openai')
          : providerId === 'gemini_live'
          ? this.resolveApiKey('gemini')
          : undefined;

      if ((providerId === 'openai_realtime_transcribe' || providerId === 'gemini_live') && !apiKey) {
        const message = `Chave de API nao configurada para ${providerId === 'gemini_live' ? 'Gemini' : 'OpenAI'}`;
        this.setStatus({ state: 'error', message, providerId });
        throw new Error(message);
      }

      await provider.start({
        ...effectiveConfig,
        provider: providerId,
        modelPath,
        modelName,
        apiKey: apiKey?.key,
      });

      this.audioSource = new SystemAudioCapture();
      this.level = 0;
      this.lastLevelAt = 0;
      this.audioSource.onData((chunk) => {
        this.updateLevel(chunk);
        this.provider?.pushAudio(chunk);
      });
      this.audioSource.onError((error) => this.handleError(error.message));
      await this.audioSource.start({ sourceId: options.sourceId, sampleRate: effectiveConfig.sampleRate });

      if (providerId === 'vox' && modelName) {
        this.setStatus({ state: 'listening', modelId: modelName, language: modelLanguage, providerId });
      }
    } catch (error) {
      this.handleError(error instanceof Error ? error.message : 'Falha ao iniciar STT do sistema');
      await this.cleanup();
    }
  }

  async stop(): Promise<void> {
    if (this.status.state === 'idle' || this.status.state === 'stopping' || this.status.state === 'finalizing') {
      return;
    }

    this.setStatus({ state: 'finalizing', providerId: this.status.providerId });

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

  onError(
    cb: (payload: { message: string; debug?: string; providerId?: LiveTranscriptionProviderId }) => void
  ): () => void {
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

  private handleError(error: LiveTranscriptionError | string): void {
    const payload =
      typeof error === 'string'
        ? { message: error }
        : { message: error.message, debug: error.debug, providerId: error.providerId };
    logger.error({ message: payload.message, debug: payload.debug, providerId: payload.providerId }, 'System STT error');
    this.emitter.emit('error', payload);
    this.setStatus({ state: 'error', message: payload.message, providerId: payload.providerId, debug: payload.debug });
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

  private resolveApiKey(providerId: 'openai' | 'gemini'): { key: string; keyId?: number } | null {
    if (!this.db) return null;
    const keyPool = new ApiKeyPool(this.db, getKeyStorage());
    const apiKey = keyPool.getNextKey(providerId);
    if (!apiKey?.key) return null;
    return { key: apiKey.key, keyId: apiKey.id };
  }
}
