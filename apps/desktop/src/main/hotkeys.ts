import { globalShortcut, app, BrowserWindow } from 'electron';
import { getConfigManager } from '@neo/config';
import { getLogger } from '@neo/logger';
import { getOverlayManager } from './overlay';
import { getSttController } from './stt/sttService';
import { captureAreaInteractiveConfirmed } from './screenshot';
import { runTextHighlight } from './text-highlight-controller';
import { getTextHighlightOverlayManager } from './text-highlight-overlay';
import { getSharedSttText, clearSharedSttText, hasSharedSttText } from './storage/sharedInputStore';
import { getAutomationService } from './automation/AutomationService';

const logger = getLogger();
const config = getConfigManager();

/**
 * Gerenciador de hotkeys globais
 */
export class HotkeysManager {
  private registeredHotkeys: Set<string> = new Set();
  private static readonly SAFE_TEXT_HIGHLIGHT_CLEAR_HOTKEY = 'CommandOrControl+Alt+Escape';

  private hasModifier(accelerator: string): boolean {
    return /(?:^|\+)(CommandOrControl|Command|Cmd|Control|Ctrl|Alt|Option|Shift|Super|Meta)(?:\+|$)/i.test(accelerator);
  }

  private isFunctionKeyOnly(accelerator: string): boolean {
    return /^F([1-9]|1[0-9]|2[0-4])$/i.test(accelerator.trim());
  }

  private isSafeGlobalAccelerator(accelerator: string): boolean {
    return this.hasModifier(accelerator) || this.isFunctionKeyOnly(accelerator);
  }

  /**
   * Registra todas as hotkeys configuradas
   */
  registerAll(): void {
    const hotkeys = config.getAll().hotkeys;
    const overlayManager = getOverlayManager();
    const thManager = getTextHighlightOverlayManager();

    // Toggle overlay
    this.register(hotkeys.toggleOverlay, () => {
      logger.debug('Hotkey: toggle overlay');
      overlayManager.toggle();
    });

    // Start/Stop STT
    this.register(hotkeys.startStopSTT, () => {
      logger.debug('Hotkey: start/stop STT');
      const controller = getSttController();
      const status = controller.getStatus();
      if (
        status.state === 'running' ||
        status.state === 'listening' ||
        status.state === 'starting'
      ) {
        controller.stop();
      } else {
        controller.start();
      }
    });

    // Screenshot
    this.register(hotkeys.screenshot, async () => {
      logger.debug('Hotkey: screenshot');
      const overlayManager = getOverlayManager();
      
      // Hide overlay and use system selection tools
      overlayManager.hide();
      try {
        const { DatabaseManager } = await import('./database');
        const db = new DatabaseManager();
        const result = await captureAreaInteractiveConfirmed(db);
        if (!result.success && result.error && result.error !== 'Selecao cancelada') {
          logger.warn({ error: result.error }, 'Screenshot capture failed');
        }
        db.close();
      } catch (error: any) {
        logger.error({ err: error }, 'Failed to capture screenshot');
      } finally {
        overlayManager.show();
      }
    });

    // Presentation mode
    this.register(hotkeys.presentationMode, () => {
      logger.debug('Hotkey: presentation mode');
      const currentMode = config.get('overlay', 'presentationMode');
      overlayManager.setPresentationMode(!currentMode);
    });

    // Text Highlight Overlay (Capture OCR-based text boxes)
    const textHighlightKey = (config.getAll().hotkeys as any).textHighlight ?? 'Ctrl+E';
    const configuredTextHighlightClearKey = (config.getAll().hotkeys as any).textHighlightClear
      ?? HotkeysManager.SAFE_TEXT_HIGHLIGHT_CLEAR_HOTKEY;
    const textHighlightClearKey = this.isSafeGlobalAccelerator(configuredTextHighlightClearKey)
      ? configuredTextHighlightClearKey
      : HotkeysManager.SAFE_TEXT_HIGHLIGHT_CLEAR_HOTKEY;
    if (textHighlightClearKey !== configuredTextHighlightClearKey) {
      logger.warn(
        { configured: configuredTextHighlightClearKey, fallback: textHighlightClearKey },
        'textHighlightClear sem modificador nao pode ser global; fallback seguro aplicado'
      );
      config.set('hotkeys', 'textHighlightClear', textHighlightClearKey);
    }
    this.register(textHighlightKey, () => {
      logger.debug('Hotkey: text highlight (OCR overlay)');
      runTextHighlight().catch((err) => {
        logger.error({ err }, 'TextHighlightOverlay: failed to highlight displays');
      });
    });
    this.register(textHighlightClearKey, () => {
      logger.debug('Hotkey: clear text highlight overlay');
      thManager.clearAllOverlays();
    });

    // Panic mode (apenas altera content protection, mantém janela visível)
    const panicHotkey = (hotkeys as any).panicMode ?? 'CommandOrControl+Alt+H';
    this.register(panicHotkey, () => {
      logger.debug('Hotkey: panic mode');
      const overlayManager = getOverlayManager();
      const currentState = overlayManager.getCurrentContentProtection();
      
      // Se está protegido (ou null/default), desprotege (mas mantém visível)
      // Se está desprotegido, protege (mantém visível)
      const shouldProtect = currentState === null ? true : currentState; // Default: true
      
      if (shouldProtect) {
        overlayManager.setContentProtection(false);
        overlayManager.show(); // Garante que está visível
        logger.info('Panic mode activated: content protection disabled (window remains visible)');
      } else {
        overlayManager.setContentProtection(true);
        overlayManager.show(); // Garante que está visível
        logger.info('Panic mode deactivated: content protection enabled (window invisible in screen sharing)');
      }
    });

    // Move to next monitor (apenas no Linux quando há múltiplos monitores)
    if (process.platform === 'linux') {
      const displayCount = overlayManager.getDisplayCount();
      if (displayCount >= 2) {
        // Hotkey padrão: Ctrl+Alt+M (ou Cmd+Alt+M no macOS, mas só registra no Linux)
        const moveMonitorHotkey = 'CommandOrControl+Alt+M';
        this.register(moveMonitorHotkey, () => {
          logger.debug('Hotkey: move to next monitor');
          const overlayManager = getOverlayManager();
          const success = overlayManager.moveToNextMonitor();
          if (success) {
            logger.info('Overlay moved to next monitor via hotkey');
          } else {
            logger.warn('Failed to move overlay to next monitor via hotkey');
          }
        });
      }
    }

    // Paste STT text to external application
    // Hotkey: Ctrl+Shift+. (ou Cmd+Shift+. no macOS)
    // Usar "." ao invés de "Period" para garantir que o accelerator é aceito.
    const pasteSttHotkey = (hotkeys as any).pasteSttText ?? 'CommandOrControl+Shift+.';
    this.register(pasteSttHotkey, async () => {
      logger.debug('Hotkey: paste STT text to external app');
      
      const text = getSharedSttText();
      logger.debug({ textLength: text?.length || 0, hasText: hasSharedSttText(), preview: text?.substring(0, 30) }, 'Checking STT text');
      
      if (!text || text.trim() === '') {
        logger.debug('No STT text to paste');
        return;
      }

      try {
        logger.debug({ textLength: text.length }, 'Starting paste operation');
        
        // Usa o AutomationService para colar o texto
        const automationService = getAutomationService();
        await automationService.pasteText(text);

        logger.info({ textLength: text.length }, 'STT text pasted to external app');
      } catch (error) {
        logger.error({ err: error }, 'Failed to paste STT text to external app');
      }
    });

    logger.info('Hotkeys registered');
  }

  /**
   * Registra uma hotkey específica
   */
  register(accelerator: string, callback: () => void | Promise<void>): boolean {
    if (!this.isSafeGlobalAccelerator(accelerator)) {
      logger.warn({ accelerator }, 'Skipped unsafe global hotkey without modifiers');
      return false;
    }

    // Remove hotkey anterior se existir
    if (this.registeredHotkeys.has(accelerator)) {
      globalShortcut.unregister(accelerator);
    }

    const success = globalShortcut.register(accelerator, () => {
      // Executar callback e tratar promises rejeitadas
      Promise.resolve()
        .then(() => callback())
        .catch((error) => {
          logger.error({ err: error, accelerator }, 'Error in hotkey callback');
        });
    });

    if (success) {
      this.registeredHotkeys.add(accelerator);
      logger.debug({ accelerator }, 'Hotkey registered');
    } else {
      logger.warn({ accelerator }, 'Failed to register hotkey (may be in use)');
    }

    return success;
  }

  /**
   * Desregistra uma hotkey específica
   */
  unregister(accelerator: string): void {
    globalShortcut.unregister(accelerator);
    this.registeredHotkeys.delete(accelerator);
    logger.debug({ accelerator }, 'Hotkey unregistered');
  }

  /**
   * Desregistra todas as hotkeys
   */
  unregisterAll(): void {
    globalShortcut.unregisterAll();
    this.registeredHotkeys.clear();
    logger.info('All hotkeys unregistered');
  }

  /**
   * Verifica se uma hotkey está disponível (não em uso)
   */
  isAvailable(accelerator: string): boolean {
    return !globalShortcut.isRegistered(accelerator);
  }

  /**
   * Obtém lista de hotkeys registradas
   */
  getRegistered(): string[] {
    return Array.from(this.registeredHotkeys);
  }
}

// Singleton
let hotkeysManager: HotkeysManager | null = null;

/**
 * Obtém instância singleton do HotkeysManager
 */
export function getHotkeysManager(): HotkeysManager {
  if (!hotkeysManager) {
    hotkeysManager = new HotkeysManager();
  }
  return hotkeysManager;
}
