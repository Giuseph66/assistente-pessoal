import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  DefaultEdgeOptions,
  Edge,
  MarkerType,
  ReactFlowProvider,
  Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { WorkflowGraph, FlowNode, FlowExecutionStatus, FlowExecutionLog, MappingPoint, ImageTemplate } from '@neo/shared';
import { NodePalette, NodePropertiesPanel, FloatingToolbar, ExecutionMonitor } from './WorkflowComponents';
import { StartNode } from './CustomNodes/StartNode';
import { EndNode } from './CustomNodes/EndNode';
import { ActionNode } from './CustomNodes/ActionNode';
import { FindImageNode } from './CustomNodes/FindImageNode';
import { LoopNode } from './CustomNodes/LoopNode';
import { AIBrainNode } from './CustomNodes/AIBrainNode';
import { FlowIcon } from './FlowIcons';
import { WorkflowAgentChat } from './WorkflowAgentChat';

import './WorkflowEditor.css';

import DeletableEdge from './CustomEdges/DeletableEdge';

const NODE_TYPES = {
  'start': StartNode,
  'end': EndNode,
  'action.clickMappedPoint': ActionNode,
  'action.clickCoordinates': ActionNode,
  'action.clickFoundImage': ActionNode,
  'action.typeText': ActionNode,
  'action.pressKey': ActionNode,
  'action.wait': ActionNode,
  'action.moveMouse': ActionNode,
  'action.dragMouse': ActionNode,
  'action.screenshot': ActionNode,
  'condition.findImage': FindImageNode,
  'logic.loop': LoopNode,
  'ai.brain': AIBrainNode,
};

const EDGE_TYPES = {
  'default': DeletableEdge,
};

interface WorkflowEditorProps {
  workflow?: WorkflowGraph | null;
  mappings?: { points: MappingPoint[]; templates: ImageTemplate[] };
  onSave?: (workflow: WorkflowGraph) => Promise<void>;
  onCancel?: () => void;
  onBack?: () => void;
}

const DEFAULT_WORKFLOW: WorkflowGraph = {
  id: 'new-workflow',
  name: 'Novo Workflow',
  schemaVersion: 1,
  version: 1,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};

function slugifyWorkflowName(name: string): string {
  return String(name || 'workflow')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'workflow';
}

function sanitizeForJson(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeForJson(item));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      const normalized = sanitizeForJson(item);
      if (normalized !== undefined) out[key] = normalized;
    });
    return out;
  }
  return String(value);
}

function buildAiFriendlyExport(graph: WorkflowGraph) {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const sortedNodes = [...nodes].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const sortedEdges = [...edges].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const startNodeIds = sortedNodes.filter((node: any) => node.type === 'start').map((node: any) => node.id);

  const outgoingByNode = new Map<string, Array<{
    edgeId: string;
    sourceHandle: string;
    targetId: string;
    targetHandle?: string;
  }>>();

  sortedEdges.forEach((edge: any) => {
    const source = String(edge.source || '');
    if (!source) return;
    const list = outgoingByNode.get(source) || [];
    list.push({
      edgeId: String(edge.id || ''),
      sourceHandle: String(edge.sourceHandle || 'OUT'),
      targetId: String(edge.target || ''),
      targetHandle: edge.targetHandle ? String(edge.targetHandle) : undefined,
    });
    outgoingByNode.set(source, list);
  });

  const steps = sortedNodes.map((node: any) => {
    const nodeType = String(node?.data?.nodeType || node.type || '');
    const nodeData = sanitizeForJson(node?.data?.data || {});
    const outgoing = (outgoingByNode.get(String(node.id)) || []).map((link) => ({
      route: link.sourceHandle,
      targetNodeId: link.targetId,
      targetHandle: link.targetHandle || null,
    }));

    return {
      id: String(node.id || ''),
      type: String(node.type || ''),
      nodeType,
      position: {
        x: Number(node?.position?.x || 0),
        y: Number(node?.position?.y || 0),
      },
      config: nodeData,
      outgoing,
    };
  });

  return {
    format: 'neo.ai_flow.v1',
    exportedAt: new Date().toISOString(),
    workflow: {
      id: graph.id,
      name: graph.name,
      schemaVersion: graph.schemaVersion,
      version: graph.version,
      createdAt: graph.createdAt,
      updatedAt: graph.updatedAt,
    },
    entrypoints: startNodeIds,
    steps,
    rawGraph: sanitizeForJson({
      nodes: sortedNodes,
      edges: sortedEdges,
      viewport: graph.viewport,
      settingsOverride: graph.settingsOverride || null,
    }),
  };
}

function FlowEditorContent({ workflow = DEFAULT_WORKFLOW, onBack }: WorkflowEditorProps) {
  const safeWorkflow = workflow || DEFAULT_WORKFLOW;
  const [workflowName, setWorkflowName] = useState(safeWorkflow.name);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(safeWorkflow.nodes as any);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(safeWorkflow.edges as any);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [executionStatus, setExecutionStatus] = useState<FlowExecutionStatus | null>(null);
  const [testStatus, setTestStatus] = useState<FlowExecutionStatus | null>(null);
  const [validation, setValidation] = useState<{ errors: any[]; warnings: any[] }>({ errors: [], warnings: [] });
  const [isFullscreen, setIsFullscreen] = useState(false); // Default to false to respect WindowControls
  const [isAgentOpen, setIsAgentOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: Node } | null>(null);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowWrapper] = useState<any>(null);
  const defaultEdgeOptions = useMemo<DefaultEdgeOptions>(
    () => ({
      type: 'default',
      interactionWidth: 28,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#60a5fa',
        width: 20,
        height: 20,
      },
      style: {
        stroke: '#60a5fa',
        strokeWidth: 2.2,
      },
    }),
    []
  );
  const connectionLineStyle = useMemo(
    () => ({
      stroke: '#60a5fa',
      strokeWidth: 2.2,
      strokeOpacity: 0.95,
    }),
    []
  );

  useEffect(() => {
    setWorkflowName(safeWorkflow.name || 'Workflow');
  }, [safeWorkflow.id, safeWorkflow.name]);

  const buildCurrentGraph = useCallback((): WorkflowGraph => {
    return {
      ...safeWorkflow,
      name: workflowName,
      nodes: nodes as any,
      edges: edges as any,
      viewport: reactFlowInstance ? reactFlowInstance.getViewport() : safeWorkflow.viewport,
      updatedAt: Date.now(),
    };
  }, [safeWorkflow, workflowName, nodes, edges, reactFlowInstance]);

  // Sync execution status highlight
  useEffect(() => {
    if (!executionStatus?.currentNodeId) return;

    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data as any,
          isRunning: node.id === executionStatus.currentNodeId,
        },
      }))
    );
  }, [executionStatus?.currentNodeId, setNodes]);

  // IPC Event listeners
  useEffect(() => {
    const unsubStatus = window.automation.flow.onStatus((status) => {
      setExecutionStatus(status);
      if (status.status === 'completed' || status.status === 'stopped' || status.status === 'error') {
        // Clear highlights after a delay
        setTimeout(() => {
          setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data as any, isRunning: false } })));
        }, 2000);
      }
    });

    return () => {
      unsubStatus();
    };
  }, [setNodes]);

  // Autosave
  useEffect(() => {
    const timer = setTimeout(async () => {
      const graph = buildCurrentGraph();
      await window.automation.flow.saveWorkflow(graph);
    }, 1000);

    return () => clearTimeout(timer);
  }, [buildCurrentGraph, workflow]);

  const onConnect = useCallback(
    (params: Connection) => {
      // Rule: 1 edge per sourceHandle
      const alreadyHasEdge = edges.some(
        (e) => e.source === params.source && e.sourceHandle === params.sourceHandle
      );

      if (alreadyHasEdge) {
        alert(`O handle "${params.sourceHandle}" já tem uma conexão. Remova a antiga primeiro.`);
        return;
      }

      setEdges((eds) => addEdge({ ...params, type: 'default' }, eds));
    },
    [edges, setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const defaultDataForType = (t: string) => {
        if (t === 'action.clickFoundImage') {
          return { clickPosition: 'center', button: 'left', clickCount: 1 };
        }
        if (t === 'action.clickMappedPoint') {
          return { mappingName: '', button: 'left', clickCount: 1 };
        }
        if (t === 'action.clickCoordinates') {
          return { x: 0, y: 0, button: 'left', clickCount: 1 };
        }
        if (t === 'condition.findImage') {
          return { templateName: '', threshold: 0.8, timeoutMs: 5000 };
        }
        if (t === 'logic.loop') {
          return { mode: 'count', count: 1, maxIterations: 10 };
        }
        if (t === 'ai.brain') {
          return {
            instruction: [
              'Você é um nó orquestrador de automação.',
              'Responda SOMENTE em JSON válido, sem markdown.',
              'Formato obrigatório:',
              '{"route":"OUT","toolCalls":[{"channel":"automation.wait","args":{"ms":300}}],"message":"opcional","memoryPatch":"opcional"}',
              'A route deve ser uma rota válida configurada no nó, ou ERROR.',
            ].join('\n'),
            contextTemplate: '',
            inputMode: 'hybrid',
            captureScope: 'fullscreen',
            routes: ['OUT', 'YES', 'NO'],
            defaultRoute: 'OUT',
            toolChannels: ['*'],
            failSafeMaxToolCalls: 200,
          };
        }
        if (t === 'action.wait') {
          return { ms: 1000 };
        }
        if (t === 'action.typeText') {
          return { text: '' };
        }
        if (t === 'action.pressKey') {
          return { keyCombo: 'Enter' };
        }
        return {};
      };

      const newNode: Node = {
        id: `node_${Date.now()}`,
        type,
        position,
        data: {
          nodeType: type,
          data: defaultDataForType(type),
          isRunning: false,
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const onNodeClick = (_: any, node: Node) => {
    setSelectedNode(node as any);
  };

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    const menuWidth = 180;
    const menuHeight = 136;
    const x = Math.min(event.clientX, window.innerWidth - menuWidth - 8);
    const y = Math.min(event.clientY, window.innerHeight - menuHeight - 8);

    setSelectedNode(node as any);
    setContextMenu({ x, y, node });
  }, []);

  const handleCopyNode = useCallback((node: Node) => {
    const clonedData = node.data ? JSON.parse(JSON.stringify(node.data)) : node.data;
    const newNode: Node = {
      ...node,
      id: `node_${Date.now()}`,
      position: { x: node.position.x + 40, y: node.position.y + 40 },
      data: clonedData,
      selected: false,
      dragging: false,
    };

    setNodes((nds) => nds.concat(newNode));
    setSelectedNode(newNode as any);
    setContextMenu(null);
  }, [setNodes]);

  const handleEditNode = useCallback((node: Node) => {
    setSelectedNode(node as any);
    setContextMenu(null);
  }, []);

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    setSelectedNode((current) => (current?.id === nodeId ? null : current));
    setContextMenu(null);
  }, [setNodes, setEdges]);

  const onNodeDataChange = (nodeId: string, newData: any) => {
    setNodes((nds) =>
      nds.map((node) => (node.id === nodeId ? { ...node, data: newData } : node))
    );
    if (selectedNode?.id === nodeId) {
      setSelectedNode({ ...selectedNode, data: newData });
    }
  };

  const handleValidate = async () => {
    const graph = buildCurrentGraph();
    const result = await window.automation.flow.validateWorkflow(graph);
    setValidation(result);
    if (result.errors.length === 0 && result.warnings.length === 0) {
      alert('Workflow válido!');
    }
  };

  const handleRun = async () => {
    await handleValidate();
    // In a real scenario we'd check validation here
    window.automation.flow.runWorkflow(safeWorkflow.id);
  };

  const handleExportAI = useCallback(async () => {
    const graph = buildCurrentGraph();
    const exported = buildAiFriendlyExport(graph);
    const jsonText = JSON.stringify(exported, null, 2);
    const filename = `${slugifyWorkflowName(graph.name)}.ai-flow.json`;

    // Download JSON file
    const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);

    // Also copy to clipboard for quick AI prompting
    try {
      await navigator.clipboard.writeText(jsonText);
      alert(`Fluxo exportado como "${filename}" e copiado para clipboard.`);
    } catch {
      alert(`Fluxo exportado como "${filename}". (Clipboard indisponível neste ambiente)`);
    }
  }, [buildCurrentGraph]);

  const handleApplyAgentProposal = useCallback(async (proposal: { workflowName?: string; nodes: Node[]; edges: Edge[] }) => {
    const nextName = proposal.workflowName?.trim() || workflowName;
    setNodes(proposal.nodes);
    setEdges(proposal.edges);
    setWorkflowName(nextName);

    const graph: WorkflowGraph = {
      ...safeWorkflow,
      name: nextName,
      nodes: proposal.nodes as any,
      edges: proposal.edges as any,
      viewport: reactFlowInstance ? reactFlowInstance.getViewport() : safeWorkflow.viewport,
      updatedAt: Date.now(),
    };
    await window.automation.flow.saveWorkflow(graph);
    setValidation({ errors: [], warnings: [] });
  }, [workflowName, setNodes, setEdges, safeWorkflow, reactFlowInstance]);

  const handleCloseMonitor = useCallback(() => {
    setExecutionStatus(null);
    setTestStatus(null);
  }, []);

  const handleTestLog = useCallback((level: 'info' | 'success' | 'error' | 'warning', message: string) => {
    setTestStatus((prev) => {
      // Se a mensagem indica início de um novo teste, criar novo status
      const isNewTest = message.includes('Testando');
      const newStatus: FlowExecutionStatus = isNewTest ? {
        runId: `test_${Date.now()}`,
        workflowId: safeWorkflow.id,
        status: 'running',
        progress: 0,
        logs: [],
      } : (prev || {
        runId: `test_${Date.now()}`,
        workflowId: safeWorkflow.id,
        status: 'running',
        progress: 0,
        logs: [],
      });
      
      const newLog: FlowExecutionLog = {
        timestamp: Date.now(),
        level,
        message,
      };
      
      // Se a mensagem for "Teste finalizado", mudar status para completed
      const finalStatus = message === 'Teste finalizado.' ? 'completed' : newStatus.status;
      
      return {
        ...newStatus,
        status: finalStatus,
        logs: [...newStatus.logs, newLog],
      };
    });
  }, [safeWorkflow.id]);

  return (
    <div className={`automation-flow-editor ${isFullscreen ? 'is-fullscreen' : ''}`}>
      <FloatingToolbar
        onBack={onBack || (() => { })}
        onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
        isFullscreen={isFullscreen}
        onValidate={handleValidate}
        onSave={async () => {
          const graph = buildCurrentGraph();
          await window.automation.flow.saveWorkflow(graph);
        }}
        onExportAI={handleExportAI}
        onToggleAgent={() => setIsAgentOpen((current) => !current)}
        isAgentOpen={isAgentOpen}
        onRun={handleRun}
        isSaving={false} // TODO: Add saving state
      />

      <NodePalette />
      <WorkflowAgentChat
        isOpen={isAgentOpen}
        workflow={buildCurrentGraph()}
        onClose={() => setIsAgentOpen(false)}
        onApplyProposal={handleApplyAgentProposal}
      />

      <div className="workflow-canvas" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowWrapper}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeClick={onNodeClick}
          onNodeContextMenu={onNodeContextMenu}
          onPaneClick={() => setContextMenu(null)}
          onPaneContextMenu={(event) => {
            event.preventDefault();
            setContextMenu(null);
          }}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          defaultEdgeOptions={defaultEdgeOptions}
          connectionLineStyle={connectionLineStyle}
          fitView
          proOptions={{ hideAttribution: true }}
          onlyRenderVisibleElements={true}
        >
          <Background
            id="workflow-grid-fine"
            variant={BackgroundVariant.Lines}
            color="rgba(148, 163, 184, 0.16)"
            gap={20}
            size={1}
          />
          <Background
            id="workflow-grid-major"
            variant={BackgroundVariant.Lines}
            color="rgba(96, 165, 250, 0.22)"
            gap={100}
            size={1.35}
          />
          <Controls className="workflow-controls" />
          <MiniMap
            nodeStrokeColor="#6366f1"
            nodeColor="#1e293b"
            maskColor="rgba(0,0,0,0.6)"
            className="workflow-minimap"
          />
        </ReactFlow>
      </div>

      {contextMenu && (
        <div
          className="workflow-panel"
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            width: '180px',
            padding: '8px',
            zIndex: 10000,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div style={{ fontSize: '11px', color: 'var(--workflow-text-secondary)', margin: '4px 8px 8px' }}>
            {String((contextMenu.node.data as { nodeType?: string } | undefined)?.nodeType || contextMenu.node.type || '')}
          </div>
          <button
            className="btn-workflow"
            style={{ width: '100%', justifyContent: 'flex-start', marginBottom: '6px' }}
            onClick={() => handleCopyNode(contextMenu.node)}
          >
            <FlowIcon name="copy" size={14} /> Copiar
          </button>
          <button
            className="btn-workflow"
            style={{ width: '100%', justifyContent: 'flex-start', marginBottom: '6px' }}
            onClick={() => handleEditNode(contextMenu.node)}
          >
            <FlowIcon name="edit" size={14} /> Editar
          </button>
          <button
            className="btn-workflow"
            style={{ width: '100%', justifyContent: 'flex-start', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
            onClick={() => handleDeleteNode(contextMenu.node.id)}
          >
            <FlowIcon name="trash" size={14} /> Apagar
          </button>
        </div>
      )}

      <NodePropertiesPanel node={selectedNode} onChange={onNodeDataChange} onTestLog={handleTestLog} />

      {validation.errors.length > 0 && (
        <div className="workflow-panel" style={{ position: 'absolute', bottom: '80px', left: '20px', width: '300px', zIndex: 10 }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#ef4444' }}>ERROS DE VALIDAÇÃO</h4>
          {validation.errors.map((err, i) => (
            <div key={i} style={{ fontSize: '12px', color: '#ef4444', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FlowIcon name="xCircle" size={13} />
              <span>{err.message}</span>
            </div>
          ))}
        </div>
      )}

      <ExecutionMonitor
        status={executionStatus || testStatus}
        onRun={handleRun}
        onPause={() => window.automation.flow.pause()}
        onResume={() => window.automation.flow.resume()}
        onStop={() => window.automation.flow.stop()}
        onClose={handleCloseMonitor}
      />
    </div>
  );
}

export function WorkflowEditor(props: WorkflowEditorProps) {
  return (
    <ReactFlowProvider>
      <FlowEditorContent {...props} />
    </ReactFlowProvider>
  );
}
