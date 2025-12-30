import { ipcMain } from 'electron';
import { SystemAudioSourceManager } from '../audio/system/SystemAudioSourceManager';

export function registerSystemAudioIpc(manager: SystemAudioSourceManager): void {
  ipcMain.handle('systemAudio.listSources', async () => manager.listSources());
  ipcMain.handle('systemAudio.detectDefaultMonitor', async () => manager.detectDefaultMonitor());
}
