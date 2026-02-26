import Store from 'electron-store';
import { InstalledModel, STTConfig } from '@neo/shared';

export type STTStoreState = {
  config: STTConfig;
  installedModels: InstalledModel[];
};

const defaultConfig: STTConfig = {
  provider: 'vox',
  modelId: '',
  sampleRate: 16000,
  enablePartial: true,
  partialDebounceMs: 200,
  maxSegmentSeconds: 15,
};

export class ConfigStore {
  private store: Store<STTStoreState>;

  constructor() {
    this.store = new Store<STTStoreState>({
      name: 'stt',
      defaults: {
        config: defaultConfig,
        installedModels: [],
      },
    });
  }

  getConfig(): STTConfig {
    return this.store.get('config');
  }

  setConfig(config: Partial<STTConfig>): STTConfig {
    const next = { ...this.getConfig(), ...config };
    this.store.set('config', next);
    return next;
  }

  getInstalledModels(): InstalledModel[] {
    return this.store.get('installedModels');
  }

  setInstalledModels(models: InstalledModel[]): void {
    this.store.set('installedModels', models);
  }
}

let configStore: ConfigStore | null = null;

export function getConfigStore(): ConfigStore {
  if (!configStore) {
    configStore = new ConfigStore();
  }
  return configStore;
}
