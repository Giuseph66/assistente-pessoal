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
  Panel,
  ReactFlowProvider,
  Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { WorkflowGraph, FlowNode, FlowEdge, AutomationNodeData, FlowExecutionStatus } from '@ricky/shared';
import { NodePalette } from './NodePalette';
import { NodePropertiesPanel } from './NodePropertiesPanel';
import { ExecutionMonitorPanel } from './ExecutionMonitorPanel';
import { StartNode } from './CustomNodes/StartNode';
import { EndNode } from './CustomNodes/EndNode';
import { ActionNode } from './CustomNodes/ActionNode';
import { FindImageNode } from './CustomNodes/FindImageNode';
import { LoopNode } from './CustomNodes/LoopNode';

import './OrkutFlowEditor.css';

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

interface OrkutFlowEditorProps {
  workflow: WorkflowGraph;
  onBack: () => void;
}

function FlowEditorContent({ workflow, onBack }: OrkutFlowEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(workflow.nodes as any);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(workflow.edges as any);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [executionStatus, setExecutionStatus] = useState<FlowExecutionStatus | null>(null);
  const [validation, setValidation] = useState<{ errors: any[]; warnings: any[] }>({ errors: [], warnings: [] });
  const [isFullscreen, setIsFullscreen] = useState(true); // Default to fullscreen for better UX
  
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
        ...workflow,
        nodes: nodes as any,
        edges: edges as any,
        viewport: reactFlowInstance ? reactFlowInstance.getViewport() : workflow.viewport,
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

      setEdges((eds) => addEdge(params, eds));
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

      const newNode: Node = {
        id: `node_${Date.now()}`,
        type,
        position,
        data: {
          nodeType: type,
          data: {},
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
      ...workflow,
      nodes: nodes as any,
      edges: edges as any,
      viewport: reactFlowInstance ? reactFlowInstance.getViewport() : workflow.viewport,
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
    window.automation.flow.runWorkflow(workflow.id);
  };

  return (
    <div className={`orkut-flow-editor ${isFullscreen ? 'is-fullscreen' : ''}`}>
      <div className="orkut-flow-canvas" ref={reactFlowWrapper}>
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
          nodeTypes={NODE_TYPES}
          fitView
        >
          <Background color="#333" gap={20} />
          <Controls />
          <MiniMap nodeStrokeColor="#6366f1" nodeColor="#1f2937" maskColor="rgba(0,0,0,0.5)" />
          
          <Panel position="top-left" style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-flow btn-flow-secondary" onClick={onBack}>
              ⬅️ Voltar
            </button>
            <button className="btn-flow btn-flow-secondary" onClick={() => setIsFullscreen(!isFullscreen)}>
              {isFullscreen ? '📉 Sair Tela Cheia' : '🖥️ Tela Cheia'}
            </button>
            <button className="btn-flow btn-flow-secondary" onClick={handleValidate}>
              📋 Validar
            </button>
          </Panel>
        </ReactFlow>
      </div>

      <div className="orkut-flow-sidebar">
        <NodePalette />
        <hr style={{ border: 'none', borderTop: '1px solid #374151', margin: '0' }} />
        {validation.errors.length > 0 && (
          <div className="validation-panel">
            <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#ef4444' }}>ERROS DE VALIDAÇÃO</h4>
            {validation.errors.map((err, i) => (
              <div key={i} className="validation-item validation-item-error">❌ {err.message}</div>
            ))}
          </div>
        )}
        <NodePropertiesPanel node={selectedNode} onChange={onNodeDataChange} />
      </div>

      <ExecutionMonitorPanel
        status={executionStatus}
        onRun={handleRun}
        onPause={() => window.automation.flow.pause()}
        onResume={() => window.automation.flow.resume()}
        onStop={() => window.automation.flow.stop()}
      />
    </div>
  );
}

export function OrkutFlowEditor(props: OrkutFlowEditorProps) {
  return (
    <ReactFlowProvider>
      <FlowEditorContent {...props} />
    </ReactFlowProvider>
  );
}

