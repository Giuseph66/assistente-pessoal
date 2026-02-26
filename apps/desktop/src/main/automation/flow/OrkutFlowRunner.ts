import { EventEmitter } from 'events';
import { getLogger } from '@neo/logger';
import {
  WorkflowGraph,
  FlowNode,
  FlowExecutionStatus,
  FlowExecutionLog,
  FlowExecutionState,
  AIBrainData,
} from '@neo/shared';
import { getAutomationService } from '../AutomationService';
import { getMappingService } from '../MappingService';
import { OrkutFlowCompiler, CompiledGraph } from './OrkutFlowCompiler';
import { DatabaseManager } from '../../database';
import { FlowBrainExecutor } from './FlowBrainExecutor';

const logger = getLogger();

const MAX_STEPS_TOTAL = 10000;
const MAX_VISITS_PER_NODE = 1000;

export class OrkutFlowRunner extends EventEmitter {
  private status: FlowExecutionState = 'idle';
  private currentWorkflow: WorkflowGraph | null = null;
  private currentNode: FlowNode | null = null;
  private runId: string | null = null;
  private logs: FlowExecutionLog[] = [];
  private pauseRequested = false;
  private stopRequested = false;
  private visitCount = new Map<string, number>();
  private totalSteps = 0;

  // Loop control: nodeId -> currentCount
  private loopCounters = new Map<string, number>();
  
  // Armazenar coordenadas de imagens encontradas: templateName -> { x, y, width, height }
  private foundImageCoordinates = new Map<string, { x: number; y: number; width: number; height: number }>();
  // Última imagem encontrada (para clickFoundImage sem especificar template)
  private lastFoundImage: { x: number; y: number; width: number; height: number; templateName: string } | null = null;

  private automationService = getAutomationService();
  private mappingService = getMappingService();
  private compiler = new OrkutFlowCompiler();
  private brainExecutor: FlowBrainExecutor;

  constructor(private readonly db: DatabaseManager) {
    super();
    this.brainExecutor = new FlowBrainExecutor(db);
  }

  async run(workflow: WorkflowGraph): Promise<void> {
    if (this.status === 'running' || this.status === 'paused') {
      throw new Error('A workflow is already running');
    }

    this.runId = `flowrun_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.currentWorkflow = workflow;
    this.status = 'running';
    this.logs = [];
    this.visitCount.clear();
    this.loopCounters.clear();
    this.foundImageCoordinates.clear();
    this.lastFoundImage = null;
    this.totalSteps = 0;
    this.pauseRequested = false;
    this.stopRequested = false;

    this.addLog('info', `Iniciando workflow: ${workflow.name} (runId: ${this.runId})`);
    this.emitStatus();

    try {
      const compiled = this.compiler.compile(workflow);
      await this.executeLoop(compiled);
      
      if (this.stopRequested) {
        this.status = 'stopped';
        this.addLog('info', 'Workflow parado pelo usuário.');
      } else {
        this.status = 'completed';
        this.addLog('success', 'Workflow concluído com sucesso.');
      }
    } catch (error: any) {
      this.status = 'error';
      this.addLog('error', `Erro na execução: ${error.message}`);
      logger.error({ err: error, runId: this.runId }, 'OrkutFlowRunner error');
    } finally {
      this.emitStatus();
    }
  }

  private async executeLoop(compiled: CompiledGraph) {
    let currentNode = compiled.startNode;

    while (currentNode && !this.stopRequested) {
      // Pause check
      while (this.pauseRequested && !this.stopRequested) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (this.stopRequested) break;

      // Guardrails
      this.totalSteps++;
      if (this.totalSteps > MAX_STEPS_TOTAL) {
        throw new Error('Limite máximo de passos atingido (Potential infinite loop).');
      }

      const visits = (this.visitCount.get(currentNode.id) || 0) + 1;
      if (visits > MAX_VISITS_PER_NODE) {
        throw new Error(`O nó "${currentNode.id}" foi visitado muitas vezes (${MAX_VISITS_PER_NODE}). Possible infinite loop.`);
      }
      this.visitCount.set(currentNode.id, visits);

      this.currentNode = currentNode;
      this.emitNodeStarted(currentNode);
      
      // Execute Node
      const nextHandle = await this.executeNode(currentNode);
      this.emitNodeFinished(currentNode, nextHandle);

      if (currentNode.type === 'end') break;

      // Find next node
      const outgoing = compiled.edgesBySource.get(currentNode.id);
      const edge = outgoing?.get(nextHandle);
      
      if (!edge) {
        this.addLog('info', `Nenhuma conexão encontrada para o handle "${nextHandle}". Finalizando ramo.`);
        break;
      }

      const nextNode = compiled.nodeById.get(edge.target);
      if (!nextNode) {
        throw new Error(`Nó destino "${edge.target}" não encontrado.`);
      }

      currentNode = nextNode;
    }
  }

  private async executeNode(node: FlowNode): Promise<string> {
    const { nodeType, data } = node.data;

    this.addLog('info', `Executando: ${nodeType} (${node.id})`);

    switch (nodeType) {
      case 'start':
        return 'OUT';

      case 'end':
        return 'OUT';

      case 'action.clickMappedPoint': {
        const d = data as any;
        const point = this.mappingService.getMappingPointByName(d.mappingName);
        if (!point) throw new Error(`Ponto mapeado "${d.mappingName}" não encontrado.`);
        for (let i = 0; i < (d.clickCount || 1); i++) {
          await this.automationService.click(d.button, point.x, point.y);
        }
        if (d.postDelayMs) await new Promise((r) => setTimeout(r, d.postDelayMs));
        return 'OUT';
      }

      case 'action.clickCoordinates': {
        const d = data as any;
        for (let i = 0; i < (d.clickCount || 1); i++) {
          await this.automationService.click(d.button, d.x, d.y);
        }
        if (d.postDelayMs) await new Promise((r) => setTimeout(r, d.postDelayMs));
        return 'OUT';
      }

      case 'action.typeText': {
        const d = data as any;
        await this.automationService.type(d.text, d.speed);
        if (d.postDelayMs) await new Promise((r) => setTimeout(r, d.postDelayMs));
        return 'OUT';
      }

      case 'action.pressKey': {
        const d = data as any;
        const keys = Array.isArray(d.keyCombo) ? d.keyCombo : [d.keyCombo];
        const mainKey = keys[keys.length - 1];
        const modifiers = keys.slice(0, -1);
        const comboDisplay = modifiers.length > 0 
          ? `${modifiers.join(' + ')} + ${mainKey}`
          : mainKey;
        this.addLog('info', `Pressionando tecla: ${comboDisplay}`);
        try {
          await this.automationService.pressKey(mainKey, modifiers);
          this.addLog('success', `Tecla pressionada: ${comboDisplay}`);
        } catch (error: any) {
          this.addLog('error', `Erro ao pressionar tecla "${comboDisplay}": ${error?.message || 'Erro desconhecido'}`);
          throw error;
        }
        if (d.postDelayMs) await new Promise((r) => setTimeout(r, d.postDelayMs));
        return 'OUT';
      }

      case 'action.wait': {
        const d = data as any;
        await new Promise((r) => setTimeout(r, d.ms));
        return 'OUT';
      }

      case 'action.moveMouse': {
        const d = data as any;
        await this.automationService.moveMouse(d.x, d.y);
        return 'OUT';
      }

      case 'action.dragMouse': {
        const d = data as any;
        let fromX = 0, fromY = 0, toX = 0, toY = 0;

        if (typeof d.from === 'string') {
          const p = this.mappingService.getMappingPointByName(d.from);
          if (!p) throw new Error(`Ponto "from" ${d.from} não encontrado.`);
          fromX = p.x; fromY = p.y;
        } else {
          fromX = d.from.x; fromY = d.from.y;
        }

        if (typeof d.to === 'string') {
          const p = this.mappingService.getMappingPointByName(d.to);
          if (!p) throw new Error(`Ponto "to" ${d.to} não encontrado.`);
          toX = p.x; toY = p.y;
        } else {
          toX = d.to.x; toY = d.to.y;
        }

        await this.automationService.drag(fromX, fromY, toX, toY);
        return 'OUT';
      }

      case 'action.screenshot': {
        const d = data as any;
        await this.automationService.screenshot(d.region);
        if (d.postDelayMs) await new Promise((r) => setTimeout(r, d.postDelayMs));
        return 'OUT';
      }

      case 'condition.findImage': {
        const d = data as any;
        const found = await this.mappingService.findTemplateOnScreen(
          d.templateName,
          d.threshold,
          d.timeoutMs
        );
        if (found) {
          // Armazenar coordenadas encontradas
          this.foundImageCoordinates.set(d.templateName, found);
          this.lastFoundImage = { ...found, templateName: d.templateName };
          
          this.addLog('success', `Imagem "${d.templateName}" encontrada em (${found.x}, ${found.y}) - ${found.width}x${found.height}px.`);
          return 'FOUND';
        } else {
          this.addLog('warning', `Imagem "${d.templateName}" não encontrada.`);
          return 'NOT_FOUND';
        }
      }

      case 'action.clickFoundImage': {
        const d = data as any;
        
        // Buscar coordenadas: pode especificar templateName ou usar a última encontrada
        let coords: { x: number; y: number; width: number; height: number } | null = null;
        
        if (d.templateName) {
          coords = this.foundImageCoordinates.get(d.templateName) || null;
          if (!coords) {
            throw new Error(`Coordenadas da imagem "${d.templateName}" não encontradas. Execute um "Find Image" primeiro.`);
          }
        } else if (this.lastFoundImage) {
          coords = {
            x: this.lastFoundImage.x,
            y: this.lastFoundImage.y,
            width: this.lastFoundImage.width,
            height: this.lastFoundImage.height,
          };
        } else {
          throw new Error('Nenhuma imagem foi encontrada ainda. Execute um "Find Image" primeiro.');
        }
        
        // Calcular posição do clique baseado em clickPosition
        let clickX = coords.x;
        let clickY = coords.y;
        
        switch (d.clickPosition || 'center') {
          case 'center':
            clickX = coords.x + Math.floor(coords.width / 2);
            clickY = coords.y + Math.floor(coords.height / 2);
            break;
          case 'top-left':
            clickX = coords.x;
            clickY = coords.y;
            break;
          case 'top-right':
            clickX = coords.x + coords.width;
            clickY = coords.y;
            break;
          case 'bottom-left':
            clickX = coords.x;
            clickY = coords.y + coords.height;
            break;
          case 'bottom-right':
            clickX = coords.x + coords.width;
            clickY = coords.y + coords.height;
            break;
        }

        const parsedOffsetX = Number(d.offsetX);
        const parsedOffsetY = Number(d.offsetY);
        const offsetX = Number.isFinite(parsedOffsetX) ? parsedOffsetX : 0;
        const offsetY = Number.isFinite(parsedOffsetY) ? parsedOffsetY : 0;
        clickX += offsetX;
        clickY += offsetY;
        
        // Executar clique
        for (let i = 0; i < (d.clickCount || 1); i++) {
          await this.automationService.click(d.button || 'left', clickX, clickY);
        }
        
        if (d.postDelayMs) {
          await new Promise((r) => setTimeout(r, d.postDelayMs));
        }
        
        this.addLog('success', `Clicou na imagem encontrada em (${clickX}, ${clickY})`);
        return 'OUT';
      }

      case 'logic.loop': {
        const d = data as any;
        const current = this.loopCounters.get(node.id) || 0;

        if (d.mode === 'count') {
          if (current < d.count) {
            this.loopCounters.set(node.id, current + 1);
            this.addLog('info', `Loop ${current + 1}/${d.count}`);
            return 'LOOP';
          }
        } else if (d.mode === 'until') {
          const found = await this.mappingService.findTemplateOnScreen(
            d.untilTemplateName,
            0.8,
            d.timeoutMs
          );
          if (!found && current < d.maxIterations) {
            this.loopCounters.set(node.id, current + 1);
            return 'LOOP';
          }
        }

        this.loopCounters.set(node.id, 0); // Reset for next time
        return 'DONE';
      }

      case 'ai.brain': {
        const d = data as AIBrainData;
        this.addLog('info', `Nó IA iniciado (modo: ${d.inputMode || 'hybrid'})`);

        try {
          const nodeNeighborhood = this.buildNodeNeighborhood(node.id);
          const result = await this.brainExecutor.executeNode(node, {
            workflowId: this.currentWorkflow?.id || '',
            workflowName: this.currentWorkflow?.name || '',
            runId: this.runId || '',
            nodeId: node.id,
            nodeNeighborhood,
            lastFoundImage: this.lastFoundImage,
          });

          this.addLog(
            'info',
            `Nó IA finalizado com rota "${result.route}" (${result.toolCallsExecuted} tool-calls em ${result.turns} ciclos).`
          );
          if (result.message) {
            this.addLog('info', `IA: ${result.message}`);
          }
          return result.route || 'ERROR';
        } catch (error: any) {
          this.addLog('error', `Falha no nó IA. Seguindo por ERROR. (${error?.message || 'erro desconhecido'})`);
          logger.error({ err: error, nodeId: node.id, runId: this.runId }, 'ai.brain execution failed');
          return 'ERROR';
        }
      }

      default:
        throw new Error(`Tipo de nó não suportado: ${nodeType}`);
    }
  }

  private buildNodeNeighborhood(nodeId: string): {
    incoming: Array<{
      sourceHandle: string;
      sourceNodeId: string;
      sourceNodeType: string;
      sourceConfigPreview: Record<string, unknown>;
    }>;
    outgoing: Array<{
      route: string;
      targetNodeId: string;
      targetNodeType: string;
      targetConfigPreview: Record<string, unknown>;
    }>;
  } | null {
    if (!this.currentWorkflow) return null;

    const nodeById = new Map(this.currentWorkflow.nodes.map((node) => [node.id, node]));
    const summarizeConfig = (data: unknown): Record<string, unknown> => {
      if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
      const entries = Object.entries(data as Record<string, unknown>).slice(0, 8);
      const output: Record<string, unknown> = {};
      entries.forEach(([key, value]) => {
        if (typeof value === 'string' && value.length > 120) {
          output[key] = `${value.slice(0, 120)}...[truncated]`;
          return;
        }
        output[key] = value;
      });
      return output;
    };

    const incoming = this.currentWorkflow.edges
      .filter((edge) => edge.target === nodeId)
      .map((edge) => {
        const sourceNode = nodeById.get(edge.source);
        return {
          sourceHandle: edge.sourceHandle || 'OUT',
          sourceNodeId: edge.source,
          sourceNodeType: String(sourceNode?.data?.nodeType || sourceNode?.type || 'unknown'),
          sourceConfigPreview: summarizeConfig(sourceNode?.data?.data || {}),
        };
      });

    const outgoing = this.currentWorkflow.edges
      .filter((edge) => edge.source === nodeId)
      .map((edge) => {
        const targetNode = nodeById.get(edge.target);
        return {
          route: edge.sourceHandle || 'OUT',
          targetNodeId: edge.target,
          targetNodeType: String(targetNode?.data?.nodeType || targetNode?.type || 'unknown'),
          targetConfigPreview: summarizeConfig(targetNode?.data?.data || {}),
        };
      });

    return { incoming, outgoing };
  }

  private addLog(level: FlowExecutionLog['level'], message: string) {
    const log: FlowExecutionLog = {
      timestamp: Date.now(),
      level,
      message,
      nodeId: this.currentNode?.id,
    };
    this.logs.push(log);
    if (this.logs.length > 100) this.logs.shift();
    this.emitStatus();
  }

  private emitStatus() {
    const status: FlowExecutionStatus = {
      runId: this.runId || '',
      workflowId: this.currentWorkflow?.id || '',
      status: this.status,
      currentNodeId: this.currentNode?.id,
      progress: 0, // In graph workflows, progress is tricky
      logs: [...this.logs],
    };
    this.emit('status', status);
  }

  private emitNodeStarted(node: FlowNode) {
    this.emit('node.started', {
      runId: this.runId,
      workflowId: this.currentWorkflow?.id,
      nodeId: node.id,
      nodeType: node.type,
      timestamp: Date.now(),
    });
  }

  private emitNodeFinished(node: FlowNode, result: string) {
    this.emit('node.finished', {
      runId: this.runId,
      workflowId: this.currentWorkflow?.id,
      nodeId: node.id,
      result,
      timestamp: Date.now(),
    });
  }

  pause() {
    this.pauseRequested = true;
    this.status = 'paused';
    this.addLog('info', 'Pausa solicitada.');
  }

  resume() {
    this.pauseRequested = false;
    this.status = 'running';
    this.addLog('info', 'Execução retomada.');
  }

  stop() {
    this.stopRequested = true;
    this.pauseRequested = false;
    this.addLog('info', 'Parada solicitada.');
  }

  getStatus(): FlowExecutionStatus {
    return {
      runId: this.runId || '',
      workflowId: this.currentWorkflow?.id || '',
      status: this.status,
      currentNodeId: this.currentNode?.id,
      progress: 0,
      logs: [...this.logs],
    };
  }
}

let orkutFlowRunner: OrkutFlowRunner | null = null;

export function getOrkutFlowRunner(db?: DatabaseManager): OrkutFlowRunner {
  if (!orkutFlowRunner) {
    if (!db) {
      throw new Error('DatabaseManager é obrigatório na primeira inicialização do OrkutFlowRunner.');
    }
    orkutFlowRunner = new OrkutFlowRunner(db);
  }
  return orkutFlowRunner;
}
