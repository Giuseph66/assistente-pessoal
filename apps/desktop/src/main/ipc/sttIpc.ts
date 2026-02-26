import { BrowserWindow, ipcMain } from 'electron';
import { STTConfig, STTFinalEvent, STTPartialEvent, STTStatus } from '@neo/shared';
import { STTController } from '../stt/STTController';

const broadcast = (channel: string, payload: any) => {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (win.isDestroyed()) return;
    const contents = win.webContents;
    if (contents.isDestroyed() || contents.isCrashed()) return;
    try {
      contents.send(channel, payload);
    } catch {
      // Ignora frames que estão sendo descartados
    }
  });
};

export function registerSttIpc(sttController: STTController): void {
  ipcMain.handle('stt.start', async (_event, config?: STTConfig) => {
    await sttController.start(config);
    return true;
  });

  ipcMain.handle('stt.stop', async () => {
    await sttController.stop();
    return true;
  });

  ipcMain.handle('stt.getStatus', async () => sttController.getStatus());
  ipcMain.handle('stt.getConfig', async () => sttController.getConfig());
  ipcMain.handle('stt.updateConfig', async (_event, config: Partial<STTConfig>) => {
    return sttController.updateConfig(config);
  });

  sttController.onStatus((status: STTStatus) => broadcast('stt.status', status));
  sttController.onPartial((event: STTPartialEvent) => broadcast('stt.partial', event));
  sttController.onFinal((event: STTFinalEvent) => broadcast('stt.final', event));
  sttController.onError((payload) =>
    broadcast('stt.error', { ...payload, ts: Date.now() })
  );
  sttController.onDebug((message: string) =>
    broadcast('stt.debug', { message, ts: Date.now() })
  );
  sttController.onLevel((payload) => broadcast('stt.level', payload));
}
