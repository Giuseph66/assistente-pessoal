import { SttPartialEvent, SttFinalEvent } from '@neo/shared';

/**
 * Eventos emitidos pelo STT provider
 */
export type STTEvent = SttPartialEvent | SttFinalEvent;

/**
 * Interface para providers de STT
 */
export interface STTProvider {
  /**
   * Nome do provider
   */
  getName(): string;

  /**
   * Inicia a transcrição
   * @param language Idioma ('en' ou 'pt')
   * @param onEvent Callback para eventos (partial/final)
   */
  start(language: 'en' | 'pt', onEvent: (event: STTEvent) => void): Promise<void>;

  /**
   * Para a transcrição
   */
  stop(): Promise<void>;

  /**
   * Verifica se está ativo
   */
  isActive(): boolean;
}

