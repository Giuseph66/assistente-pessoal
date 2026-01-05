import Store from 'electron-store';
import { WorkflowGraph } from '@ricky/shared';

interface AutomationFlowStoreState {
  workflows: WorkflowGraph[];
  schemaVersion: number;
}

const CURRENT_SCHEMA_VERSION = 1;

export class AutomationFlowStore {
  private store: Store<AutomationFlowStoreState>;

  constructor() {
    this.store = new Store<AutomationFlowStoreState>({
      name: 'automation-flow',
      defaults: {
        workflows: [],
        schemaVersion: CURRENT_SCHEMA_VERSION,
      },
    });

    this.migrateIfNeeded();
    this.ensureSeed();
  }

  private migrateIfNeeded() {
    const storedVersion = this.store.get('schemaVersion');
    if (storedVersion < CURRENT_SCHEMA_VERSION) {
      // Implement migration logic here when needed
      this.store.set('schemaVersion', CURRENT_SCHEMA_VERSION);
    }
  }

  private ensureSeed() {
    const workflows = this.getWorkflows();
    if (workflows.length === 0) {
      const seed: WorkflowGraph = {
        id: 'seed-workflow-1',
        name: 'Exemplo: Login Automático',
        schemaVersion: CURRENT_SCHEMA_VERSION,
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [
          {
            id: 'start-1',
            type: 'start',
            position: { x: 100, y: 100 },
            data: { nodeType: 'start', data: {} },
          },
          {
            id: 'find-image-1',
            type: 'condition.findImage',
            position: { x: 300, y: 100 },
            data: {
              nodeType: 'condition.findImage',
              data: { templateName: 'login_screen', threshold: 0.8 },
            },
          },
          {
            id: 'wait-1',
            type: 'action.wait',
            position: { x: 300, y: 300 },
            data: {
              nodeType: 'action.wait',
              data: { ms: 1000 },
            },
          },
          {
            id: 'loop-1',
            type: 'logic.loop',
            position: { x: 100, y: 300 },
            data: {
              nodeType: 'logic.loop',
              data: { mode: 'count', count: 3, maxIterations: 3 },
            },
          },
          {
            id: 'click-login-1',
            type: 'action.clickMappedPoint',
            position: { x: 600, y: 50 },
            data: {
              nodeType: 'action.clickMappedPoint',
              data: { mappingName: 'buttonLogin', button: 'left', clickCount: 1 },
            },
          },
          {
            id: 'type-test-1',
            type: 'action.typeText',
            position: { x: 850, y: 50 },
            data: {
              nodeType: 'action.typeText',
              data: { text: 'teste' },
            },
          },
          {
            id: 'end-1',
            type: 'end',
            position: { x: 1100, y: 100 },
            data: { nodeType: 'end', data: {} },
          },
        ],
        edges: [
          { id: 'e1', source: 'start-1', target: 'find-image-1', sourceHandle: 'OUT' },
          { id: 'e2', source: 'find-image-1', target: 'click-login-1', sourceHandle: 'FOUND' },
          { id: 'e3', source: 'find-image-1', target: 'wait-1', sourceHandle: 'NOT_FOUND' },
          { id: 'e4', source: 'wait-1', target: 'loop-1', sourceHandle: 'OUT' },
          { id: 'e5', source: 'loop-1', target: 'find-image-1', sourceHandle: 'LOOP' },
          { id: 'e6', source: 'loop-1', target: 'end-1', sourceHandle: 'DONE' },
          { id: 'e7', source: 'click-login-1', target: 'type-test-1', sourceHandle: 'OUT' },
          { id: 'e8', source: 'type-test-1', target: 'end-1', sourceHandle: 'OUT' },
        ],
      };
      this.addWorkflow(seed);
    }
  }

  getWorkflows(): WorkflowGraph[] {
    return this.store.get('workflows');
  }

  getWorkflow(id: string): WorkflowGraph | undefined {
    return this.getWorkflows().find((w) => w.id === id);
  }

  addWorkflow(workflow: WorkflowGraph): WorkflowGraph {
    const workflows = this.getWorkflows();
    workflows.push(workflow);
    this.store.set('workflows', workflows);
    return workflow;
  }

  saveWorkflow(workflow: WorkflowGraph): WorkflowGraph {
    const workflows = this.getWorkflows();
    const index = workflows.findIndex((w) => w.id === workflow.id);
    if (index === -1) {
      workflows.push(workflow);
    } else {
      workflows[index] = { ...workflow, updatedAt: Date.now() };
    }
    this.store.set('workflows', workflows);
    return workflow;
  }

  deleteWorkflow(id: string): boolean {
    const workflows = this.getWorkflows();
    const filtered = workflows.filter((w) => w.id !== id);
    if (filtered.length === workflows.length) return false;
    this.store.set('workflows', filtered);
    return true;
  }
}

let automationFlowStore: AutomationFlowStore | null = null;

export function getAutomationFlowStore(): AutomationFlowStore {
  if (!automationFlowStore) {
    automationFlowStore = new AutomationFlowStore();
  }
  return automationFlowStore;
}

