import { DatabaseManager } from '../database';
import { KeyStorage } from './storage/KeyStorage';
import { AIService } from './AIService';
import { AIConfig } from '@ricky/shared';
import { getAIConfigStore } from '../storage/aiConfigStore';
import { normalizeAIConfigPatch } from './utils/aiConfigNormalization';

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
    const aiConfigStore = getAIConfigStore();
    const saved = aiConfigStore.getLastConfig();

    // Defaults base (precisa ser um AIConfig completo para normalização)
    const defaults: AIConfig = {
      providerId: 'gemini',
      modelName: 'gemini-2.5-flash',
      timeoutMs: 30000,
      retries: 2,
      streaming: false,
      saveHistory: true,
      maxImageDimension: 1280,
      maxImageBytes: 2_500_000,
      imageQuality: 80,
      enableImageOptimization: true,
      fallbackMaxAttempts: 3,
      fallbackCooldownMinutes: 10,
    };

    // Prioridade: config passada > config salva. A config salva só traz provider/model.
    const initialCandidate: Partial<AIConfig> = { ...saved, ...(config || {}) };
    const { normalizedPatch } = normalizeAIConfigPatch(defaults, initialCandidate);

    aiService = new AIService(db, storage, normalizedPatch);
  } else if (config) {
    aiService.updateConfig(config);
  }
  return aiService;
}


