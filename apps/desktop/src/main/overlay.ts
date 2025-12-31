import { BrowserWindow, screen } from 'electron';
import { join } from 'path';
import { is } from '@electron-toolkit/utils';
import { getConfigManager } from '@ricky/config';
import { getLogger } from '@ricky/logger';

const logger = getLogger();
const config = getConfigManager();

/**
 * Gerenciador da janela overlay
 */
export class OverlayManager {
  private overlayWindow: BrowserWindow | null = null;
  private isVisible: boolean = true;
  private currentContentProtection: boolean | null = null;
  private isLinux: boolean = process.platform === 'linux';
  private translationWindow: BrowserWindow | null = null;
  private translationApplyTimer: NodeJS.Timeout | null = null;

  /**
   * Verifica se a plataforma suporta content protection nativo
   * setContentProtection só funciona no Windows e macOS
   */
  private supportsContentProtection(): boolean {
    return process.platform === 'win32' || process.platform === 'darwin';
  }

  /**
   * Entra no modo de tradução (janela cobre a tela inteira)
   */
  enterTranslationMode(): void {
    this.ensureTranslationWindow();
    if (!this.translationWindow) return;

    this.applyTranslationLayout(this.translationWindow);
    if (this.translationApplyTimer) {
      clearTimeout(this.translationApplyTimer);
    }
    this.translationApplyTimer = setTimeout(() => {
      if (this.translationWindow) {
        this.applyTranslationLayout(this.translationWindow);
      }
    }, 150);

    this.translationWindow.show();
    this.translationWindow.focus();
  }

  ensureTranslationWindow(): void {
    if (!this.translationWindow) {
      this.createTranslationWindow();
    }
  }

  /**
   * Sai do modo de tradução e restaura o tamanho anterior
   */
  exitTranslationMode(): void {
    if (this.translationApplyTimer) {
      clearTimeout(this.translationApplyTimer);
      this.translationApplyTimer = null;
    }
    if (this.translationWindow && this.translationWindow.isVisible()) {
      this.translationWindow.hide();
    }
  }

  hideTranslationWindow(): void {
    if (this.translationWindow && this.translationWindow.isVisible()) {
      this.translationWindow.hide();
    }
  }

  showTranslationWindow(): void {
    if (!this.translationWindow) {
      this.createTranslationWindow();
    }
    if (!this.translationWindow) return;
    this.applyTranslationLayout(this.translationWindow);
    this.translationWindow.show();
  }

  isTranslationWindowVisible(): boolean {
    return Boolean(this.translationWindow && this.translationWindow.isVisible());
  }

  private applyTranslationLayout(target: BrowserWindow): void {
    const reference = this.overlayWindow ? this.overlayWindow.getBounds() : screen.getPrimaryDisplay().bounds;
    const display = screen.getDisplayMatching(reference);
    target.setResizable(true);
    target.setMaximizable(true);
    target.setFullScreenable(true);
    target.setBounds(display.bounds, true);
    target.setPosition(display.bounds.x, display.bounds.y);
    target.setSize(display.bounds.width, display.bounds.height, true);
    target.setFullScreen(true);
    target.maximize();
    target.setAlwaysOnTop(true, 'screen-saver');
  }

  /**
   * Cria a janela overlay
   */
  createWindow(): void {
    if (this.overlayWindow) {
      logger.warn('Overlay window already exists');
      return;
    }

    const overlayConfig = config.getAll().overlay;
    const { position, size, opacity, alwaysOnTop, presentationMode } = overlayConfig;
    // contentProtection pode não estar no tipo ainda, mas está no schema
    const contentProtection = (overlayConfig as any).contentProtection !== false; // Default: true

    this.overlayWindow = new BrowserWindow({
      width: size.width || 1200,
      height: size.height || 800,
      x: position.x,
      y: position.y,
      frame: false,
      transparent: true,
      alwaysOnTop: alwaysOnTop,
      skipTaskbar: true,
      resizable: true,
      movable: true,
      center: true,
      focusable: true,
      hasShadow: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    });

    // Carrega o conteúdo
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.overlayWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#overlay`);
    } else {
      this.overlayWindow.loadFile(join(__dirname, '../renderer/index.html'), {
        hash: 'overlay',
      });
    }

    // Aplica opacidade via CSS (mais confiável que opacity nativo)
    this.overlayWindow.webContents.on('did-finish-load', () => {
      this.setOpacity(opacity);
      if (presentationMode) {
        this.hide();
      }
    });

    // Ativa content protection para tornar a janela invisível no compartilhamento de tela
    // Isso previne que a janela seja capturada por Google Meet, Zoom, etc.
    // Usa once() para evitar múltiplas execuções e verifica estado interno antes de aplicar
    this.overlayWindow.once('ready-to-show', () => {
      // Usa estado interno se disponível, senão usa config
      const shouldProtect = this.currentContentProtection !== null
        ? this.currentContentProtection
        : (contentProtection !== false);

      // Aplica content protection (que já verifica plataforma internamente)
      this.setContentProtection(shouldProtect);
    });

    // Salva posição e tamanho quando mudados
    this.overlayWindow.on('moved', () => {
      if (this.overlayWindow) {
        const [x, y] = this.overlayWindow.getPosition();
        config.set('overlay', 'position', { x, y });
        logger.debug({ x, y }, 'Overlay position saved');
      }
    });

    this.overlayWindow.on('resized', () => {
      if (this.overlayWindow) {
        const [width, height] = this.overlayWindow.getSize();
        config.set('overlay', 'size', { width, height });
        logger.debug({ width, height }, 'Overlay size saved');
      }
    });

    // Permite foco para edicao; so desfoca no modo apresentacao
    this.overlayWindow.on('focus', () => {
      if (config.getAll().overlay.presentationMode && this.overlayWindow) {
        this.overlayWindow.blur();
      }
    });

    logger.info('Overlay window created');
  }

  /**
   * Cria a janela de overlay de tradução (tela cheia)
   */
  private createTranslationWindow(): void {
    if (this.translationWindow) {
      return;
    }

    this.translationWindow = new BrowserWindow({
      width: 800,
      height: 600,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: true,
      movable: false,
      focusable: true,
      hasShadow: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
      show: false,
    });

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.translationWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#translation-overlay`);
    } else {
      this.translationWindow.loadFile(join(__dirname, '../renderer/index.html'), {
        hash: 'translation-overlay',
      });
    }

    this.translationWindow.on('closed', () => {
      this.translationWindow = null;
    });
  }

  /**
   * Mostra a janela overlay
   * @param enableContentProtection Se true, também habilita content protection
   */
  show(enableContentProtection: boolean = false): void {
    if (!this.overlayWindow) {
      this.createWindow();
      return;
    }

    if (!this.overlayWindow.isVisible()) {
      this.overlayWindow.show();
      this.isVisible = true;

      // Se solicitado, também habilita content protection
      if (enableContentProtection) {
        this.setContentProtection(true); // Usa método que já verifica plataforma
      }

      logger.debug('Overlay shown');
    }
  }

  /**
   * Oculta a janela overlay
   * @param disableContentProtection Se true, também desabilita content protection
   */
  hide(disableContentProtection: boolean = false): void {
    if (this.overlayWindow && this.overlayWindow.isVisible()) {
      this.overlayWindow.hide();
      this.isVisible = false;

      // Se solicitado, também desabilita content protection para garantir que não apareça
      if (disableContentProtection) {
        this.setContentProtection(false); // Usa método que já verifica plataforma
      }

      logger.debug('Overlay hidden');
    }
  }

  /**
   * Alterna visibilidade do overlay
   */
  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Define a opacidade do overlay (0-100)
   */
  setOpacity(opacity: number): void {
    if (!this.overlayWindow) return;

    const clampedOpacity = Math.max(0, Math.min(100, opacity));
    config.set('overlay', 'opacity', clampedOpacity);

    // Aplica via CSS
    this.overlayWindow.webContents.executeJavaScript(
      `document.documentElement.style.opacity = ${clampedOpacity / 100}`
    );

    logger.debug({ opacity: clampedOpacity }, 'Overlay opacity set');
  }

  /**
   * Define o modo apresentação (oculta instantaneamente)
   */
  setPresentationMode(enabled: boolean): void {
    config.set('overlay', 'presentationMode', enabled);
    if (enabled) {
      this.hide();
    } else {
      this.show();
    }
    logger.debug({ enabled }, 'Presentation mode toggled');
  }

  /**
   * Aplica workarounds específicos para Linux (já que setContentProtection não funciona)
   * No Linux, não há como esconder completamente da captura, mas podemos tornar a janela mais discreta
   */
  private applyLinuxWorkarounds(enabled: boolean): void {
    if (!this.isLinux || !this.overlayWindow) return;

    // Workarounds já aplicados na criação da janela:
    // - skipTaskbar: true ✓
    // - alwaysOnTop: true ✓
    // - frameless: true ✓
    // - transparent: true ✓

    // Nota: Electron não expõe diretamente override_redirect ou WM hints avançados
    // As propriedades básicas já estão configuradas para tornar a janela discreta

    if (enabled) {
      logger.debug('Linux workarounds active (skipTaskbar, alwaysOnTop, frameless already set)');
      logger.warn('Content protection is limited on Linux - app may still appear in screen sharing. Consider sharing specific windows instead of entire screen.');
    } else {
      logger.debug('Linux workarounds disabled');
    }
  }

  /**
   * Define o content protection (torna janela invisível no compartilhamento de tela)
   * @param enabled true para ocultar no screen sharing, false para permitir captura
   */
  setContentProtection(enabled: boolean): void {
    if (!this.overlayWindow) {
      logger.warn('Cannot set content protection: overlay window not created');
      return;
    }

    // Atualiza estado interno
    this.currentContentProtection = enabled;
    config.set('overlay', 'contentProtection', enabled);

    if (this.supportsContentProtection()) {
      // Windows/macOS: usar API nativa
      try {
        this.overlayWindow.setContentProtection(enabled);
        logger.info({ enabled, platform: process.platform }, 'Content protection set via native API');
      } catch (error) {
        logger.warn({ err: error, enabled, platform: process.platform }, 'Failed to set content protection');
      }
    } else {
      // Linux: aplicar workarounds (setContentProtection não funciona no Linux)
      this.applyLinuxWorkarounds(enabled);
      logger.info({ enabled, platform: 'linux' }, 'Content protection workarounds applied (Linux limitation - setContentProtection not supported)');
    }
  }

  /**
   * Move a janela para uma posição específica
   */
  setPosition(x: number, y: number): void {
    if (this.overlayWindow) {
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.workAreaSize;

      // Garante que a janela fique dentro dos limites da tela
      const clampedX = Math.max(0, Math.min(x, width - 100));
      const clampedY = Math.max(0, Math.min(y, height - 100));

      this.overlayWindow.setPosition(clampedX, clampedY);
      config.set('overlay', 'position', { x: clampedX, y: clampedY });
    }
  }

  /**
   * Redimensiona a janela
   */
  setSize(width: number, height: number): void {
    if (this.overlayWindow) {
      this.overlayWindow.setSize(width, height);
      config.set('overlay', 'size', { width, height });
    }
  }

  /**
   * Obtém a janela overlay
   */
  getWindow(): BrowserWindow | null {
    return this.overlayWindow;
  }

  /**
   * Verifica se o overlay está visível
   */
  isOverlayVisible(): boolean {
    return this.isVisible && this.overlayWindow?.isVisible() === true;
  }

  /**
   * Obtém o estado atual do content protection
   */
  getCurrentContentProtection(): boolean | null {
    return this.currentContentProtection;
  }

  /**
   * Obtém informações sobre a plataforma e suporte a content protection
   */
  getPlatformInfo(): { platform: string; supportsContentProtection: boolean } {
    return {
      platform: process.platform,
      supportsContentProtection: this.supportsContentProtection()
    };
  }

  /**
   * Obtém o número de monitores conectados
   */
  getDisplayCount(): number {
    try {
      const displays = screen.getAllDisplays();
      return displays.length;
    } catch (error) {
      logger.warn({ err: error }, 'Failed to get display count');
      return 1; // Fallback: assume 1 monitor
    }
  }

  /**
   * Move a janela overlay para o próximo monitor disponível
   * Preserva a posição relativa dentro do workArea
   */
  moveToNextMonitor(): boolean {
    if (!this.overlayWindow) {
      logger.warn('Cannot move to next monitor: overlay window not created');
      return false;
    }

    try {
      const displays = screen.getAllDisplays();
      if (displays.length < 2) {
        logger.debug('Only one display available, cannot move to next monitor');
        return false; // Nada a fazer com 1 monitor
      }

      const bounds = this.overlayWindow.getBounds();
      const currentDisplay = screen.getDisplayMatching(bounds);

      const currentIndex = displays.findIndex(d => d.id === currentDisplay.id);
      if (currentIndex === -1) {
        logger.warn('Current display not found in displays list');
        return false;
      }

      const nextIndex = (currentIndex + 1) % displays.length;
      const nextDisplay = displays[nextIndex];

      // Usar workArea para respeitar barras/docks
      const wa = nextDisplay.workArea;

      // Preservar posição relativa dentro do workArea
      const relativeX = bounds.x - currentDisplay.workArea.x;
      const relativeY = bounds.y - currentDisplay.workArea.y;

      // Calcular nova posição dentro do workArea do próximo monitor
      const newX = wa.x + Math.max(0, Math.min(relativeX, wa.width - bounds.width));
      const newY = wa.y + Math.max(0, Math.min(relativeY, wa.height - bounds.height));

      this.overlayWindow.setBounds({
        x: newX,
        y: newY,
        width: bounds.width,
        height: bounds.height
      }, true);

      // Atualizar posição salva na config
      config.set('overlay', 'position', { x: newX, y: newY });

      this.overlayWindow.focus();

      logger.info({
        from: currentDisplay.id,
        to: nextDisplay.id,
        newPosition: { x: newX, y: newY }
      }, 'Overlay moved to next monitor');

      return true;
    } catch (error) {
      logger.error({ err: error }, 'Failed to move overlay to next monitor');
      return false;
    }
  }

  private hudWindow: BrowserWindow | null = null;
  private settingsWindow: BrowserWindow | null = null;
  private historyWindow: BrowserWindow | null = null;
  private commandBarWindow: BrowserWindow | null = null;

  /**
   * Cria a janela HUD (Persistent Bottom Bar)
   */
  createHUDWindow(): void {
    if (this.hudWindow) return;

    const { width } = screen.getPrimaryDisplay().workAreaSize;

    this.hudWindow = new BrowserWindow({
      width: 800,
      height: 120,
      x: (width - 800) / 2,
      y: screen.getPrimaryDisplay().workAreaSize.height - 140,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: false,
      movable: true,
      skipTaskbar: true,
      center: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      }
    });

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.hudWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#hud`);
    } else {
      this.hudWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'hud' });
    }

    this.hudWindow.on('closed', () => { this.hudWindow = null; });
  }

  /**
   * Cria a janela de Configurações
   */
  createSettingsWindow(): void {
    if (this.settingsWindow) {
      this.settingsWindow.show();
      this.settingsWindow.focus();
      return;
    }

    this.settingsWindow = new BrowserWindow({
      width: 900,
      height: 700,
      frame: false, // Frameless to avoid duplicate controls
      transparent: true,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      }
    });

    // Remove menu bar
    this.settingsWindow.setMenuBarVisibility(false);

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.settingsWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#settings`);
    } else {
      this.settingsWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'settings' });
    }

    this.settingsWindow.on('closed', () => { this.settingsWindow = null; });
  }

  /**
   * Cria a janela de Histórico
   */
  createHistoryWindow(): void {
    if (this.historyWindow) {
      this.historyWindow.show();
      this.historyWindow.focus();
      return;
    }

    this.historyWindow = new BrowserWindow({
      width: 1000,
      height: 800,
      frame: false, // Frameless
      transparent: true,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      }
    });

    this.historyWindow.setMenuBarVisibility(false);

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.historyWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#history`);
    } else {
      this.historyWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'history' });
    }

    this.historyWindow.on('closed', () => { this.historyWindow = null; });
  }

  /**
   * Cria a janela Command Bar (Spotlight style)
   */
  createCommandBarWindow(): void {
    if (this.commandBarWindow) {
      this.commandBarWindow.show();
      this.commandBarWindow.focus();
      return;
    }

    const { width } = screen.getPrimaryDisplay().workAreaSize;

    this.commandBarWindow = new BrowserWindow({
      width: 800,
      height: 600, // Height for results
      x: (width - 800) / 2,
      y: 200,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: false,
      movable: false,
      skipTaskbar: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      }
    });

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.commandBarWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#command-bar`);
    } else {
      this.commandBarWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'command-bar' });
    }

    this.commandBarWindow.on('blur', () => {
      // Auto close on blur like Spotlight?
      // this.commandBarWindow?.hide();
    });

    this.commandBarWindow.on('closed', () => { this.commandBarWindow = null; });
  }

  /**
   * Fecha todas as janelas
   */
  destroy(): void {
    if (this.overlayWindow) {
      this.overlayWindow.destroy();
      this.overlayWindow = null;
      this.isVisible = false;
      logger.info('Overlay window destroyed');
    }
    if (this.translationWindow) {
      this.translationWindow.destroy();
      this.translationWindow = null;
      logger.info('Translation overlay window destroyed');
    }
    if (this.hudWindow) this.hudWindow.destroy();
    if (this.settingsWindow) this.settingsWindow.destroy();
    if (this.historyWindow) this.historyWindow.destroy();
    if (this.commandBarWindow) this.commandBarWindow.destroy();
  }
}

// Singleton
let overlayManager: OverlayManager | null = null;

/**
 * Obtém instância singleton do OverlayManager
 */
export function getOverlayManager(): OverlayManager {
  if (!overlayManager) {
    overlayManager = new OverlayManager();
  }
  return overlayManager;
}
