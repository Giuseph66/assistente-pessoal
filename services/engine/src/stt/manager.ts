import { getLogger } from '@neo/logger';
import { STTProvider, STTEvent } from './interface.js';
import { WhisperCppProvider } from './providers/whisper.js';

const logger = getLogger({ appName: 'ricky-engine' });

/**
 * Gerenciador de STT que coordena providers
 */
export class STTManager {
  private provider: STTProvider | null = null;
  private isActiveFlag: boolean = false;
  private currentLanguage: 'en' | 'pt' = 'en';

  /**
   * Inicia a transcrição
   */
  async start(language: 'en' | 'pt', onEvent: (event: STTEvent) => void): Promise<void> {
    if (this.isActiveFlag) {
      logger.warn('STT already active');
      return;
    }

    this.currentLanguage = language;

    // Por enquanto, usa WhisperCppProvider
    // Futuramente, pode escolher provider baseado em configuração
    this.provider = new WhisperCppProvider();

    try {
      await this.provider.start(language, onEvent);
      this.isActiveFlag = true;
      logger.info({ language, provider: 'whisper' }, 'STT started');
    } catch (error) {
      logger.error({ err: error }, 'Failed to start STT');
      throw error;
    }
  }

  /**
   * Para a transcrição
   */
  async stop(): Promise<void> {
    if (!this.isActiveFlag || !this.provider) {
      return;
    }

    try {
      await this.provider.stop();
      this.isActiveFlag = false;
      this.provider = null;
      logger.info('STT stopped');
    } catch (error) {
      logger.error({ err: error }, 'Error stopping STT');
      throw error;
    }
  }

  /**
   * Verifica se STT está ativo
   */
  isActive(): boolean {
    return this.isActiveFlag;
  }

  /**
   * Obtém o provider atual
   */
  getProvider(): string {
    return this.provider?.getName() || 'none';
  }
}
