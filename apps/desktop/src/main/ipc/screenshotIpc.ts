import { ipcMain } from 'electron';
import { readFile } from 'fs/promises';
import { extname } from 'path';

export function registerScreenshotIpc(): void {
  ipcMain.removeHandler('screenshot:read');
  ipcMain.handle('screenshot:read', async (_event, { filePath }) => {
    try {
      const data = await readFile(filePath as string);
      const ext = extname(filePath as string).toLowerCase();
      const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
      return { buffer: data, mimeType };
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return { buffer: null, mimeType: null, error: 'not_found' };
      }
      throw error;
    }
  });
}
