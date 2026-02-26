import { STTProvider, STTEvent } from '../interface.js';
import { getLogger } from '@neo/logger';
import { ChildProcess } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';

const logger = getLogger({ appName: 'ricky-engine' });

/**
 * Provider STT usando Whisper.cpp
 * 
 * Este provider spawna o binário whisper.cpp e processa stdout
 * para gerar eventos de transcrição.
 */
export class WhisperCppProvider implements STTProvider {
  private process: ChildProcess | null = null;
  private onEvent: ((event: STTEvent) => void) | null = null;
  private isActiveFlag: boolean = false;

  getName(): string {
    return 'whisper.cpp';
  }

  async start(language: 'en' | 'pt', onEvent: (event: STTEvent) => void): Promise<void> {
    if (this.isActiveFlag) {
      throw new Error('STT already active');
    }

    this.onEvent = onEvent;

    // Por enquanto, retorna eventos simulados
    // TODO: Implementar spawn real do whisper.cpp quando binário estiver disponível
    logger.warn('WhisperCppProvider: Using simulated events (not implemented yet)');

    // Simulação temporária
    this.isActiveFlag = true;
    this.simulateTranscription(language);
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.isActiveFlag = false;
    this.onEvent = null;
    logger.info('WhisperCppProvider stopped');
  }

  isActive(): boolean {
    return this.isActiveFlag;
  }

  /**
   * Simula transcrição (temporário até implementar whisper.cpp real)
   */
  private simulateTranscription(language: 'en' | 'pt'): void {
    if (!this.onEvent) return;

    // Simula eventos parciais e finais
    const phrases = [
      'Hello world',
      'This is a test',
      'Speech recognition is working',
    ];

    let phraseIndex = 0;
    const interval = setInterval(() => {
      if (!this.isActiveFlag || !this.onEvent) {
        clearInterval(interval);
        return;
      }

      if (phraseIndex < phrases.length) {
        const text = phrases[phraseIndex];
        
        // Evento parcial
        this.onEvent({
          type: 'stt.partial',
          payload: {
            text: text.substring(0, text.length - 2) + '..',
            confidence: 0.85,
          },
          timestamp: Date.now(),
        });

        // Evento final após delay
        setTimeout(() => {
          if (this.isActiveFlag && this.onEvent) {
            this.onEvent({
              type: 'stt.final',
              payload: {
                text,
                timestamp: Date.now(),
              },
              timestamp: Date.now(),
            });
          }
        }, 500);

        phraseIndex++;
      } else {
        clearInterval(interval);
      }
    }, 3000);
  }

  /**
   * Obtém o caminho do modelo Whisper
   */
  private getModelPath(language: 'en' | 'pt'): string {
    const modelDir = join(homedir(), '.local', 'share', 'ricky', 'whisper-models');
    const modelName = language === 'en' ? 'ggml-base.en.bin' : 'ggml-base.pt.bin';
    return join(modelDir, modelName);
  }

  /**
   * Obtém o caminho do binário whisper.cpp
   */
  private getWhisperBinaryPath(): string {
    // TODO: Detectar binário instalado ou usar path configurado
    return 'whisper-cli'; // Placeholder
  }
}
