import { BrowserWindow, ipcMain } from 'electron';
import { STTFinalEvent, STTPartialEvent, STTStatus } from '@ricky/shared';
import { SystemSttController } from '../stt/SystemSttController';

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

export function registerSystemSttIpc(controller: SystemSttController): void {
  ipcMain.handle('systemStt.start', async (_event, options: { sourceId: string }) => {
    await controller.start(options);
    return true;
  });

  ipcMain.handle('systemStt.stop', async () => {
    await controller.stop();
    return true;
  });

  ipcMain.handle('systemStt.getStatus', async () => controller.getStatus());

  controller.onStatus((status: STTStatus) => broadcast('systemStt.status', status));
  controller.onPartial((event: STTPartialEvent) => broadcast('systemStt.partial', event));
  controller.onFinal((event: STTFinalEvent) => broadcast('systemStt.final', event));
  controller.onError((payload) =>
    broadcast('systemStt.error', { ...payload, ts: Date.now() })
  );
  controller.onDebug((message: string) =>
    broadcast('systemStt.debug', { message, ts: Date.now() })
  );
  controller.onLevel((payload: { level: number; rms: number; ts: number }) =>
    broadcast('systemStt.level', payload)
  );
}
