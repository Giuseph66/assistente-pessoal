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
}
