import Store from 'electron-store';
import {
  AutomationConfig,
  MappingPoint,
  ImageTemplate,
  Workflow,
} from '@ricky/shared';

type AutomationStoreState = {
  config: AutomationConfig;
  mappingPoints: MappingPoint[];
  imageTemplates: ImageTemplate[];
  workflows: Workflow[];
};

const defaultConfig: AutomationConfig = {
  defaultDelayMs: 500,
  maxRetries: 3,
  imageFindTimeout: 5000,
  safetyMode: true,
  imageFindConfidence: 0.8,
};

export class AutomationStore {
  private store: Store<AutomationStoreState>;

  constructor() {
    this.store = new Store<AutomationStoreState>({
      name: 'automation',
      defaults: {
        config: defaultConfig,
        mappingPoints: [],
        imageTemplates: [],
        workflows: [],
      },
    });
  }

  // Config
  getConfig(): AutomationConfig {
    return this.store.get('config');
  }

  setConfig(config: Partial<AutomationConfig>): AutomationConfig {
    const current = this.getConfig();
    const next = { ...current, ...config };
    this.store.set('config', next);
    return next;
  }

  // Mapping Points
  getMappingPoints(): MappingPoint[] {
    return this.store.get('mappingPoints');
  }

  getMappingPoint(id: string): MappingPoint | undefined {
    return this.getMappingPoints().find((p) => p.id === id);
  }

  getMappingPointByName(name: string): MappingPoint | undefined {
    return this.getMappingPoints().find((p) => p.name === name);
  }

  addMappingPoint(point: Omit<MappingPoint, 'id' | 'createdAt' | 'updatedAt'>): MappingPoint {
    const points = this.getMappingPoints();
    const newPoint: MappingPoint = {
      ...point,
      id: `mp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    points.push(newPoint);
    this.store.set('mappingPoints', points);
    return newPoint;
  }

  updateMappingPoint(id: string, updates: Partial<Omit<MappingPoint, 'id' | 'createdAt'>>): MappingPoint | null {
    const points = this.getMappingPoints();
    const index = points.findIndex((p) => p.id === id);
    if (index === -1) return null;

    points[index] = {
      ...points[index],
      ...updates,
      updatedAt: Date.now(),
    };
    this.store.set('mappingPoints', points);
    return points[index];
  }

  deleteMappingPoint(id: string): boolean {
    const points = this.getMappingPoints();
    const filtered = points.filter((p) => p.id !== id);
    if (filtered.length === points.length) return false;
    this.store.set('mappingPoints', filtered);
    return true;
  }

  // Image Templates
  getImageTemplates(): ImageTemplate[] {
    return this.store.get('imageTemplates');
  }

  getImageTemplate(id: string): ImageTemplate | undefined {
    return this.getImageTemplates().find((t) => t.id === id);
  }

  getImageTemplateByName(name: string): ImageTemplate | undefined {
    return this.getImageTemplates().find((t) => t.name === name);
  }

  addImageTemplate(template: Omit<ImageTemplate, 'id' | 'createdAt' | 'updatedAt'>): ImageTemplate {
    const templates = this.getImageTemplates();
    const newTemplate: ImageTemplate = {
      ...template,
      id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    templates.push(newTemplate);
    this.store.set('imageTemplates', templates);
    return newTemplate;
  }

  updateImageTemplate(id: string, updates: Partial<Omit<ImageTemplate, 'id' | 'createdAt'>>): ImageTemplate | null {
    const templates = this.getImageTemplates();
    const index = templates.findIndex((t) => t.id === id);
    if (index === -1) return null;

    templates[index] = {
      ...templates[index],
      ...updates,
      updatedAt: Date.now(),
    };
    this.store.set('imageTemplates', templates);
    return templates[index];
  }

  deleteImageTemplate(id: string): boolean {
    const templates = this.getImageTemplates();
    const filtered = templates.filter((t) => t.id !== id);
    if (filtered.length === templates.length) return false;
    this.store.set('imageTemplates', filtered);
    return true;
  }

  // Workflows
  getWorkflows(): Workflow[] {
    return this.store.get('workflows');
  }

  getWorkflow(id: string): Workflow | undefined {
    return this.getWorkflows().find((w) => w.id === id);
  }

  addWorkflow(workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>): Workflow {
    const workflows = this.getWorkflows();
    const newWorkflow: Workflow = {
      ...workflow,
      id: `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    workflows.push(newWorkflow);
    this.store.set('workflows', workflows);
    return newWorkflow;
  }

  updateWorkflow(id: string, updates: Partial<Omit<Workflow, 'id' | 'createdAt'>>): Workflow | null {
    const workflows = this.getWorkflows();
    const index = workflows.findIndex((w) => w.id === id);
    if (index === -1) return null;

    workflows[index] = {
      ...workflows[index],
      ...updates,
      updatedAt: Date.now(),
    };
    this.store.set('workflows', workflows);
    return workflows[index];
  }

  deleteWorkflow(id: string): boolean {
    const workflows = this.getWorkflows();
    const filtered = workflows.filter((w) => w.id !== id);
    if (filtered.length === workflows.length) return false;
    this.store.set('workflows', filtered);
    return true;
  }
}

let automationStore: AutomationStore | null = null;

export function getAutomationStore(): AutomationStore {
  if (!automationStore) {
    automationStore = new AutomationStore();
  }
  return automationStore;
}

