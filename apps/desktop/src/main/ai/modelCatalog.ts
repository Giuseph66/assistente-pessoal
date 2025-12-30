import { app } from 'electron';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ModelInfo, AIProviderId } from '@ricky/shared';

type ProviderCatalog = {
  models: Array<Omit<ModelInfo, 'provider'>>;
};

type ModelCatalog = {
  version: number;
  providers: Record<string, ProviderCatalog>;
};

const DEFAULT_CATALOG: ModelCatalog = {
  version: 1,
  providers: {
    gemini: {
      models: [
        {
          id: 'gemini-2.5-flash',
          name: 'Gemini 2.5 Flash',
          supportsVision: true,
          maxTokens: 8192,
          supportsStreaming: false,
        },
        {
          id: 'gemini-2.5-flash-lite',
          name: 'Gemini 2.5 Flash Lite',
          supportsVision: true,
          maxTokens: 8192,
          supportsStreaming: false,
        },
      ],
    },
    openai: {
      models: [
        {
          id: 'gpt-4o',
          name: 'GPT-4o',
          supportsVision: true,
          maxTokens: 4096,
          supportsStreaming: false,
        },
      ],
    },
  },
};

export function getModelCatalogPath(): string | null {
  if (!app.isReady()) {
    return null;
  }
  return join(app.getPath('userData'), 'ai-models.json');
}

function normalizeModels(
  providerId: AIProviderId,
  models: Array<Omit<ModelInfo, 'provider'>>
): ModelInfo[] {
  return models.map((model) => ({
    ...model,
    provider: providerId,
  }));
}

export function loadModelCatalog(): ModelCatalog {
  // Sempre tenta carregar o arquivo padrão (mesmo se app não estiver pronto)
  const defaultCatalogPath = app.isPackaged
    ? join(__dirname, 'modelCatalog.default.json')
    : join(process.cwd(), 'src', 'main', 'ai', 'modelCatalog.default.json');

  let seedCatalog = DEFAULT_CATALOG;
  if (existsSync(defaultCatalogPath)) {
    try {
      const rawDefault = readFileSync(defaultCatalogPath, 'utf-8');
      const parsedDefault = JSON.parse(rawDefault);
      if (parsedDefault && typeof parsedDefault === 'object' && parsedDefault.providers) {
        seedCatalog = parsedDefault as ModelCatalog;
      }
    } catch {
      seedCatalog = DEFAULT_CATALOG;
    }
  }

  // Só tenta acessar userData se o app estiver pronto
  const catalogPath = getModelCatalogPath();
  if (!catalogPath) {
    return seedCatalog;
  }

  if (!existsSync(catalogPath)) {
    try {
      writeFileSync(catalogPath, JSON.stringify(seedCatalog, null, 2));
    } catch {
      return seedCatalog;
    }
  }

  try {
    const raw = readFileSync(catalogPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.providers) {
      return parsed as ModelCatalog;
    }
  } catch {
    return seedCatalog;
  }

  return seedCatalog;
}

export function getModelsForProvider(
  providerId: AIProviderId,
  fallback: ModelInfo[]
): ModelInfo[] {
  const catalog = loadModelCatalog();
  const provider = catalog.providers?.[providerId];
  if (!provider || !Array.isArray(provider.models)) {
    return fallback;
  }
  return normalizeModels(providerId, provider.models);
}
