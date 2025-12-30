import { DatabaseManager } from '../database';
import { KeyStorage } from './storage/KeyStorage';
import { AIService } from './AIService';
import { AIConfig } from '@ricky/shared';

/**
 * Gerenciador singleton do AIService
 */
let aiService: AIService | null = null;
let keyStorage: KeyStorage | null = null;

export function getKeyStorage(): KeyStorage {
  if (!keyStorage) {
    keyStorage = new KeyStorage();
  }
  return keyStorage;
}

export function getAIService(db: DatabaseManager, config?: Partial<AIConfig>): AIService {
  if (!aiService) {
    const storage = getKeyStorage();
    aiService = new AIService(db, storage, config);
  } else if (config) {
    aiService.updateConfig(config);
  }
  return aiService;
}


