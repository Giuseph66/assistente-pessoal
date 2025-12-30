import { BrowserWindow, ipcMain } from 'electron';
import { ModelManager } from '../stt/models/ModelManager';

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

export function registerModelIpc(modelManager: ModelManager): void {
  ipcMain.handle('models.listInstalled', async () => modelManager.listInstalled());
  ipcMain.handle('models.listCatalog', async () => modelManager.getCatalog());
  ipcMain.handle('models.install', async (_event, modelId: string) => modelManager.install(modelId));
  ipcMain.handle('models.remove', async (_event, modelId: string) => modelManager.remove(modelId));
  ipcMain.handle('models.import', async (_event, payload: { path: string; language?: string; label?: string }) =>
    modelManager.importModel(payload.path, { language: payload.language, label: payload.label })
  );
  ipcMain.handle('models.setActive', async (_event, modelId: string) => modelManager.setActiveModel(modelId));
  ipcMain.handle('models.getActive', async () => modelManager.getActiveModelId());

  modelManager.onInstallProgress((event) => broadcast('model.install.progress', event));
  modelManager.onInstallDone((event) => broadcast('model.install.done', event));
  modelManager.onInstallError((event) => broadcast('model.install.error', event));
}
