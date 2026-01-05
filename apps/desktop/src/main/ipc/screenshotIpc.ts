import { ipcMain, screen, shell } from 'electron';
import { readFile } from 'fs/promises';
import { extname } from 'path';
import { getOverlayManager } from '../overlay';

const PREVIEW_COLLAPSED_SIZE = { width: 320, height: 220 };
const PREVIEW_EXPANDED_SIZE = { width: 520, height: 640 };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function resizePreviewWindow(expanded: boolean): void {
  const overlayManager = getOverlayManager();
  const win = overlayManager.getScreenshotPreviewWindow();
  if (!win || win.isDestroyed()) return;

  const bounds = win.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const workArea = display.workArea;
  const rawSize = expanded ? PREVIEW_EXPANDED_SIZE : PREVIEW_COLLAPSED_SIZE;
  const size = {
    width: Math.min(rawSize.width, workArea.width - 20),
    height: Math.min(rawSize.height, workArea.height - 20),
  };

  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const targetX = Math.round(centerX - size.width / 2);
  const targetY = Math.round(centerY - size.height / 2);

  const clampedX = clamp(targetX, workArea.x, workArea.x + workArea.width - size.width);
  const clampedY = clamp(targetY, workArea.y, workArea.y + workArea.height - size.height);

  win.setBounds({ x: clampedX, y: clampedY, width: size.width, height: size.height }, true);
}

export function registerScreenshotIpc(): void {
  ipcMain.removeHandler('screenshot:read');
  ipcMain.handle('screenshot:read', async (_event, { filePath }) => {
    try {
      const data = await readFile(filePath as string);
      const ext = extname(filePath as string).toLowerCase();
      const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
      // Convert Buffer to base64 string for renderer
      const base64 = data.toString('base64');
      return { base64, mimeType };
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return { base64: null, mimeType: null, error: 'not_found' };
      }
      throw error;
    }
  });

  ipcMain.removeHandler('screenshot:open');
  ipcMain.handle('screenshot:open', async (_event, { filePath }) => {
    if (!filePath) {
      return { success: false, error: 'missing_path' };
    }
    const result = await shell.openPath(String(filePath));
    if (result) {
      return { success: false, error: result };
    }
    return { success: true };
  });

  ipcMain.removeAllListeners('screenshot-preview:resize');
  ipcMain.on('screenshot-preview:resize', (_event, { expanded }) => {
    resizePreviewWindow(Boolean(expanded));
  });
}
