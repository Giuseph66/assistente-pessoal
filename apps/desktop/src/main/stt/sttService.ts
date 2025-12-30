import { ModelManager } from './models/ModelManager';
import { STTController } from './STTController';

let modelManager: ModelManager | null = null;
let sttController: STTController | null = null;

export function getModelManager(): ModelManager {
  if (!modelManager) {
    modelManager = new ModelManager();
  }
  return modelManager;
}

export function getSttController(): STTController {
  if (!sttController) {
    sttController = new STTController(getModelManager());
  }
  return sttController;
}
