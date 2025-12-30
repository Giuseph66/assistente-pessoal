import { BrowserWindow, ipcMain } from 'electron';
import { RecorderService } from '../audio/recording/RecorderService';
import { RecorderStartOptions, RecorderStatus } from '@ricky/shared';

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

export function registerRecorderIpc(recorder: RecorderService): void {
  ipcMain.handle('recorder.start', async (_event, options: RecorderStartOptions) => {
    return recorder.start(options);
  });

  ipcMain.handle('recorder.stop', async () => recorder.stop());
  ipcMain.handle('recorder.getStatus', async () => recorder.getStatus());
  ipcMain.handle('recorder.listRecent', async (_event, limit?: number) => recorder.listRecent(limit));
  ipcMain.handle('recorder.delete', async (_event, path: string) => recorder.deleteRecording(path));
  ipcMain.handle('recorder.getFileUrl', async (_event, path: string) => recorder.getFileUrl(path));
  ipcMain.handle('recorder.openFolder', async () => recorder.openFolder());
  ipcMain.handle('recorder.open', async (_event, path: string) => recorder.openFile(path));

  recorder.onStatus((status: RecorderStatus) => broadcast('recorder.status', status));
  recorder.onError((message: string) => broadcast('recorder.error', { message }));
  recorder.onLevel((payload: { level: number; rms: number; ts: number }) =>
    broadcast('recorder.level', payload)
  );
}
