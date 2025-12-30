import { BrowserWindow, ipcMain, app } from 'electron';
import { TranslationStartOptions, TranslationResult, TranslationStatus } from '@ricky/shared';
import { ScreenTranslateService } from '../services/translation/ScreenTranslateService';
import { writeFile } from 'fs/promises';
import { join } from 'path';

const broadcast = (channel: string, payload: any) => {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (win.isDestroyed()) return;
    const contents = win.webContents;
    if (contents.isDestroyed() || contents.isCrashed()) return;
    try {
      contents.send(channel, payload);
    } catch {
      // ignore
    }
  });
};

export function registerTranslationIpc(service: ScreenTranslateService): void {
  service.on('status', (status: TranslationStatus) => {
    broadcast('translation.status', status);
  });

  service.on('result', (result: TranslationResult) => {
    broadcast('translation.result', result);
  });

  service.on('error', (payload: { message: string }) => {
    broadcast('translation.error', payload);
  });

  ipcMain.handle('translation.start', async (_event, options: TranslationStartOptions) => {
    await service.start(options);
    return { success: true };
  });

  ipcMain.handle('translation.stop', async () => {
    await service.stop();
    return { success: true };
  });

  ipcMain.handle('translation.refresh', async () => {
    await service.refresh();
    return { success: true };
  });

  ipcMain.handle('translation.getStatus', async () => {
    return service.getStatus();
  });

  ipcMain.handle('translation.export', async (_event, { format, content }: { format: 'txt' | 'json'; content: string }) => {
    const downloadsDir = app.getPath('downloads');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `ricky-translation-${timestamp}.${format}`;
    const outputPath = join(downloadsDir, filename);
    await writeFile(outputPath, content, 'utf-8');
    return { path: outputPath };
  });
}
