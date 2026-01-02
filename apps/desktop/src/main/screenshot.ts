import { desktopCapturer, screen, nativeImage, ipcMain } from 'electron';
import { writeFile, mkdir, rename, unlink } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';
import { getConfigManager } from '@ricky/config';
import { getLogger } from '@ricky/logger';
import { DatabaseManager } from './database';
import { spawn } from 'child_process';
import { getOverlayManager } from './overlay';

const logger = getLogger();
const config = getConfigManager();

export type ScreenshotMode = 'fullscreen' | 'window' | 'area';

export interface ScreenshotOptions {
  mode: ScreenshotMode;
  windowId?: number;
  monitorIndex?: number;
  region?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ScreenshotResult {
  success: boolean;
  path?: string;
  width?: number;
  height?: number;
  screenshotId?: number;
  monitorIndex?: number;
  displayId?: number;
  region?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  error?: string;
}

/**
 * Detecta o display server (X11 ou Wayland)
 */
function detectDisplayServer(): 'x11' | 'wayland' | 'unknown' {
  const waylandDisplay = process.env.WAYLAND_DISPLAY;
  const x11Display = process.env.DISPLAY;
  const sessionType = process.env.XDG_SESSION_TYPE;

  if (waylandDisplay || sessionType === 'wayland') {
    return 'wayland';
  }

  if (x11Display || sessionType === 'x11') {
    return 'x11';
  }

  return 'unknown';
}

/**
 * Obtém o caminho padrão para salvar screenshots
 */
async function getScreenshotPath(): Promise<string> {
  const configPath = config.get('screenshots', 'savePath');
  if (configPath && existsSync(configPath)) {
    return configPath;
  }

  // Default: ~/.local/share/ricky/screenshots
  const defaultPath = join(homedir(), '.local', 'share', 'ricky', 'screenshots');
  if (!existsSync(defaultPath)) {
    await mkdir(defaultPath, { recursive: true });
  }
  return defaultPath;
}

/**
 * Gera nome de arquivo único para screenshot
 */
function generateFilename(format: 'png' | 'jpg'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `screenshot-${timestamp}.${format}`;
}

/**
 * Captura a tela usando desktopCapturer API
 */
export async function captureScreenshot(
  options: ScreenshotOptions,
  db?: DatabaseManager
): Promise<ScreenshotResult> {
  try {
    const displayServer = detectDisplayServer();
    logger.debug({ displayServer, options }, 'Capturing screenshot');

    const displays = screen.getAllDisplays();
    let targetDisplay = screen.getPrimaryDisplay();
    if (typeof options.monitorIndex === 'number' && displays[options.monitorIndex]) {
      targetDisplay = displays[options.monitorIndex];
    } else if (options.region) {
      targetDisplay = screen.getDisplayMatching({
        x: options.region.x,
        y: options.region.y,
        width: options.region.width,
        height: options.region.height,
      });
    }

    const displayIndex = displays.findIndex((display) => display.id === targetDisplay.id);
    const scaleFactor = targetDisplay.scaleFactor || 1;
    const thumbnailSize = {
      width: Math.round(targetDisplay.size.width * scaleFactor),
      height: Math.round(targetDisplay.size.height * scaleFactor),
    };
    
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize,
    });

    if (sources.length === 0) {
      return {
        success: false,
        error: 'No sources available for capture',
      };
    }

    let source: Electron.DesktopCapturerSource | undefined;

    if (options.mode === 'fullscreen' || options.mode === 'area') {
      const sourceById = sources.find((s) => String(s.display_id) === String(targetDisplay.id));
      const screenSources = sources.filter((s) => s.id.startsWith('screen:'));
      source = sourceById || screenSources[displayIndex] || screenSources[0];
    } else if (options.mode === 'window' && options.windowId) {
      // Captura janela específica
      source = sources.find((s) => s.id === `window:${options.windowId}`);
    } else {
      // Primeira janela disponível
      source = sources.find((s) => s.id.startsWith('window:'));
    }

    if (!source) {
      return {
        success: false,
        error: 'Source not found for capture',
      };
    }

    // Obtém a imagem
    const image = source.thumbnail;
    if (!image) {
      return {
        success: false,
        error: 'Failed to get thumbnail',
      };
    }

    // Salva o screenshot
    const savePath = await getScreenshotPath();
    const format = config.get('screenshots', 'format');
    const filename = generateFilename(format);
    const filePath = join(savePath, filename);

    // Processa e salva com Sharp
    const imgSize = image.getSize();
    
    // Determinar dimensões finais
    let finalWidth: number;
    let finalHeight: number;
    
    if (options.mode === 'area' && options.region) {
      finalWidth = options.region.width;
      finalHeight = options.region.height;
    } else {
      finalWidth = imgSize.width;
      finalHeight = imgSize.height;
    }

    let outputImage = image;

    // Se for modo area, fazer crop na imagem nativa (sem Sharp)
    if (options.mode === 'area' && options.region) {
      const { x, y, width, height } = options.region;
      const localX = x - targetDisplay.bounds.x;
      const localY = y - targetDisplay.bounds.y;
      const scaledX = Math.round(localX * scaleFactor);
      const scaledY = Math.round(localY * scaleFactor);
      const scaledWidth = Math.round(width * scaleFactor);
      const scaledHeight = Math.round(height * scaleFactor);

      logger.debug(
        { scaledX, scaledY, scaledWidth, scaledHeight, imgSize },
        'Cropping screenshot region'
      );

      const validX = Math.max(0, Math.min(scaledX, imgSize.width - 1));
      const validY = Math.max(0, Math.min(scaledY, imgSize.height - 1));
      const validWidth = Math.min(scaledWidth, imgSize.width - validX);
      const validHeight = Math.min(scaledHeight, imgSize.height - validY);

      if (validWidth <= 0 || validHeight <= 0) {
        throw new Error(
          `Invalid crop region: requested (${scaledX},${scaledY}) ${scaledWidth}x${scaledHeight}, image size ${imgSize.width}x${imgSize.height}`
        );
      }

      outputImage = image.crop({ x: validX, y: validY, width: validWidth, height: validHeight });
      finalWidth = validWidth;
      finalHeight = validHeight;
    }

    const outputBuffer =
      format === 'jpg'
        ? outputImage.toJPEG(config.get('screenshots', 'quality'))
        : outputImage.toPNG();

    await writeFile(filePath, outputBuffer);

    // Obter tamanho do arquivo
    const fileStats = await import('fs/promises').then((fs) => fs.stat(filePath));

    // Salva no database
    if (db) {
      const screenshotId = db.saveScreenshot({
        file_path: filePath,
        file_size: fileStats.size,
        width: finalWidth,
        height: finalHeight,
        mode: options.mode,
        source_app: source.name,
        monitor_index: displayIndex >= 0 ? displayIndex : options.monitorIndex,
        created_at: Date.now(),
      });
      logger.info({ filePath, width: finalWidth, height: finalHeight, screenshotId }, 'Screenshot saved');
      return {
        success: true,
        path: filePath,
        width: finalWidth,
        height: finalHeight,
        screenshotId,
        monitorIndex: displayIndex >= 0 ? displayIndex : options.monitorIndex,
        displayId: targetDisplay.id,
        region: options.mode === 'area' ? options.region : undefined,
      };
    }

    logger.info({ filePath, width: finalWidth, height: finalHeight }, 'Screenshot saved');

    return {
      success: true,
      path: filePath,
      width: finalWidth,
      height: finalHeight,
      monitorIndex: displayIndex >= 0 ? displayIndex : options.monitorIndex,
      displayId: targetDisplay.id,
      region: options.mode === 'area' ? options.region : undefined,
    };
  } catch (error: any) {
    logger.error({ err: error, options }, 'Failed to capture screenshot');
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Captura screenshot da tela inteira
 */
export async function captureFullscreen(db?: DatabaseManager): Promise<ScreenshotResult> {
  return captureScreenshot({ mode: 'fullscreen' }, db);
}

/**
 * Captura screenshot de uma janela específica
 */
export async function captureWindow(
  windowId: number,
  db?: DatabaseManager
): Promise<ScreenshotResult> {
  return captureScreenshot({ mode: 'window', windowId }, db);
}

/**
 * Captura screenshot de uma área específica da tela
 */
export async function captureArea(
  x: number,
  y: number,
  width: number,
  height: number,
  db?: DatabaseManager
): Promise<ScreenshotResult> {
  const result = await captureScreenshot(
    {
      mode: 'area',
      region: { x, y, width, height },
    },
    db
  );
  if (result.success) {
    result.region = { x, y, width, height };
  }
  return result;
}

async function runCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (error) => reject(error));
    child.on('close', (code) => resolve({ stdout, stderr, code: code ?? 1 }));
  });
}

async function commandAvailable(command: string): Promise<boolean> {
  try {
    const result = await runCommand('which', [command]);
    return result.code === 0 && result.stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Captura interativa de area via ferramentas do sistema (Wayland/X11)
 */
export async function captureAreaInteractive(db?: DatabaseManager): Promise<ScreenshotResult> {
  try {
    const displayServer = detectDisplayServer();
    const savePath = await getScreenshotPath();
    const format = config.get('screenshots', 'format');
    const filename = generateFilename(format);
    const filePath = join(savePath, filename);
    const tempPath = join(savePath, `screenshot-${Date.now()}-raw.png`);

    let region: { x: number; y: number; width: number; height: number } | null = null;

    if (displayServer === 'wayland') {
      const slurp = await runCommand('slurp', ['-f', '%x,%y,%w,%h']);
      if (slurp.code !== 0 || !slurp.stdout.trim()) {
        return { success: false, error: 'Selecao cancelada' };
      }
      const [x, y, w, h] = slurp.stdout.trim().split(',').map((value) => Number(value));
      region = { x, y, width: w, height: h };
      const geometry = `${x},${y} ${w}x${h}`;
      const grim = await runCommand('grim', ['-g', geometry, tempPath]);
      if (grim.code !== 0) {
        throw new Error(`grim failed: ${grim.stderr || grim.stdout}`);
      }
    } else if (displayServer === 'x11') {
      if (await commandAvailable('slop')) {
        const slop = await runCommand('slop', ['-f', '%x,%y,%w,%h']);
        if (slop.code !== 0 || !slop.stdout.trim()) {
          return { success: false, error: 'Selecao cancelada' };
        }
        const [x, y, w, h] = slop.stdout.trim().split(',').map((value) => Number(value));
        region = { x, y, width: w, height: h };
        const geometry = `${w}x${h}+${x}+${y}`;
        const maim = await runCommand('maim', ['-g', geometry, tempPath]);
        if (maim.code !== 0) {
          throw new Error(`maim failed: ${maim.stderr || maim.stdout}`);
        }
      } else {
        const maim = await runCommand('maim', ['-s', tempPath]);
        if (maim.code !== 0) {
          return { success: false, error: 'Selecao cancelada' };
        }
      }
    } else {
      return { success: false, error: 'Display server nao suportado' };
    }

    if (format === 'jpg') {
      const image = nativeImage.createFromPath(tempPath);
      const quality = config.get('screenshots', 'quality');
      await writeFile(filePath, image.toJPEG(quality));
      await unlink(tempPath).catch(() => undefined);
    } else {
      await rename(tempPath, filePath);
    }

    const image = nativeImage.createFromPath(filePath);
    const { width, height } = image.getSize();

    const display = region
      ? screen.getDisplayMatching({
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
        })
      : screen.getPrimaryDisplay();
    const displays = screen.getAllDisplays();
    const monitorIndex = displays.findIndex((item) => item.id === display.id);

    const fileStats = await import('fs/promises').then((fs) => fs.stat(filePath));

    if (db) {
      const screenshotId = db.saveScreenshot({
        file_path: filePath,
        file_size: fileStats.size,
        width,
        height,
        mode: 'area',
        source_app: displayServer,
        monitor_index: monitorIndex >= 0 ? monitorIndex : undefined,
        created_at: Date.now(),
      });
      logger.info({ filePath, width, height, screenshotId }, 'Screenshot saved (interactive)');
      return {
        success: true,
        path: filePath,
        width,
        height,
        region: region || undefined,
        screenshotId,
        monitorIndex: monitorIndex >= 0 ? monitorIndex : undefined,
        displayId: display.id,
      };
    }

    logger.info({ filePath, width, height }, 'Screenshot saved (interactive)');

    return {
      success: true,
      path: filePath,
      width,
      height,
      region: region || undefined,
      monitorIndex: monitorIndex >= 0 ? monitorIndex : undefined,
      displayId: display.id,
    };
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to capture interactive screenshot');
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * @deprecated Use captureArea instead
 */
export const captureRegion = captureArea;

type LastCaptureRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
  monitorIndex?: number;
  displayId?: number;
};

function getLastCaptureRegion(): LastCaptureRegion | null {
  try {
    const value = config.get('screenshots', 'lastRegion') as LastCaptureRegion | null;
    if (!value) return null;
    if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) return null;
    if (!Number.isFinite(value.width) || !Number.isFinite(value.height)) return null;
    return value;
  } catch {
    return null;
  }
}

function saveLastCaptureRegion(region: LastCaptureRegion): void {
  config.set('screenshots', 'lastRegion', region);
}

type ScreenshotSelectorAction = 'confirm' | 'cancel';

type ScreenshotSelectorResult = {
  token: string;
  action: ScreenshotSelectorAction;
  region?: { x: number; y: number; width: number; height: number };
  monitorIndex?: number;
  displayId?: number;
};

async function selectScreenshotRegion(lastRegion: LastCaptureRegion | null): Promise<LastCaptureRegion | null> {
  const overlayManager = getOverlayManager();
  const displays = screen.getAllDisplays();
  const cursor = screen.getCursorScreenPoint();
  let targetDisplay = screen.getDisplayNearestPoint(cursor);

  if (lastRegion?.displayId) {
    const matched = displays.find((display) => display.id === lastRegion.displayId);
    if (matched) targetDisplay = matched;
  } else if (typeof lastRegion?.monitorIndex === 'number' && displays[lastRegion.monitorIndex]) {
    targetDisplay = displays[lastRegion.monitorIndex];
  }

  overlayManager.showScreenshotSelectorWindow(targetDisplay);
  const win = overlayManager.getScreenshotSelectorWindow();
  if (!win || win.isDestroyed()) {
    return null;
  }

  const displayIndex = displays.findIndex((display) => display.id === targetDisplay.id);
  const token = `selector-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

  return new Promise((resolve) => {
    let resolved = false;

    const cleanup = (result: LastCaptureRegion | null) => {
      if (resolved) return;
      resolved = true;
      ipcMain.removeListener('screenshot-selector:result', onResult);
      if (win && !win.isDestroyed()) {
        win.close();
      }
      resolve(result);
    };

    const onResult = (_event: Electron.IpcMainEvent, payload: ScreenshotSelectorResult) => {
      if (payload?.token !== token) return;
      if (payload.action === 'confirm' && payload.region) {
        cleanup({
          x: payload.region.x,
          y: payload.region.y,
          width: payload.region.width,
          height: payload.region.height,
          monitorIndex: payload.monitorIndex ?? displayIndex,
          displayId: payload.displayId ?? targetDisplay.id,
        });
        return;
      }
      cleanup(null);
    };

    const onClosed = () => cleanup(null);

    ipcMain.on('screenshot-selector:result', onResult);
    win.once('closed', onClosed);

    const sendPayload = () => {
      if (win.isDestroyed()) {
        cleanup(null);
        return;
      }
      win.webContents.send('screenshot-selector:data', {
        token,
        displayBounds: targetDisplay.bounds,
        lastRegion,
        displayId: targetDisplay.id,
        monitorIndex: displayIndex,
      });
    };

    if (win.webContents.isLoadingMainFrame()) {
      win.webContents.once('did-finish-load', sendPayload);
    } else {
      sendPayload();
    }
  });
}

export async function captureAreaInteractiveConfirmed(db?: DatabaseManager): Promise<ScreenshotResult> {
  const lastRegion = getLastCaptureRegion();
  const selectedRegion = await selectScreenshotRegion(lastRegion);
  if (!selectedRegion) {
    return { success: false, error: 'Selecao cancelada' };
  }

  await new Promise((resolve) => setTimeout(resolve, 140));

  const captureResult = await captureScreenshot(
    {
      mode: 'area',
      region: {
        x: selectedRegion.x,
        y: selectedRegion.y,
        width: selectedRegion.width,
        height: selectedRegion.height,
      },
      monitorIndex: selectedRegion.monitorIndex,
    },
    db
  );

  if (captureResult.success) {
    saveLastCaptureRegion({
      x: selectedRegion.x,
      y: selectedRegion.y,
      width: selectedRegion.width,
      height: selectedRegion.height,
      monitorIndex: selectedRegion.monitorIndex,
      displayId: selectedRegion.displayId,
    });
  }

  return captureResult;
}
