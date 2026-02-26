
import Store from 'electron-store';
import { AIConfig } from '@neo/shared';

type AIConfigStoreState = {
  lastConfig: Partial<AIConfig>;
};

/**
 * Persistência local (electron-store) da última configuração de IA usada.
 * Mantém apenas campos necessários para restaurar a seleção (provider/model).
 */
export class AIConfigStore {
  private store: Store<AIConfigStoreState>;

  constructor() {
    this.store = new Store<AIConfigStoreState>({
      name: 'ai',
      defaults: {
        lastConfig: {},
      },
    });
  }

  getLastConfig(): Partial<AIConfig> {
    return this.store.get('lastConfig') || {};
  }

  setLastConfig(config: Partial<AIConfig>): Partial<AIConfig> {
    const current = this.getLastConfig();
    const next = { ...current, ...config };
    this.store.set('lastConfig', next);
    return next;
  }
}

let aiConfigStore: AIConfigStore | null = null;

export function getAIConfigStore(): AIConfigStore {
  if (!aiConfigStore) {
    aiConfigStore = new AIConfigStore();
  }
  return aiConfigStore;
}



