/**
 * Store simples para armazenar o texto do input STT compartilhado
 * entre o renderer e o main process.
 * 
 * Usado para o atalho de "colar texto STT" em aplicações externas.
 */

import { getLogger } from '@ricky/logger';

const logger = getLogger();

let currentText = '';

/**
 * Define o texto do input STT compartilhado
 */
export function setSharedSttText(text: string): void {
  const newText = text ?? '';
  if (newText !== currentText) {
    currentText = newText;
    logger.debug({ 
      textLength: currentText.length, 
      preview: currentText.substring(0, 50),
      changed: true 
    }, 'Shared STT text updated');
  }
}

/**
 * Obtém o texto do input STT compartilhado
 */
export function getSharedSttText(): string {
  logger.debug({ textLength: currentText.length, preview: currentText.substring(0, 30) }, 'Getting shared STT text');
  return currentText;
}

/**
 * Limpa o texto do input STT compartilhado
 */
export function clearSharedSttText(): void {
  currentText = '';
  logger.debug('Shared STT text cleared');
}

/**
 * Verifica se há texto no input STT compartilhado
 */
export function hasSharedSttText(): boolean {
  return currentText.trim().length > 0;
}

