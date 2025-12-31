import { ipcMain } from 'electron';
import { SystemAudioSourceManager } from '../audio/system/SystemAudioSourceManager';
import { SystemAudioPreviewService } from '../audio/system/SystemAudioPreviewService';

export function registerSystemAudioIpc(
  manager: SystemAudioSourceManager,
  preview: SystemAudioPreviewService
): void {
  ipcMain.handle('systemAudio.listSources', async () => manager.listSources());
  ipcMain.handle('systemAudio.detectDefaultMonitor', async () => manager.detectDefaultMonitor());

  ipcMain.handle('systemAudio.startPreview', async (_event, sourceId: string) => {
    await preview.start(sourceId);
    return true;
  });

  ipcMain.handle('systemAudio.stopPreview', async () => {
    await preview.stop();
    return true;
  });
}
