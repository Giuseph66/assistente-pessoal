import Store from 'electron-store';
import { z } from 'zod';
import { AppConfig, AppConfigSchema, defaultConfig } from './schema';

/**
 * Gerenciador de configurações usando electron-store
 * 
 * Garante type-safety e validação de schema usando Zod
 */
export class ConfigManager {
  private store: Store<AppConfig>;

  constructor() {
    this.store = new Store<AppConfig>({
      name: 'config',
      defaults: defaultConfig,
      schema: {
        overlay: {
          type: 'object',
          properties: {
            position: {
              type: 'object',
              properties: {
                x: { type: 'number' },
                y: { type: 'number' },
              },
            },
            size: {
              type: 'object',
              properties: {
                width: { type: 'number' },
                height: { type: 'number' },
              },
            },
            opacity: { type: 'number' },
            alwaysOnTop: { type: 'boolean' },
            presentationMode: { type: 'boolean' },
            contentProtection: { type: 'boolean' },
          },
        },
        hotkeys: {
          type: 'object',
          properties: {
            toggleOverlay: { type: 'string' },
            startStopSTT: { type: 'string' },
            screenshot: { type: 'string' },
            presentationMode: { type: 'string' },
            panicMode: { type: 'string' },
          },
        },
        stt: {
          type: 'object',
          properties: {
            provider: { type: 'string' },
            language: { type: 'string' },
            modelPath: { type: 'string' },
          },
        },
        translate: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            provider: { type: 'string' },
            source: { type: 'string' },
            target: { type: 'string' },
          },
        },
        screenshots: {
          type: 'object',
          properties: {
            savePath: { type: 'string' },
            format: { type: 'string' },
            quality: { type: 'number' },
          },
        },
      },
    });
  }

  /**
   * Obtém toda a configuração
   */
  getAll(): AppConfig {
    const config = this.store.store;
    // Valida e retorna com defaults para valores faltantes
    return AppConfigSchema.parse(config);
  }

  /**
   * Obtém um valor específico usando path
   * Exemplo: get('overlay') ou get('overlay', 'opacity')
   * Se chamado sem parâmetros, retorna toda a configuração
   */
  get(key?: string, subKey?: string): any {
    if (!key) {
      return this.getAll();
    }
    if (subKey) {
      return this.store.get(`${key}.${subKey}` as any);
    }
    return this.store.get(key as any);
  }

  /**
   * Define um valor de configuração
   * Exemplo: set('overlay', { opacity: 90 }) ou set('overlay', 'opacity', 90)
   */
  set(key: string, valueOrSubKey: any, value?: any): void {
    if (value !== undefined) {
      // set('overlay', 'opacity', 90)
      this.store.set(`${key}.${valueOrSubKey}` as any, value);
    } else {
      // set('overlay', { opacity: 90 })
      this.store.set(key as any, valueOrSubKey);
    }
  }

  /**
   * Reseta configuração para valores padrão
   */
  reset(): void {
    this.store.clear();
    this.store.store = defaultConfig;
  }

  /**
   * Valida a configuração atual contra o schema
   */
  validate(): { valid: boolean; errors?: string[] } {
    try {
      AppConfigSchema.parse(this.store.store);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        };
      }
      return { valid: false, errors: ['Unknown validation error'] };
    }
  }

  /**
   * Obtém o caminho do arquivo de configuração
   */
  getPath(): string {
    return this.store.path;
  }
}

// Singleton para uso no main process
let configManager: ConfigManager | null = null;

/**
 * Obtém instância singleton do ConfigManager
 * Deve ser chamado apenas no main process do Electron
 */
export function getConfigManager(): ConfigManager {
  if (!configManager) {
    configManager = new ConfigManager();
  }
  return configManager;
}

