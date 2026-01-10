import { ModelManager } from './models/ModelManager';
import { STTController } from './STTController';
import type { DatabaseManager } from '../database';

let modelManager: ModelManager | null = null;
let sttController: STTController | null = null;

export function getModelManager(): ModelManager {
  if (!modelManager) {
    modelManager = new ModelManager();
  }
  return modelManager;
}

export function getSttController(db?: DatabaseManager): STTController {
  if (!sttController) {
    sttController = new STTController(getModelManager(), db);
  }
  return sttController;
}
