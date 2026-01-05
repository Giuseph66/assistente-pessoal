import { ipcMain, BrowserWindow } from 'electron';
import { getLogger } from '@ricky/logger';
import { getAutomationStore } from '../storage/automationStore';
import { getAutomationService } from '../automation/AutomationService';
import { getMappingService } from '../automation/MappingService';
import { getAutomationExecutor } from '../automation/AutomationExecutor';
import { DatabaseManager } from '../database';
import { captureAreaInteractiveConfirmed } from '../screenshot';
import {
  AutomationConfig,
  MappingPoint,
  ImageTemplate,
  Workflow,
  AutomationAction,
  MappingPointType,
} from '@ricky/shared';

const logger = getLogger();

/**
 * Broadcast para todas as janelas
 */
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

/**
 * Registra todos os handlers IPC para Automação
 */
export function registerAutomationIpc(): void {
  const store = getAutomationStore();
  const automationService = getAutomationService();
  const mappingService = getMappingService();
  const executor = getAutomationExecutor();

  // Inicializar serviços
  automationService.initialize().catch((err) => {
    logger.error({ err }, 'Failed to initialize AutomationService');
  });

  // Event listeners do executor
  executor.on('execution.started', (data) => {
    broadcast('automation.execution.started', data);
  });

  executor.on('execution.completed', (data) => {
    broadcast('automation.execution.completed', data);
  });

  executor.on('execution.error', (data) => {
    broadcast('automation.execution.error', data);
  });

  executor.on('execution.progress', (data) => {
    broadcast('automation.execution.progress', data);
  });

  executor.on('execution.paused', () => {
    broadcast('automation.execution.paused', {});
  });

  executor.on('execution.resumed', () => {
    broadcast('automation.execution.resumed', {});
  });

  executor.on('execution.stopped', () => {
    broadcast('automation.execution.stopped', {});
  });

  executor.on('status', (status) => {
    broadcast('automation.execution.status', status);
  });

  // Event listeners do mapping service
  mappingService.on('mappingModeChanged', (data) => {
    broadcast('automation.mapping.modeChanged', data);
  });

  mappingService.on('mapping.pointCaptured', (data) => {
    broadcast('automation.mapping.pointCaptured', data);
  });

  mappingService.on('mapping.templateCaptured', (data) => {
    broadcast('automation.mapping.templateCaptured', data);
  });

  mappingService.on('mapping.error', (data) => {
    broadcast('automation.mapping.error', data);
  });

  mappingService.on('mappingPointAdded', (point) => {
    broadcast('automation.mapping.pointAdded', point);
  });

  mappingService.on('mappingPointUpdated', (point) => {
    broadcast('automation.mapping.pointUpdated', point);
  });

  mappingService.on('mappingPointDeleted', (data) => {
    broadcast('automation.mapping.pointDeleted', data);
  });

  mappingService.on('templateAdded', (template) => {
    broadcast('automation.mapping.templateAdded', template);
  });

  mappingService.on('templateUpdated', (template) => {
    broadcast('automation.mapping.templateUpdated', template);
  });

  mappingService.on('templateDeleted', (data) => {
    broadcast('automation.mapping.templateDeleted', data);
  });

  // ========== Config ==========

  ipcMain.handle('automation.getConfig', async () => {
    return store.getConfig();
  });

  ipcMain.handle('automation.saveConfig', async (_event, config: Partial<AutomationConfig>) => {
    const updated = store.setConfig(config);
    return updated;
  });

  // ========== Mapping Mode ==========

  ipcMain.handle('automation.startMappingMode', async () => {
    await mappingService.startMappingMode();
    return { success: true };
  });

  ipcMain.handle('automation.stopMappingMode', async () => {
    await mappingService.stopMappingMode();
    return { success: true };
  });

  ipcMain.handle('automation.isMappingMode', async () => {
    return mappingService.isMappingMode();
  });

  // ========== Mapping Points ==========

  ipcMain.handle('automation.recordClick', async (_event, { x, y, name, type }: { x: number; y: number; name: string; type?: MappingPointType }) => {
    const point = await mappingService.addMappingPoint(name, x, y, type || 'click');
    return point;
  });

  ipcMain.handle('automation.recordPointFromHotkey', async (_event, { x, y, name, type }: { x: number; y: number; name: string; type?: MappingPointType }) => {
    const point = await mappingService.recordPointFromHotkey(x, y, name, type || 'click');
    return point;
  });

  ipcMain.handle('automation.recordTemplateFromHotkey', async (_event, { name, region, screenshotPath }: { name: string; region: { x: number; y: number; width: number; height: number }; screenshotPath?: string }) => {
    const template = await mappingService.recordTemplateFromHotkey(name, region, screenshotPath);
    return template;
  });

  ipcMain.handle('automation.listMappings', async () => {
    const points = mappingService.getAllMappingPoints();
    const templates = mappingService.getAllImageTemplates();
    return {
      points,
      templates,
    };
  });

  ipcMain.handle('automation.getMappingPoint', async (_event, id: string) => {
    return mappingService.getMappingPoint(id);
  });

  ipcMain.handle('automation.updateMappingPoint', async (_event, { id, updates }: { id: string; updates: Partial<Omit<MappingPoint, 'id' | 'createdAt'>> }) => {
    return mappingService.updateMappingPoint(id, updates);
  });

  ipcMain.handle('automation.deleteMapping', async (_event, { id, type }: { id: string; type: 'point' | 'template' }) => {
    if (type === 'point') {
      return { success: await mappingService.deleteMappingPoint(id) };
    } else {
      return { success: await mappingService.deleteImageTemplate(id) };
    }
  });

  // ========== Image Templates ==========

  ipcMain.handle('automation.captureTemplate', async (_event, { name, region }: { name: string; region?: { x: number; y: number; width: number; height: number } }) => {
    const template = await mappingService.captureTemplate(name, region);
    return template;
  });

  ipcMain.handle('automation.captureTemplateInteractive', async () => {
    try {
      const db = new DatabaseManager();
      const result = await captureAreaInteractiveConfirmed(db);
      db.close();
      return result;
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to capture template interactively');
      return { success: false, error: error?.message || 'Unknown error' };
    }
  });

  ipcMain.handle('automation.getImageTemplate', async (_event, id: string) => {
    return mappingService.getImageTemplate(id);
  });

  ipcMain.handle('automation.importImageTemplate', async (_event, { name, dataUrl }: { name: string; dataUrl: string }) => {
    return mappingService.importImageTemplate(name, dataUrl);
  });

  ipcMain.handle('automation.updateImageTemplate', async (_event, { id, updates }: { id: string; updates: Partial<Omit<ImageTemplate, 'id' | 'createdAt'>> }) => {
    return mappingService.updateImageTemplate(id, updates);
  });

  ipcMain.handle('automation.resizeImageTemplate', async (_event, { id, width, height, keepAspect }: { id: string; width?: number; height?: number; keepAspect?: boolean }) => {
    return mappingService.resizeImageTemplate(id, { width, height, keepAspect });
  });

  ipcMain.handle('automation.replaceImageTemplate', async (_event, { id, dataUrl }: { id: string; dataUrl: string }) => {
    return mappingService.replaceImageTemplate(id, dataUrl);
  });

  ipcMain.handle('automation.cropImageTemplate', async (_event, { id, rect }: { id: string; rect: { x: number; y: number; width: number; height: number } }) => {
    return mappingService.cropImageTemplate(id, rect);
  });

  ipcMain.handle('automation.findTemplateOnScreen', async (_event, { templateName, confidence, timeout }: { templateName: string; confidence?: number; timeout?: number }) => {
    const found = await mappingService.findTemplateOnScreen(templateName, confidence, timeout);
    return found;
  });

  // ========== Workflows ==========

  ipcMain.handle('automation.createWorkflow', async (_event, workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>) => {
    const created = store.addWorkflow(workflow);
    broadcast('automation.workflow.created', created);
    return created;
  });

  ipcMain.handle('automation.updateWorkflow', async (_event, { id, workflow }: { id: string; workflow: Partial<Omit<Workflow, 'id' | 'createdAt'>> }) => {
    const updated = store.updateWorkflow(id, workflow);
    if (updated) {
      broadcast('automation.workflow.updated', updated);
    }
    return updated;
  });

  ipcMain.handle('automation.deleteWorkflow', async (_event, id: string) => {
    const deleted = store.deleteWorkflow(id);
    if (deleted) {
      broadcast('automation.workflow.deleted', { id });
    }
    return deleted;
  });

  ipcMain.handle('automation.listWorkflows', async () => {
    return store.getWorkflows();
  });

  ipcMain.handle('automation.getWorkflow', async (_event, id: string) => {
    return store.getWorkflow(id);
  });

  // ========== Execution ==========

  ipcMain.handle('automation.executeWorkflow', async (_event, workflowId: string) => {
    try {
      // Executar workflow em background para não bloquear
      // Usar void para garantir que a promise não seja rejeitada sem tratamento
      void executor.executeWorkflow(workflowId).catch((error: any) => {
        // O erro já foi tratado internamente pelo executor e emitido via eventos
        // Apenas logar se for um erro inesperado
        if (error && !error.handled) {
          logger.error({ err: error, workflowId }, 'Unexpected error in workflow execution');
        }
      });
      return { success: true };
    } catch (error: any) {
      logger.error({ err: error, workflowId }, 'Failed to start workflow execution');
      return { success: false, error: error?.message || 'Unknown error' };
    }
  });

  ipcMain.handle('automation.pauseExecution', async () => {
    executor.pause();
    return { success: true };
  });

  ipcMain.handle('automation.resumeExecution', async () => {
    executor.resume();
    return { success: true };
  });

  ipcMain.handle('automation.stopExecution', async () => {
    executor.stop();
    return { success: true };
  });

  ipcMain.handle('automation.getExecutionStatus', async () => {
    return executor.getStatus();
  });

  // ========== Test Action ==========

  ipcMain.handle('automation.getMousePosition', async () => {
    const position = await automationService.getMousePosition();
    return position;
  });

  ipcMain.handle('automation.getScreenSize', async () => {
    const size = await automationService.getScreenSize();
    return size;
  });

  ipcMain.handle('automation.testAction', async (_event, action: AutomationAction) => {
    try {
      const config = store.getConfig();

      switch (action.type) {
        case 'click':
          const clickAction = action as any;
          if (clickAction.params.mappingPoint) {
            const point = mappingService.getMappingPointByName(clickAction.params.mappingPoint);
            if (!point) throw new Error(`Mapping point "${clickAction.params.mappingPoint}" not found`);
            await automationService.click(clickAction.params.button || 'left', point.x, point.y);
          } else if (clickAction.params.x !== undefined && clickAction.params.y !== undefined) {
            await automationService.click(clickAction.params.button || 'left', clickAction.params.x, clickAction.params.y);
          }
          break;
        case 'clickAt':
          const clickAtAction = action as any;
          await automationService.click(clickAtAction.params.button || 'left', clickAtAction.params.x, clickAtAction.params.y);
          break;
        case 'type':
          await automationService.type((action as any).params.text);
          break;
        case 'pressKey':
          const pressKeyAction = action as any;
          await automationService.pressKey(pressKeyAction.params.key, pressKeyAction.params.modifiers || []);
          break;
        case 'wait':
          await automationService.wait((action as any).params.ms);
          break;
        case 'moveMouse':
          const moveMouseAction = action as any;
          await automationService.moveMouse(moveMouseAction.params.x, moveMouseAction.params.y);
          break;
        default:
          throw new Error(`Action type "${action.type}" not supported for testing`);
      }

      return { success: true };
    } catch (error: any) {
      logger.error({ err: error, action }, 'Failed to test action');
      return { success: false, error: error?.message || 'Unknown error' };
    }
  });

  logger.info('Automation IPC handlers registered');
}
