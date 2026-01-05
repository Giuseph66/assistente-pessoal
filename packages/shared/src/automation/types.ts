// Automation types

export type MouseButton = 'left' | 'right' | 'middle';

export type AutomationActionType =
  | 'click'
  | 'clickAt'
  | 'type'
  | 'pressKey'
  | 'wait'
  | 'screenshot'
  | 'findImage'
  | 'moveMouse'
  | 'drag'
  | 'loop'
  | 'condition';

export interface AutomationAction {
  id: string;
  type: AutomationActionType;
  params: Record<string, any>;
  continueOnError?: boolean; // Se true, continua o workflow mesmo se esta ação falhar
}

export interface ClickAction extends AutomationAction {
  type: 'click';
  params: {
    mappingPoint?: string;
    x?: number;
    y?: number;
    button?: MouseButton;
  };
}

export interface ClickAtAction extends AutomationAction {
  type: 'clickAt';
  params: {
    x: number;
    y: number;
    button?: MouseButton;
  };
}

export interface TypeAction extends AutomationAction {
  type: 'type';
  params: {
    text: string;
  };
}

export interface PressKeyAction extends AutomationAction {
  type: 'pressKey';
  params: {
    key: string;
    modifiers?: string[];
  };
}

export interface WaitAction extends AutomationAction {
  type: 'wait';
  params: {
    ms: number;
    orUntilImage?: string; // template name
    timeout?: number;
  };
}

export interface ScreenshotAction extends AutomationAction {
  type: 'screenshot';
  params: {
    region?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    savePath?: string;
  };
}

export interface FindImageAction extends AutomationAction {
  type: 'findImage';
  params: {
    templateName: string;
    timeout?: number;
    confidence?: number;
    optional?: boolean; // Se true, não falha o workflow se a imagem não for encontrada
  };
}

export interface MoveMouseAction extends AutomationAction {
  type: 'moveMouse';
  params: {
    x: number;
    y: number;
  };
}

export interface DragAction extends AutomationAction {
  type: 'drag';
  params: {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    button?: MouseButton;
  };
}

export interface LoopAction extends AutomationAction {
  type: 'loop';
  params: {
    count?: number; // undefined = infinite until stopped
    actions: AutomationAction[];
  };
}

export interface ConditionAction extends AutomationAction {
  type: 'condition';
  params: {
    condition: 'imageFound' | 'imageNotFound';
    templateName: string;
    ifTrue: AutomationAction[];
    ifFalse?: AutomationAction[];
  };
}

export type MappingPointType = 'click' | 'drag' | 'reference';

export interface MappingPoint {
  id: string;
  name: string;
  x: number;
  y: number;
  type: MappingPointType;
  createdAt: number;
  updatedAt: number;
}

export interface ImageTemplate {
  id: string;
  name: string;
  imagePath: string;
  region?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  createdAt: number;
  updatedAt: number;
}

export interface WorkflowStep {
  id: string;
  action: AutomationAction;
  order: number;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AutomationConfig {
  defaultDelayMs: number;
  maxRetries: number;
  imageFindTimeout: number;
  safetyMode: boolean; // pede confirmação antes de executar
  imageFindConfidence: number; // 0-1
}

export interface ExecutionStatus {
  status: 'idle' | 'running' | 'paused' | 'stopped' | 'error';
  currentWorkflowId?: string;
  currentStepIndex?: number;
  currentStep?: WorkflowStep;
  error?: string;
  progress: number; // 0-100
  logs: ExecutionLog[];
}

export interface ExecutionLog {
  timestamp: number;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  stepId?: string;
}

