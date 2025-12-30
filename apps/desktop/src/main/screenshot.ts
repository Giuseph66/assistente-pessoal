import { desktopCapturer, screen, nativeImage } from 'electron';
import { writeFile, mkdir, rename, unlink } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';
import { getConfigManager } from '@ricky/config';
import { getLogger } from '@ricky/logger';
import { DatabaseManager } from './database';
import { spawn } from 'child_process';

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

    const primaryDisplay = screen.getPrimaryDisplay();
    const scaleFactor = primaryDisplay.scaleFactor || 1;
    const thumbnailSize = {
      width: Math.round(primaryDisplay.size.width * scaleFactor),
      height: Math.round(primaryDisplay.size.height * scaleFactor),
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
      // Captura a tela principal (region também precisa da tela completa primeiro)
      const primaryDisplay = screen.getPrimaryDisplay();
      source = sources.find((s) => s.id.startsWith('screen:'));
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
      const scaledX = Math.round(x * scaleFactor);
      const scaledY = Math.round(y * scaleFactor);
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
      db.saveScreenshot({
        file_path: filePath,
        file_size: fileStats.size,
        width: finalWidth,
        height: finalHeight,
        mode: options.mode,
        source_app: source.name,
        monitor_index: options.monitorIndex,
        created_at: Date.now(),
      });
    }

    logger.info({ filePath, width: finalWidth, height: finalHeight }, 'Screenshot saved');

    return {
      success: true,
      path: filePath,
      width: finalWidth,
      height: finalHeight,
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

    const fileStats = await import('fs/promises').then((fs) => fs.stat(filePath));

    if (db) {
      db.saveScreenshot({
        file_path: filePath,
        file_size: fileStats.size,
        width,
        height,
        mode: 'area',
        source_app: displayServer,
        monitor_index: undefined,
        created_at: Date.now(),
      });
    }

    logger.info({ filePath, width, height }, 'Screenshot saved (interactive)');

    return {
      success: true,
      path: filePath,
      width,
      height,
      region: region || undefined,
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
