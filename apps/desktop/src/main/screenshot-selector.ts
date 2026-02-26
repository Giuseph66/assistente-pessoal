import { BrowserWindow, screen } from 'electron';
import { join } from 'path';
import { getLogger } from '@neo/logger';

const logger = getLogger();

export interface SelectionResult {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type SelectionCallback = (result: SelectionResult) => void;
export type CancelCallback = () => void;

/**
 * Gerenciador do seletor de área para screenshots
 */
export class ScreenshotSelector {
  private selectorWindow: BrowserWindow | null = null;
  private onSelectCallback: SelectionCallback | null = null;
  private onCancelCallback: CancelCallback | null = null;
  private isSelecting: boolean = false;
  private startX: number = 0;
  private startY: number = 0;
  private pendingResult: SelectionResult | null = null;

  /**
   * Inicia o seletor de área
   */
  start(onSelect: SelectionCallback, onCancel: CancelCallback): void {
    if (this.selectorWindow) {
      logger.warn('Selector already active');
      return;
    }

    this.onSelectCallback = onSelect;
    this.onCancelCallback = onCancel;
    this.isSelecting = false;

    const displays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    const { x, y } = primaryDisplay.bounds;

    // Cria janela transparente fullscreen
    this.selectorWindow = new BrowserWindow({
      width,
      height,
      x,
      y,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: true,
      resizable: false,
      movable: false,
      hasShadow: false,
      show: false, // Não mostrar até carregar
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        sandbox: false,
      },
    });

    // HTML simples para o seletor visual
    // O seletor usa eventos de mouse/keyboard e envia dados via IPC
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      cursor: crosshair;
      background: rgba(0, 0, 0, 0.3);
    }
    #overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      pointer-events: none;
    }
    #selection-box {
      position: absolute;
      border: 2px solid #00aaff;
      background: rgba(0, 170, 255, 0.1);
      pointer-events: none;
      display: none;
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
    }
    #selection-info {
      position: absolute;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      pointer-events: none;
      display: none;
    }
    #instructions {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: white;
      font-family: sans-serif;
      font-size: 18px;
      text-align: center;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="overlay"></div>
  <div id="instructions">
    Clique e arraste para selecionar uma área<br>
    Pressione ESC para cancelar
  </div>
  <div id="selection-box"></div>
  <div id="selection-info"></div>
  <script>
    const { ipcRenderer } = require('electron');
    const overlay = document.getElementById('overlay');
    const selectionBox = document.getElementById('selection-box');
    const selectionInfo = document.getElementById('selection-info');
    const instructions = document.getElementById('instructions');
    let isSelecting = false;
    let startX = 0;
    let startY = 0;

    document.addEventListener('mousedown', (e) => {
      isSelecting = true;
      startX = e.clientX;
      startY = e.clientY;
      selectionBox.style.display = 'block';
      selectionInfo.style.display = 'block';
      instructions.style.display = 'none';
      updateSelection(e);
    });

    document.addEventListener('mousemove', (e) => {
      if (isSelecting) {
        updateSelection(e);
      }
    });

    function hideOverlay() {
      overlay.style.background = 'rgba(0, 0, 0, 0)';
      selectionBox.style.display = 'none';
      selectionInfo.style.display = 'none';
      instructions.style.display = 'none';
      document.body.style.background = 'transparent';
    }

    document.addEventListener('mouseup', (e) => {
      if (isSelecting) {
        isSelecting = false;
        const x = Math.min(startX, e.clientX);
        const y = Math.min(startY, e.clientY);
        const width = Math.abs(e.clientX - startX);
        const height = Math.abs(e.clientY - startY);
        hideOverlay();
        
        if (width > 10 && height > 10) {
          ipcRenderer.send('screenshot-selector:finish', { x, y, width, height });
        } else {
          ipcRenderer.send('screenshot-selector:cancel');
        }
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hideOverlay();
        ipcRenderer.send('screenshot-selector:cancel');
      }
    });

    function updateSelection(e) {
      const x = Math.min(startX, e.clientX);
      const y = Math.min(startY, e.clientY);
      const width = Math.abs(e.clientX - startX);
      const height = Math.abs(e.clientY - startY);

      selectionBox.style.left = x + 'px';
      selectionBox.style.top = y + 'px';
      selectionBox.style.width = width + 'px';
      selectionBox.style.height = height + 'px';

      selectionInfo.textContent = width + ' × ' + height;
      selectionInfo.style.left = (x + width / 2 - 40) + 'px';
      selectionInfo.style.top = (y - 25) + 'px';
    }
  </script>
</body>
</html>
    `;

    this.selectorWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    this.selectorWindow.webContents.once('did-finish-load', () => {
      if (this.selectorWindow) {
        // Ativa content protection para tornar a janela invisível no compartilhamento de tela
        try {
          this.selectorWindow.setContentProtection(true);
          logger.debug('Content protection enabled for screenshot selector window');
        } catch (error) {
          logger.warn({ err: error }, 'Failed to set content protection for screenshot selector');
        }
        this.selectorWindow.show();
        this.selectorWindow.focus();
        logger.debug('Screenshot selector loaded and shown');
      }
    });

    this.selectorWindow.on('closed', () => {
      logger.debug('Screenshot selector window closed');
      if (this.pendingResult && this.onSelectCallback) {
        const result = this.pendingResult;
        const callback = this.onSelectCallback;
        this.pendingResult = null;
        callback(result);
      }
      this.selectorWindow = null;
      this.onSelectCallback = null;
      this.onCancelCallback = null;
    });

    logger.info('Screenshot selector started');
  }

  /**
   * Cancela a seleção
   */
  cancel(): void {
    if (this.selectorWindow) {
      this.pendingResult = null;
      this.selectorWindow.close();
      if (this.onCancelCallback) {
        this.onCancelCallback();
      }
      logger.debug('Screenshot selector cancelled');
    }
  }

  /**
   * Finaliza a seleção com coordenadas
   */
  finish(x: number, y: number, width: number, height: number): void {
    logger.debug({ x, y, width, height }, 'Screenshot selection finish called');
    if (this.selectorWindow) {
      const result: SelectionResult = { x, y, width, height };
      this.pendingResult = result;
      this.selectorWindow.hide();
      this.selectorWindow.close();
    } else {
      logger.warn('Screenshot selector window not available when finish called');
    }
  }

  /**
   * Destroi o seletor
   */
  destroy(): void {
    if (this.selectorWindow) {
      this.selectorWindow.close();
      this.selectorWindow = null;
      this.onSelectCallback = null;
      this.onCancelCallback = null;
      logger.info('Screenshot selector destroyed');
    }
  }

  /**
   * Verifica se o seletor está ativo
   */
  isActive(): boolean {
    return this.selectorWindow !== null;
  }
}

// Singleton
let screenshotSelector: ScreenshotSelector | null = null;

/**
 * Obtém instância singleton do ScreenshotSelector
 */
export function getScreenshotSelector(): ScreenshotSelector {
  if (!screenshotSelector) {
    screenshotSelector = new ScreenshotSelector();
  }
  return screenshotSelector;
}
