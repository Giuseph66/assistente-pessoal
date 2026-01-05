import { WorkflowGraph, FlowNode, FlowEdge } from '@ricky/shared';

export interface ValidationIssue {
  type: 'error' | 'warning';
  message: string;
  nodeId?: string;
}

export interface CompiledGraph {
  nodeById: Map<string, FlowNode>;
  edgesBySource: Map<string, Map<string, FlowEdge>>; // Map<nodeId, Map<sourceHandle, edge>>
  startNode: FlowNode;
}

export class OrkutFlowCompiler {
  validate(graph: WorkflowGraph): { errors: ValidationIssue[]; warnings: ValidationIssue[] } {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    // 1. Exactly one Start Node
    const startNodes = graph.nodes.filter((n) => n.type === 'start');
    if (startNodes.length === 0) {
      errors.push({ type: 'error', message: 'Workflow deve ter exatamente um Start Node.' });
    } else if (startNodes.length > 1) {
      errors.push({ type: 'error', message: 'Workflow não pode ter múltiplos Start Nodes.' });
    }

    // 2. Handle connections (1 edge per sourceHandle)
    const handleUsage = new Map<string, Set<string>>(); // nodeID -> Set<handle>
    for (const edge of graph.edges) {
      if (!handleUsage.has(edge.source)) {
        handleUsage.set(edge.source, new Set());
      }
      const nodeHandles = handleUsage.get(edge.source)!;
      if (nodeHandles.has(edge.sourceHandle)) {
        errors.push({
          type: 'error',
          message: `O handle "${edge.sourceHandle}" já tem uma conexão. Apenas uma conexão por saída é permitida.`,
          nodeId: edge.source,
        });
      }
      nodeHandles.add(edge.sourceHandle);
    }

    // 3. Check for mandatory branches (warnings)
    for (const node of graph.nodes) {
      if (node.type === 'condition.findImage') {
        const usage = handleUsage.get(node.id);
        if (!usage?.has('FOUND')) {
          warnings.push({
            type: 'warning',
            message: 'Ação "Find Image" não tem saída para "FOUND". O workflow encerrará se a imagem for encontrada.',
            nodeId: node.id,
          });
        }
        if (!usage?.has('NOT_FOUND')) {
          warnings.push({
            type: 'warning',
            message: 'Ação "Find Image" não tem saída para "NOT_FOUND". O workflow encerrará se a imagem não for encontrada.',
            nodeId: node.id,
          });
        }
      } else if (node.type === 'logic.loop') {
        const usage = handleUsage.get(node.id);
        if (!usage?.has('LOOP')) {
          warnings.push({
            type: 'warning',
            message: 'Loop não tem saída "LOOP". Ele nunca executará o conteúdo do loop.',
            nodeId: node.id,
          });
        }
        if (!usage?.has('DONE')) {
          warnings.push({
            type: 'warning',
            message: 'Loop não tem saída "DONE". O workflow encerrará após o loop terminar.',
            nodeId: node.id,
          });
        }
      }
    }

    // 4. Reachability (warning)
    if (startNodes.length === 1) {
      const reachableNodes = new Set<string>();
      const queue = [startNodes[0].id];
      reachableNodes.add(startNodes[0].id);

      while (queue.length > 0) {
        const currentId = queue.shift()!;
        const outgoingEdges = graph.edges.filter((e) => e.source === currentId);
        for (const edge of outgoingEdges) {
          if (!reachableNodes.has(edge.target)) {
            reachableNodes.add(edge.target);
            queue.push(edge.target);
          }
        }
      }

      for (const node of graph.nodes) {
        if (!reachableNodes.has(node.id)) {
          warnings.push({
            type: 'warning',
            message: 'Nó inalcançável a partir do Start Node.',
            nodeId: node.id,
          });
        }
      }
    }

    return { errors, warnings };
  }

  compile(graph: WorkflowGraph): CompiledGraph {
    const { errors } = this.validate(graph);
    if (errors.length > 0) {
      throw new Error(`Grafo inválido: ${errors[0].message}`);
    }

    const nodeById = new Map<string, FlowNode>();
    for (const node of graph.nodes) {
      nodeById.set(node.id, node);
    }

    const edgesBySource = new Map<string, Map<string, FlowEdge>>();
    for (const edge of graph.edges) {
      if (!edgesBySource.has(edge.source)) {
        edgesBySource.set(edge.source, new Map());
      }
      edgesBySource.get(edge.source)!.set(edge.sourceHandle, edge);
    }

    const startNode = graph.nodes.find((n) => n.type === 'start')!;

    return { nodeById, edgesBySource, startNode };
  }
}

