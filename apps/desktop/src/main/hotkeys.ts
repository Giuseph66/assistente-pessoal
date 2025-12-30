import { globalShortcut, app } from 'electron';
import { getConfigManager } from '@ricky/config';
import { getLogger } from '@ricky/logger';
import { getOverlayManager } from './overlay';
import { getSttController } from './stt/sttService';
import { captureAreaInteractive } from './screenshot';

const logger = getLogger();
const config = getConfigManager();

/**
 * Gerenciador de hotkeys globais
 */
export class HotkeysManager {
  private registeredHotkeys: Set<string> = new Set();

  /**
   * Registra todas as hotkeys configuradas
   */
  registerAll(): void {
    const hotkeys = config.getAll().hotkeys;
    const overlayManager = getOverlayManager();

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
      if (status.state === 'running' || status.state === 'starting') {
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
        const result = await captureAreaInteractive(db);
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

    // Panic mode (apenas altera content protection, mantém janela visível)
    this.register(hotkeys.panicMode, () => {
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

    logger.info('Hotkeys registered');
  }

  /**
   * Registra uma hotkey específica
   */
  register(accelerator: string, callback: () => void): boolean {
    // Remove hotkey anterior se existir
    if (this.registeredHotkeys.has(accelerator)) {
      globalShortcut.unregister(accelerator);
    }

    const success = globalShortcut.register(accelerator, () => {
      try {
        callback();
      } catch (error) {
        logger.error({ err: error, accelerator }, 'Error in hotkey callback');
      }
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
