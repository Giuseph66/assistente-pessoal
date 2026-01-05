import type { MouseButton } from './types.js';

export type FlowNodeType =
  | 'start'
  | 'end'
  | 'action.clickMappedPoint'
  | 'action.clickCoordinates'
  | 'action.clickFoundImage'
  | 'action.typeText'
  | 'action.pressKey'
  | 'action.wait'
  | 'action.moveMouse'
  | 'action.dragMouse'
  | 'action.screenshot'
  | 'condition.findImage'
  | 'logic.loop';

export interface BaseNodeData {
  label?: string;
}

export interface StartNodeData extends BaseNodeData { }
export interface EndNodeData extends BaseNodeData { }

export interface ClickMappedPointData extends BaseNodeData {
  mappingName: string;
  button: MouseButton;
  clickCount: number;
  postDelayMs?: number;
}

export interface ClickCoordinatesData extends BaseNodeData {
  x: number;
  y: number;
  button: MouseButton;
  clickCount: number;
  postDelayMs?: number;
}

export interface TypeTextData extends BaseNodeData {
  text: string;
  speed?: number;
  postDelayMs?: number;
}

export interface PressKeyData extends BaseNodeData {
  keyCombo: string[] | string;
  postDelayMs?: number;
}

export interface WaitData extends BaseNodeData {
  ms: number;
}

export interface MoveMouseData extends BaseNodeData {
  x: number;
  y: number;
  durationMs?: number;
}

export interface DragMouseData extends BaseNodeData {
  from: { x: number; y: number } | string; // string = mappingName
  to: { x: number; y: number } | string;
  durationMs?: number;
}

export interface ScreenshotData extends BaseNodeData {
  region?: { x: number; y: number; width: number; height: number };
  saveTo?: string;
  postDelayMs?: number;
}

export interface FindImageData extends BaseNodeData {
  templateName: string;
  region?: { x: number; y: number; width: number; height: number };
  timeoutMs?: number;
  retries?: number;
  threshold?: number;
}

export interface ClickFoundImageData extends BaseNodeData {
  templateName?: string; // Opcional: se não especificar, usa a última imagem encontrada
  clickPosition: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  button: MouseButton;
  clickCount: number;
  offsetX?: number;
  offsetY?: number;
  postDelayMs?: number;
}

export interface LoopData extends BaseNodeData {
  mode: 'count' | 'until';
  count?: number;
  untilTemplateName?: string;
  timeoutMs?: number;
  maxIterations: number;
}

export type AutomationNodeData =
  | { nodeType: 'start'; data: StartNodeData }
  | { nodeType: 'end'; data: EndNodeData }
  | { nodeType: 'action.clickMappedPoint'; data: ClickMappedPointData }
  | { nodeType: 'action.clickCoordinates'; data: ClickCoordinatesData }
  | { nodeType: 'action.clickFoundImage'; data: ClickFoundImageData }
  | { nodeType: 'action.typeText'; data: TypeTextData }
  | { nodeType: 'action.pressKey'; data: PressKeyData }
  | { nodeType: 'action.wait'; data: WaitData }
  | { nodeType: 'action.moveMouse'; data: MoveMouseData }
  | { nodeType: 'action.dragMouse'; data: DragMouseData }
  | { nodeType: 'action.screenshot'; data: ScreenshotData }
  | { nodeType: 'condition.findImage'; data: FindImageData }
  | { nodeType: 'logic.loop'; data: LoopData };

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  position: { x: number; y: number };
  data: AutomationNodeData;
  width?: number;
  height?: number;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string; // OUT, FOUND, NOT_FOUND, LOOP, DONE
  targetHandle?: string;
  label?: string;
}

export interface WorkflowGraph {
  id: string;
  name: string;
  schemaVersion: number;
  version: number;
  createdAt: number;
  updatedAt: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport: { x: number; y: number; zoom: number };
  settingsOverride?: {
    defaultDelayMs?: number;
    retries?: number;
    findTimeoutMs?: number;
  };
}

export type FlowExecutionState = 'idle' | 'running' | 'paused' | 'stopped' | 'error' | 'completed';

export interface FlowExecutionLog {
  timestamp: number;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  nodeId?: string;
}

export interface FlowExecutionStatus {
  runId: string;
  workflowId: string;
  status: FlowExecutionState;
  currentNodeId?: string;
  progress: number;
  logs: FlowExecutionLog[];
  error?: string;
}

export interface FlowExecutionEventBase {
  runId: string;
  workflowId: string;
  timestamp: number;
}

export interface FlowExecutionStartedEvent extends FlowExecutionEventBase { }
export interface FlowExecutionProgressEvent extends FlowExecutionEventBase {
  progress: number;
}
export interface FlowExecutionNodeStartedEvent extends FlowExecutionEventBase {
  nodeId: string;
  nodeType: FlowNodeType;
}
export interface FlowExecutionNodeFinishedEvent extends FlowExecutionEventBase {
  nodeId: string;
  result?: any;
}
export interface FlowExecutionErrorEvent extends FlowExecutionEventBase {
  error: string;
  nodeId?: string;
}
export interface FlowExecutionCompletedEvent extends FlowExecutionEventBase { }

