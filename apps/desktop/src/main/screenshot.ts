import { desktopCapturer, screen, nativeImage, ipcMain } from 'electron';
import { writeFile, mkdir, rename, unlink, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { pathToFileURL } from 'url';
import { existsSync } from 'fs';
import { getConfigManager } from '@neo/config';
import { getLogger } from '@neo/logger';
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
  displayId?: number;
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
    if (typeof options.displayId === 'number') {
      const matched = displays.find((display) => display.id === options.displayId);
      if (matched) targetDisplay = matched;
    } else if (options.region) {
      targetDisplay = screen.getDisplayMatching({
        x: options.region.x,
        y: options.region.y,
        width: options.region.width,
        height: options.region.height,
      });
    } else if (typeof options.monitorIndex === 'number' && displays[options.monitorIndex]) {
      targetDisplay = displays[options.monitorIndex];
    }

    const displayIndex = displays.findIndex((display) => display.id === targetDisplay.id);
    const scaleFactor = targetDisplay.scaleFactor || 1;
    const thumbnailSize = {
      width: Math.round(targetDisplay.size.width * scaleFactor),
      height: Math.round(targetDisplay.size.height * scaleFactor),
    };

    // Native Linux Capture Bypass to avoid desktopCapturer monitor mixups
    if (process.platform === 'linux' && (options.mode === 'fullscreen' || options.mode === 'area')) {
      let captureX = targetDisplay.bounds.x;
      let captureY = targetDisplay.bounds.y;
      let captureW = targetDisplay.bounds.width;
      let captureH = targetDisplay.bounds.height;

      if (options.mode === 'area' && options.region) {
        captureX = options.region.x;
        captureY = options.region.y;
        captureW = options.region.width;
        captureH = options.region.height;
      }

      let capturedByNative = false;
      const savePath = await getScreenshotPath();
      const format = config.get('screenshots', 'format');
      const filename = generateFilename(format);
      const filePath = join(savePath, filename);
      const tempPath = join(savePath, `screenshot-${Date.now()}-raw.png`);

      if (displayServer === 'wayland' && await commandAvailable('grim')) {
        const geometry = `${captureX},${captureY} ${captureW}x${captureH}`;
        const grim = await runCommand('grim', ['-g', geometry, tempPath]);
        if (grim.code === 0) {
          capturedByNative = true;
        } else {
          logger.warn({ stdout: grim.stdout, stderr: grim.stderr }, 'grim failed, falling back to desktopCapturer');
        }
      } else if (displayServer === 'x11' && await commandAvailable('maim')) {
        const geometry = `${captureW}x${captureH}+${captureX}+${captureY}`;
        const maim = await runCommand('maim', ['-g', geometry, tempPath]);
        if (maim.code === 0) {
          capturedByNative = true;
        } else {
          logger.warn({ stdout: maim.stdout, stderr: maim.stderr }, 'maim failed, falling back to desktopCapturer');
        }
      }

      if (capturedByNative) {
        if (format === 'jpg') {
          const image = nativeImage.createFromPath(tempPath);
          const quality = config.get('screenshots', 'quality');
          await writeFile(filePath, image.toJPEG(quality));
          await unlink(tempPath).catch(() => undefined);
        } else {
          await rename(tempPath, filePath).catch(async () => {
            // Fallback to copy/unlink if cross-device link issues
            const data = await readFile(tempPath);
            await writeFile(filePath, data);
            await unlink(tempPath).catch(() => undefined);
          });
        }

        const fileStats = await stat(filePath);
        if (db) {
          const screenshotId = db.saveScreenshot({
            file_path: filePath,
            file_size: fileStats.size,
            width: captureW,
            height: captureH,
            mode: options.mode,
            source_app: displayServer,
            monitor_index: displayIndex >= 0 ? displayIndex : options.monitorIndex,
            created_at: Date.now(),
          });
          logger.info({ filePath, width: captureW, height: captureH, screenshotId }, 'Screenshot saved via native CLI bypass');
          return {
            success: true,
            path: filePath,
            width: captureW,
            height: captureH,
            screenshotId,
            monitorIndex: displayIndex >= 0 ? displayIndex : options.monitorIndex,
            displayId: targetDisplay.id,
            region: options.mode === 'area' ? options.region : undefined,
          };
        }

        logger.info({ filePath, width: captureW, height: captureH }, 'Screenshot saved via native CLI bypass');
        return {
          success: true,
          path: filePath,
          width: captureW,
          height: captureH,
          monitorIndex: displayIndex >= 0 ? displayIndex : options.monitorIndex,
          displayId: targetDisplay.id,
          region: options.mode === 'area' ? options.region : undefined,
        };
      }
    }

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
      const scaledX = Math.floor(localX * scaleFactor);
      const scaledY = Math.floor(localY * scaleFactor);
      const scaledWidth = Math.ceil(width * scaleFactor);
      const scaledHeight = Math.ceil(height * scaleFactor);

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

type ScreenshotSelectorAction = 'single' | 'long' | 'finish' | 'cancel' | 'switch-display';

type ScreenshotSelectorResult = {
  token: string;
  action: ScreenshotSelectorAction;
  region?: { x: number; y: number; width: number; height: number };
  monitorIndex?: number;
  displayId?: number;
};

type SelectorMode = 'initial' | 'long';

type SelectRegionOptions = {
  mode?: SelectorMode;
  sessionId?: string;
  lockSelection?: boolean;
  longCaptureSupported?: boolean;
  longCaptureReason?: string;
};

type SelectedRegionResult = {
  region: LastCaptureRegion;
  action: Exclude<ScreenshotSelectorAction, 'cancel'>;
};

type LongCaptureSupport = {
  supported: boolean;
  reason?: string;
};

type LongCaptureSession = {
  id: string;
  region: LastCaptureRegion;
  format: 'png' | 'jpg';
  quality: number;
  compositePath: string | null;
  width: number;
  height: number;
  monitorIndex?: number;
  displayId?: number;
  db?: DatabaseManager;
  busy: boolean;
  canAppend: boolean;
  longDisabledReason?: string;
};

const SCROLL_STEP_PX = 120;

let activeLongSession: LongCaptureSession | null = null;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isScreenshotResult(value: LongCaptureSession | ScreenshotResult): value is ScreenshotResult {
  return typeof (value as ScreenshotResult).success === 'boolean';
}

async function getLongCaptureSupport(): Promise<LongCaptureSupport> {
  if (detectDisplayServer() !== 'x11') {
    return { supported: false, reason: 'Indisponivel no Wayland' };
  }
  const hasXdotool = await commandAvailable('xdotool');
  if (!hasXdotool) {
    return { supported: false, reason: 'Instale xdotool para captura longa' };
  }
  return { supported: true };
}

type ScreenshotPreviewSource = 'long' | 'single';

type ScreenshotPreviewMeta = {
  sessionId?: string;
  source?: ScreenshotPreviewSource;
};

async function showScreenshotPreview(
  filePath: string,
  displayId?: number,
  monitorIndex?: number,
  meta?: ScreenshotPreviewMeta
): Promise<void> {
  const overlayManager = getOverlayManager();
  const displays = screen.getAllDisplays();
  let targetDisplay = screen.getPrimaryDisplay();

  if (displayId) {
    const matched = displays.find((display) => display.id === displayId);
    if (matched) targetDisplay = matched;
  } else if (typeof monitorIndex === 'number' && displays[monitorIndex]) {
    targetDisplay = displays[monitorIndex];
  }

  overlayManager.showScreenshotPreviewWindow(targetDisplay);
  const win = overlayManager.getScreenshotPreviewWindow();
  if (!win || win.isDestroyed()) return;

  const itemId = meta?.sessionId || `preview-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const payload = {
    item: {
      id: itemId,
      sessionId: meta?.sessionId,
      filePath,
      fileUrl: pathToFileURL(filePath).toString(),
      createdAt: Date.now(),
      source: meta?.source ?? 'single',
    },
  };
  const sendPayload = () => {
    if (!win || win.isDestroyed()) return;
    win.webContents.send('screenshot-preview:data', payload);
  };

  if (win.webContents.isLoadingMainFrame()) {
    win.webContents.once('did-finish-load', sendPayload);
  } else {
    sendPayload();
  }
}

async function scrollRegionDown(region: LastCaptureRegion): Promise<boolean> {
  if (detectDisplayServer() !== 'x11') return false;
  if (!(await commandAvailable('xdotool'))) return false;

  const centerX = Math.round(region.x + region.width / 2);
  const centerY = Math.round(region.y + region.height / 2);
  const steps = Math.max(1, Math.round(region.height / SCROLL_STEP_PX));

  const moveResult = await runCommand('xdotool', ['mousemove', '--sync', String(centerX), String(centerY)]);
  if (moveResult.code !== 0) return false;

  const scrollResult = await runCommand('xdotool', ['click', '--repeat', String(steps), '--delay', '12', '5']);
  return scrollResult.code === 0;
}

async function appendImagesVertical(
  basePath: string,
  appendPath: string,
  format: 'png' | 'jpg',
  quality: number,
  savePath: string
): Promise<{ path: string; width: number; height: number }> {
  const baseBuffer = await readFile(basePath);
  const appendBuffer = await readFile(appendPath);
  const baseImage = nativeImage.createFromBuffer(baseBuffer);
  const appendImage = nativeImage.createFromBuffer(appendBuffer);
  if (baseImage.isEmpty() || appendImage.isEmpty()) {
    throw new Error('invalid image buffer');
  }
  const baseSize = baseImage.getSize();
  const appendSize = appendImage.getSize();
  if (!baseSize.width || !baseSize.height || !appendSize.width || !appendSize.height) {
    throw new Error('invalid image dimensions');
  }

  const outputWidth = Math.max(baseSize.width, appendSize.width);
  const outputHeight = baseSize.height + appendSize.height;
  if (!outputWidth || !outputHeight) {
    throw new Error('invalid composite size');
  }

  const outputBuffer = Buffer.alloc(outputWidth * outputHeight * 4, 0);
  const baseBitmap = baseImage.toBitmap();
  const appendBitmap = appendImage.toBitmap();

  const copyBitmap = (bitmap: Buffer, width: number, height: number, offsetY: number) => {
    const srcStride = width * 4;
    const destStride = outputWidth * 4;
    for (let row = 0; row < height; row += 1) {
      const srcStart = row * srcStride;
      const destStart = (offsetY + row) * destStride;
      bitmap.copy(outputBuffer, destStart, srcStart, srcStart + srcStride);
    }
  };

  copyBitmap(baseBitmap, baseSize.width, baseSize.height, 0);
  copyBitmap(appendBitmap, appendSize.width, appendSize.height, baseSize.height);

  const compositeImage = nativeImage.createFromBitmap(outputBuffer, {
    width: outputWidth,
    height: outputHeight,
  });

  const filename = generateFilename(format);
  const filePath = join(savePath, filename);
  const outputEncoded = format === 'jpg' ? compositeImage.toJPEG(quality) : compositeImage.toPNG();
  await writeFile(filePath, outputEncoded);

  return { path: filePath, width: outputWidth, height: outputHeight };
}

async function captureRegionOnce(region: LastCaptureRegion): Promise<ScreenshotResult> {
  return captureScreenshot({
    mode: 'area',
    region: {
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
    },
    monitorIndex: region.monitorIndex,
    displayId: region.displayId,
  });
}

async function startLongCaptureSession(
  region: LastCaptureRegion,
  db?: DatabaseManager
): Promise<LongCaptureSession | ScreenshotResult> {
  if (activeLongSession) {
    return { success: false, error: 'Captura longa ja em andamento' };
  }

  const format = config.get('screenshots', 'format');
  const quality = config.get('screenshots', 'quality');
  const session: LongCaptureSession = {
    id: `long-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
    region,
    format,
    quality,
    compositePath: null,
    width: 0,
    height: 0,
    monitorIndex: region.monitorIndex,
    displayId: region.displayId,
    db,
    busy: false,
    canAppend: true,
  };
  activeLongSession = session;

  const first = await captureRegionOnce(region);
  if (!first.success || !first.path) {
    activeLongSession = null;
    return first;
  }

  session.compositePath = first.path;
  session.width = first.width || 0;
  session.height = first.height || 0;
  session.monitorIndex = first.monitorIndex ?? session.monitorIndex;
  session.displayId = first.displayId ?? session.displayId;

  const scrolled = await scrollRegionDown(region);
  session.canAppend = scrolled;
  session.longDisabledReason = scrolled ? undefined : 'Nao foi possivel scrollar. Verifique o foco.';

  await showScreenshotPreview(first.path, session.displayId, session.monitorIndex, {
    sessionId: session.id,
    source: 'long',
  });

  return session;
}

async function appendLongCapture(session: LongCaptureSession): Promise<void> {
  if (session.busy || !session.canAppend || !session.compositePath) return;
  session.busy = true;

  const overlayManager = getOverlayManager();
  const previewWindow = overlayManager.getScreenshotPreviewWindow();
  if (previewWindow && !previewWindow.isDestroyed()) {
    previewWindow.hide();
  }

  await delay(220);

  const capture = await captureRegionOnce(session.region);
  if (!capture.success || !capture.path) {
    session.busy = false;
    if (previewWindow && !previewWindow.isDestroyed()) {
      previewWindow.show();
    }
    return;
  }

  try {
    const savePath = await getScreenshotPath();
    const merged = await appendImagesVertical(
      session.compositePath,
      capture.path,
      session.format,
      session.quality,
      savePath
    );

    await Promise.all([
      unlink(session.compositePath).catch(() => undefined),
      unlink(capture.path).catch(() => undefined),
    ]);

    session.compositePath = merged.path;
    session.width = merged.width;
    session.height = merged.height;
    session.monitorIndex = capture.monitorIndex ?? session.monitorIndex;
    session.displayId = capture.displayId ?? session.displayId;

    const scrolled = await scrollRegionDown(session.region);
    session.canAppend = scrolled;
    session.longDisabledReason = scrolled ? undefined : 'Nao foi possivel scrollar. Verifique o foco.';

    await showScreenshotPreview(merged.path, session.displayId, session.monitorIndex, {
      sessionId: session.id,
      source: 'long',
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to append long screenshot');
    if (capture.path) {
      await unlink(capture.path).catch(() => undefined);
    }
    if (session.compositePath) {
      await showScreenshotPreview(session.compositePath, session.displayId, session.monitorIndex, {
        sessionId: session.id,
        source: 'long',
      });
    }
  } finally {
    session.busy = false;
  }
}

async function finishLongCapture(session: LongCaptureSession): Promise<ScreenshotResult> {
  if (!activeLongSession || activeLongSession.id !== session.id) {
    return { success: false, error: 'Sessao longa nao encontrada' };
  }
  if (session.busy) {
    return { success: false, error: 'Captura longa em andamento' };
  }
  session.canAppend = false;

  const compositePath = session.compositePath;
  if (!compositePath) {
    activeLongSession = null;
    return { success: false, error: 'Nenhuma captura longa' };
  }

  let width = session.width;
  let height = session.height;
  if (!width || !height) {
    const image = nativeImage.createFromPath(compositePath);
    const size = image.getSize();
    width = size.width;
    height = size.height;
  }

  let screenshotId: number | undefined;
  if (session.db) {
    const fileStats = await stat(compositePath);
    screenshotId = session.db.saveScreenshot({
      file_path: compositePath,
      file_size: fileStats.size,
      width,
      height,
      mode: 'area',
      source_app: 'long-screenshot',
      monitor_index: session.monitorIndex,
      created_at: Date.now(),
    });
  }

  const result: ScreenshotResult = {
    success: true,
    path: compositePath,
    width,
    height,
    screenshotId,
    monitorIndex: session.monitorIndex,
    displayId: session.displayId,
    region: {
      x: session.region.x,
      y: session.region.y,
      width: session.region.width,
      height: session.region.height,
    },
  };

  activeLongSession = null;
  return result;
}

async function cancelLongCapture(session: LongCaptureSession): Promise<ScreenshotResult> {
  if (session.compositePath) {
    await unlink(session.compositePath).catch(() => undefined);
  }
  const previewWindow = getOverlayManager().getScreenshotPreviewWindow();
  if (previewWindow && !previewWindow.isDestroyed()) {
    previewWindow.hide();
  }
  activeLongSession = null;
  return { success: false, error: 'Selecao cancelada' };
}

async function selectScreenshotRegion(
  lastRegion: LastCaptureRegion | null,
  options?: SelectRegionOptions
): Promise<SelectedRegionResult | null> {
  const overlayManager = getOverlayManager();
  const cursor = screen.getCursorScreenPoint();
  let displays = screen.getAllDisplays();
  let targetDisplay = screen.getDisplayNearestPoint(cursor);

  // Em modo travado (captura longa), mantém monitor da sessão.
  // No modo normal, prioriza monitor sob o cursor para não "saltar" para tela antiga.
  if (options?.lockSelection) {
    if (lastRegion?.displayId) {
      const matched = displays.find((display) => display.id === lastRegion.displayId);
      if (matched) targetDisplay = matched;
    } else if (typeof lastRegion?.monitorIndex === 'number' && displays[lastRegion.monitorIndex]) {
      targetDisplay = displays[lastRegion.monitorIndex];
    }
  }

  overlayManager.showScreenshotSelectorWindow(targetDisplay);
  let win = overlayManager.getScreenshotSelectorWindow();
  if (!win || win.isDestroyed()) {
    return null;
  }

  const token = `selector-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

  return new Promise((resolve) => {
    let resolved = false;
    let isSendingPayload = false;

    const getDisplayIndex = () => {
      displays = screen.getAllDisplays();
      const index = displays.findIndex((display) => display.id === targetDisplay.id);
      return index >= 0 ? index : 0;
    };

    const canSwitchDisplay = () => displays.length > 1 && !options?.lockSelection;

    const cleanup = (result: SelectedRegionResult | null) => {
      if (resolved) return;
      resolved = true;
      ipcMain.removeListener('screenshot-selector:result', onResult);
      if (win && !win.isDestroyed()) {
        win.hide();
        win.close();
      }
      resolve(result);
    };

    const sendPayload = async () => {
      if (isSendingPayload) return;
      isSendingPayload = true;
      try {
        if (!win || win.isDestroyed()) {
          cleanup(null);
          return;
        }
        const longSupport = options?.longCaptureSupported !== undefined
          ? { supported: options.longCaptureSupported, reason: options.longCaptureReason }
          : await getLongCaptureSupport();
        const mode = options?.mode ?? 'initial';
        if (!win || win.isDestroyed()) {
          cleanup(null);
          return;
        }
        const displayIndex = getDisplayIndex();
        win.webContents.send('screenshot-selector:data', {
          token,
          displayBounds: targetDisplay.bounds,
          lastRegion,
          displayId: targetDisplay.id,
          monitorIndex: displayIndex,
          displayCount: displays.length,
          canSwitchDisplay: canSwitchDisplay(),
          longCaptureSupported: longSupport.supported,
          longCaptureReason: longSupport.reason,
          mode,
          sessionId: options?.sessionId,
          lockSelection: options?.lockSelection,
        });
      } finally {
        isSendingPayload = false;
      }
    };

    const switchToNextDisplay = () => {
      if (!canSwitchDisplay()) return;
      displays = screen.getAllDisplays();
      if (displays.length < 2) return;

      const currentIndex = getDisplayIndex();
      const nextDisplay = displays[(currentIndex + 1) % displays.length];
      targetDisplay = nextDisplay;

      overlayManager.showScreenshotSelectorWindow(targetDisplay);
      win = overlayManager.getScreenshotSelectorWindow();
      if (!win || win.isDestroyed()) {
        cleanup(null);
        return;
      }
      void sendPayload();
    };

    const onResult = (_event: Electron.IpcMainEvent, payload: ScreenshotSelectorResult) => {
      if (payload?.token !== token) return;
      if (payload.action === 'switch-display') {
        switchToNextDisplay();
        return;
      }
      if ((payload.action === 'single' || payload.action === 'long' || payload.action === 'finish') && payload.region) {
        const displayIndex = getDisplayIndex();
        cleanup({
          region: {
            x: payload.region.x,
            y: payload.region.y,
            width: payload.region.width,
            height: payload.region.height,
            monitorIndex: payload.monitorIndex ?? displayIndex,
            displayId: payload.displayId ?? targetDisplay.id,
          },
          action: payload.action,
        });
        return;
      }
      cleanup(null);
    };

    const onClosed = () => cleanup(null);
    const initialWin = win;
    if (!initialWin || initialWin.isDestroyed()) {
      cleanup(null);
      return;
    }

    ipcMain.on('screenshot-selector:result', onResult);
    initialWin.once('closed', onClosed);

    if (initialWin.webContents.isLoadingMainFrame()) {
      initialWin.webContents.once('did-finish-load', () => { void sendPayload(); });
    } else {
      void sendPayload();
    }
  });
}

export async function captureAreaInteractiveConfirmed(db?: DatabaseManager): Promise<ScreenshotResult> {
  const overlayManager = getOverlayManager();
  const previewWindow = overlayManager.getScreenshotPreviewWindow();
  const previewWasVisible = Boolean(previewWindow && !previewWindow.isDestroyed() && previewWindow.isVisible());
  if (previewWasVisible) {
    previewWindow?.hide();
  }

  const lastRegion = getLastCaptureRegion();
  const selectedRegion = await selectScreenshotRegion(lastRegion, { mode: 'initial' });
  if (!selectedRegion) {
    if (previewWasVisible && previewWindow && !previewWindow.isDestroyed()) {
      previewWindow.show();
    }
    return { success: false, error: 'Selecao cancelada' };
  }

  const hudWasVisible = overlayManager.isHUDWindowVisible();
  const miniWasVisible = overlayManager.isMiniHUDVisible();

  if (selectedRegion.action === 'long') {
    const longSupport = await getLongCaptureSupport();
    if (!longSupport.supported) {
      if (previewWasVisible && previewWindow && !previewWindow.isDestroyed()) {
        previewWindow.show();
      }
      return { success: false, error: longSupport.reason || 'Captura longa indisponivel' };
    }

    overlayManager.setHUDWindowVisible(false);
    overlayManager.setMiniHUDVisible(false);

    await delay(260);

    const started = await startLongCaptureSession(selectedRegion.region, db);
    if (isScreenshotResult(started)) {
      overlayManager.setHUDWindowVisible(hudWasVisible);
      overlayManager.setMiniHUDVisible(miniWasVisible);
      if (previewWasVisible && previewWindow && !previewWindow.isDestroyed()) {
        previewWindow.show();
      }
      return started;
    }

    const session = started;

    while (true) {
      const nextAction = await selectScreenshotRegion(session.region, {
        mode: 'long',
        sessionId: session.id,
        lockSelection: true,
        longCaptureSupported: session.canAppend,
        longCaptureReason: session.longDisabledReason,
      });

      if (!nextAction) {
        const canceled = await cancelLongCapture(session);
        overlayManager.setHUDWindowVisible(hudWasVisible);
        overlayManager.setMiniHUDVisible(miniWasVisible);
        return canceled;
      }

      if (nextAction.action === 'long') {
        if (!session.canAppend) {
          continue;
        }
        await delay(260);
        await appendLongCapture(session);
        continue;
      }

      if (nextAction.action === 'finish' || nextAction.action === 'single') {
        const finished = await finishLongCapture(session);
        overlayManager.setHUDWindowVisible(hudWasVisible);
        overlayManager.setMiniHUDVisible(miniWasVisible);
        if (finished.success) {
          saveLastCaptureRegion({
            x: session.region.x,
            y: session.region.y,
            width: session.region.width,
            height: session.region.height,
            monitorIndex: session.monitorIndex,
            displayId: session.displayId,
          });
        }
        return finished;
      }
    }
  }

  await delay(260);

  overlayManager.setHUDWindowVisible(false);
  overlayManager.setMiniHUDVisible(false);

  let captureResult: ScreenshotResult;
  try {
    captureResult = await captureScreenshot(
      {
        mode: 'area',
        region: {
          x: selectedRegion.region.x,
          y: selectedRegion.region.y,
          width: selectedRegion.region.width,
          height: selectedRegion.region.height,
        },
        monitorIndex: selectedRegion.region.monitorIndex,
        displayId: selectedRegion.region.displayId,
      },
      db
    );
  } finally {
    overlayManager.setHUDWindowVisible(hudWasVisible);
    overlayManager.setMiniHUDVisible(miniWasVisible);
  }

  if (captureResult.success && captureResult.path) {
    await showScreenshotPreview(
      captureResult.path,
      captureResult.displayId ?? selectedRegion.region.displayId,
      captureResult.monitorIndex ?? selectedRegion.region.monitorIndex,
      { source: 'single' }
    );
  } else if (previewWasVisible && previewWindow && !previewWindow.isDestroyed()) {
    previewWindow.show();
  }

  if (captureResult.success) {
    saveLastCaptureRegion({
      x: selectedRegion.region.x,
      y: selectedRegion.region.y,
      width: selectedRegion.region.width,
      height: selectedRegion.region.height,
      monitorIndex: selectedRegion.region.monitorIndex,
      displayId: selectedRegion.region.displayId,
    });
  }

  return captureResult;
}
