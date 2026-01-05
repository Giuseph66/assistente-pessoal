import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  ReactFlowProvider,
  Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { WorkflowGraph, FlowNode, FlowEdge, AutomationNodeData, FlowExecutionStatus, FlowExecutionLog, MappingPoint, ImageTemplate } from '@ricky/shared';
import { NodePalette, NodePropertiesPanel, FloatingToolbar, ExecutionMonitor } from './WorkflowComponents';
import { StartNode } from './CustomNodes/StartNode';
import { EndNode } from './CustomNodes/EndNode';
import { ActionNode } from './CustomNodes/ActionNode';
import { FindImageNode } from './CustomNodes/FindImageNode';
import { LoopNode } from './CustomNodes/LoopNode';

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

function FlowEditorContent({ workflow = DEFAULT_WORKFLOW, onBack }: WorkflowEditorProps) {
  const safeWorkflow = workflow || DEFAULT_WORKFLOW;
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(safeWorkflow.nodes as any);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(safeWorkflow.edges as any);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [executionStatus, setExecutionStatus] = useState<FlowExecutionStatus | null>(null);
  const [testStatus, setTestStatus] = useState<FlowExecutionStatus | null>(null);
  const [validation, setValidation] = useState<{ errors: any[]; warnings: any[] }>({ errors: [], warnings: [] });
  const [isFullscreen, setIsFullscreen] = useState(false); // Default to false to respect WindowControls
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: Node } | null>(null);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowWrapper] = useState<any>(null);

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
      const graph: WorkflowGraph = {
        ...safeWorkflow,
        nodes: nodes as any,
        edges: edges as any,
        viewport: reactFlowInstance ? reactFlowInstance.getViewport() : safeWorkflow.viewport,
        updatedAt: Date.now(),
      };
      await window.automation.flow.saveWorkflow(graph);
    }, 1000);

    return () => clearTimeout(timer);
  }, [nodes, edges, workflow, reactFlowInstance]);

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
    const graph: WorkflowGraph = {
      ...safeWorkflow,
      nodes: nodes as any,
      edges: edges as any,
      viewport: reactFlowInstance ? reactFlowInstance.getViewport() : safeWorkflow.viewport,
    };
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
          const graph: WorkflowGraph = {
            ...safeWorkflow,
            nodes: nodes as any,
            edges: edges as any,
            viewport: reactFlowInstance ? reactFlowInstance.getViewport() : safeWorkflow.viewport,
            updatedAt: Date.now(),
          };
          await window.automation.flow.saveWorkflow(graph);
        }}
        onRun={handleRun}
        isSaving={false} // TODO: Add saving state
      />

      <NodePalette />

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
          fitView
          proOptions={{ hideAttribution: true }}
          onlyRenderVisibleElements={true}
        >
          <Background color="#1e293b" gap={20} />
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
            {contextMenu.node.data?.nodeType || contextMenu.node.type}
          </div>
          <button
            className="btn-workflow"
            style={{ width: '100%', justifyContent: 'flex-start', marginBottom: '6px' }}
            onClick={() => handleCopyNode(contextMenu.node)}
          >
            📋 Copiar
          </button>
          <button
            className="btn-workflow"
            style={{ width: '100%', justifyContent: 'flex-start', marginBottom: '6px' }}
            onClick={() => handleEditNode(contextMenu.node)}
          >
            ✏️ Editar
          </button>
          <button
            className="btn-workflow"
            style={{ width: '100%', justifyContent: 'flex-start', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
            onClick={() => handleDeleteNode(contextMenu.node.id)}
          >
            🗑️ Apagar
          </button>
        </div>
      )}

      <NodePropertiesPanel node={selectedNode} onChange={onNodeDataChange} onTestLog={handleTestLog} />

      {validation.errors.length > 0 && (
        <div className="workflow-panel" style={{ position: 'absolute', bottom: '80px', left: '20px', width: '300px', zIndex: 10 }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#ef4444' }}>ERROS DE VALIDAÇÃO</h4>
          {validation.errors.map((err, i) => (
            <div key={i} style={{ fontSize: '12px', color: '#ef4444', marginBottom: '4px' }}>❌ {err.message}</div>
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
