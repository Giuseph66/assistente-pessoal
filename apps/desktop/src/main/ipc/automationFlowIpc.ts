import { ipcMain, BrowserWindow } from 'electron';
import { z } from 'zod';
import { getLogger } from '@neo/logger';
import { getAutomationFlowStore } from '../storage/automationFlowStore';
import { getOrkutFlowRunner } from '../automation/flow/OrkutFlowRunner';
import { OrkutFlowCompiler } from '../automation/flow/OrkutFlowCompiler';
import { DatabaseManager } from '../database';

const logger = getLogger();

const broadcast = (channel: string, payload: any) => {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  });
};

// Zod schemas for validation
const NodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.object({
    nodeType: z.string(),
    data: z.record(z.any()),
  }),
});

const EdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string(),
  targetHandle: z.string().optional(),
  label: z.string().optional(),
});

const GraphSchema = z.object({
  id: z.string(),
  name: z.string(),
  schemaVersion: z.number(),
  version: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
  viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number() }),
  settingsOverride: z.object({
    defaultDelayMs: z.number().optional(),
    retries: z.number().optional(),
    findTimeoutMs: z.number().optional(),
  }).optional(),
});

export function registerAutomationFlowIpc(db: DatabaseManager) {
  const store = getAutomationFlowStore();
  const runner = getOrkutFlowRunner(db);
  const compiler = new OrkutFlowCompiler();

  // Listeners for runner events
  runner.on('status', (status) => broadcast('automation.flow.execution.status', status));
  runner.on('node.started', (data) => broadcast('automation.flow.execution.node.started', data));
  runner.on('node.finished', (data) => broadcast('automation.flow.execution.node.finished', data));

  // CRUD
  ipcMain.handle('automation.flow.listWorkflows', async () => {
    return store.getWorkflows();
  });

  ipcMain.handle('automation.flow.getWorkflow', async (_event, id: string) => {
    return store.getWorkflow(id);
  });

  ipcMain.handle('automation.flow.saveWorkflow', async (_event, graph: any) => {
    const validated = GraphSchema.parse(graph);
    return store.saveWorkflow(validated as any);
  });

  ipcMain.handle('automation.flow.deleteWorkflow', async (_event, id: string) => {
    return store.deleteWorkflow(id);
  });

  ipcMain.handle('automation.flow.validateWorkflow', async (_event, graph: any) => {
    return compiler.validate(graph);
  });

  // Execution
  ipcMain.handle('automation.flow.runWorkflow', async (_event, id: string) => {
    const workflow = store.getWorkflow(id);
    if (!workflow) throw new Error('Workflow não encontrado.');
    
    // Non-blocking run
    void runner.run(workflow).catch(err => {
      logger.error({ err, workflowId: id }, 'Error running flow workflow');
    });
    return { success: true };
  });

  ipcMain.handle('automation.flow.pause', async () => {
    runner.pause();
    return { success: true };
  });

  ipcMain.handle('automation.flow.resume', async () => {
    runner.resume();
    return { success: true };
  });

  ipcMain.handle('automation.flow.stop', async () => {
    runner.stop();
    return { success: true };
  });

  ipcMain.handle('automation.flow.getExecutionStatus', async () => {
    return runner.getStatus();
  });

  logger.info('Automation Flow IPC handlers registered');
}
