import type { App } from 'electron';
import type { OverlayManager } from '../overlay';
import { CommandRegistry } from './command-registry';
import {
  CommandPaletteAction,
  CommandPaletteActionDefinition,
  CommandPaletteExecuteResult,
  CommandPaletteUpdateListener,
} from './types';

const isSttRunning = (state: string): boolean =>
  state === 'running' || state === 'listening' || state === 'starting';

type LoggerLike = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

type SttStatusLike = {
  state: string;
};

type CommandPaletteContext = {
  overlayManager: OverlayManager;
  app: App;
  logger: LoggerLike;
  getSttStatus: () => SttStatusLike;
  startStt: () => Promise<void> | void;
  stopStt: () => Promise<void> | void;
  runInteractiveCapture: () => Promise<{ success: boolean; error?: string }>;
  runTextHighlight: () => Promise<void>;
};

export type CommandPaletteServiceDependencies = CommandPaletteContext;

export class CommandPaletteService {
  private readonly context: CommandPaletteContext;
  private readonly registry: CommandRegistry<CommandPaletteContext>;
  private readonly updateListeners = new Set<CommandPaletteUpdateListener>();

  constructor(dependencies: CommandPaletteServiceDependencies) {
    this.context = dependencies;
    this.registry = new CommandRegistry(this.buildActions());
  }

  listActions(query?: string): CommandPaletteAction[] {
    return this.registry.list(this.context, query);
  }

  async execute(
    actionId: string,
    context?: Record<string, unknown>
  ): Promise<CommandPaletteExecuteResult> {
    const result = await this.registry.execute(actionId, this.context, context);

    if (!result.success) {
      this.context.logger.warn({ actionId, error: result.error }, 'Command palette action failed');
      return result;
    }

    this.context.logger.info({ actionId }, 'Command palette action executed');
    this.emitUpdated();
    return result;
  }

  onUpdated(listener: CommandPaletteUpdateListener): () => void {
    this.updateListeners.add(listener);
    return () => this.updateListeners.delete(listener);
  }

  private emitUpdated(): void {
    const payload = this.listActions();
    this.updateListeners.forEach((listener) => {
      try {
        listener(payload);
      } catch {
        // Isolated listener failure.
      }
    });
  }

  private buildActions(): CommandPaletteActionDefinition<CommandPaletteContext>[] {
    return [
      {
        id: 'open-settings',
        title: 'Abrir Configuracoes',
        subtitle: 'Abre a janela de configuracoes do NEO',
        category: 'Navegacao',
        aliases: ['settings', 'config', 'preferencias'],
        keywords: ['janela', 'painel'],
        run: ({ overlayManager }) => {
          overlayManager.createSettingsWindow();
          return { success: true, message: 'Configuracoes abertas' };
        },
      },
      {
        id: 'open-history',
        title: 'Abrir Historico',
        subtitle: 'Abre o historico de capturas e sessoes',
        category: 'Navegacao',
        aliases: ['historico', 'history'],
        keywords: ['capturas', 'sessoes'],
        run: ({ overlayManager }) => {
          overlayManager.createHistoryWindow();
          return { success: true, message: 'Historico aberto' };
        },
      },
      {
        id: 'open-main-session',
        title: 'Abrir Sessao Principal',
        subtitle: 'Mostra a janela principal do assistente',
        category: 'Navegacao',
        aliases: ['sessao', 'overlay', 'principal'],
        keywords: ['chat', 'main'],
        run: ({ overlayManager }) => {
          const mainWindow = overlayManager.getWindow();
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show();
            mainWindow.focus();
          } else {
            overlayManager.createWindow();
          }
          return { success: true, message: 'Sessao principal aberta' };
        },
      },
      {
        id: 'open-workflow-editor',
        title: 'Abrir Editor de Workflow',
        subtitle: 'Abre o editor de automacao visual',
        category: 'Navegacao',
        aliases: ['workflow', 'automacao', 'editor'],
        keywords: ['flow', 'orkut'],
        run: ({ overlayManager }) => {
          overlayManager.createWorkflowEditorWindow();
          return { success: true, message: 'Editor de workflow aberto' };
        },
      },
      {
        id: 'toggle-stt',
        title: 'Iniciar/Parar STT',
        subtitle: 'Alterna a escuta de voz',
        category: 'Acoes Rapidas',
        aliases: ['stt', 'voz', 'microfone'],
        keywords: ['transcricao', 'speech'],
        run: async ({ getSttStatus, startStt, stopStt }) => {
          const state = getSttStatus().state;
          if (isSttRunning(state)) {
            await Promise.resolve(stopStt());
            return { success: true, message: 'STT parado' };
          }

          await Promise.resolve(startStt());
          return { success: true, message: 'STT iniciado' };
        },
      },
      {
        id: 'capture-screenshot-area',
        title: 'Captura de Tela (Area)',
        subtitle: 'Inicia a selecao interativa de area',
        category: 'Acoes Rapidas',
        aliases: ['screenshot', 'captura', 'print'],
        keywords: ['area', 'selection'],
        run: async ({ runInteractiveCapture }) => {
          const result = await runInteractiveCapture();
          if (!result.success) {
            return {
              success: false,
              error: result.error || 'capture_failed',
            };
          }
          return { success: true, message: 'Captura concluida' };
        },
      },
      {
        id: 'highlight-text-ocr',
        title: 'Destacar Texto (OCR)',
        subtitle: 'Executa o OCR para destacar texto na tela',
        category: 'Acoes Rapidas',
        aliases: ['ocr', 'texto', 'highlight'],
        keywords: ['captura', 'leitura'],
        run: async ({ runTextHighlight }) => {
          await runTextHighlight();
          return { success: true, message: 'OCR executado' };
        },
      },
      {
        id: 'enter-mini-hud',
        title: 'Entrar em Mini HUD',
        subtitle: 'Minimiza o ambiente para o modo bolinha',
        category: 'Janela',
        aliases: ['mini', 'hud', 'floating'],
        keywords: ['overlay', 'minimizar'],
        enabled: ({ overlayManager }) => !overlayManager.isMiniHUDVisible(),
        run: ({ overlayManager }) => {
          overlayManager.enterMiniMode();
          return { success: true, message: 'Mini HUD ativado' };
        },
      },
      {
        id: 'quit-app',
        title: 'Sair do App',
        subtitle: 'Encerra completamente o NEO',
        category: 'Sistema',
        aliases: ['quit', 'exit', 'fechar'],
        keywords: ['encerrar', 'sair'],
        run: ({ app }) => {
          setTimeout(() => app.quit(), 50);
          return { success: true, message: 'Encerrando aplicativo' };
        },
      },
    ];
  }
}
