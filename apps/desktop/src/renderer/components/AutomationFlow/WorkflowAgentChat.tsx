import { useMemo, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';
import type { FlowNodeType, WorkflowGraph } from '@neo/shared';
import { FlowIcon } from './FlowIcons';

type AgentRole = 'user' | 'assistant';

interface AgentMessage {
  id: string;
  role: AgentRole;
  content: string;
  createdAt: number;
}

interface AgentProposal {
  workflowName?: string;
  nodes: Node[];
  edges: Edge[];
}

interface AgentPayload {
  assistantMessage?: string;
  proposal?: {
    workflowName?: string;
    nodes?: unknown[];
    edges?: unknown[];
  } | null;
}

interface WorkflowAgentChatProps {
  isOpen: boolean;
  workflow: WorkflowGraph;
  onClose: () => void;
  onApplyProposal: (proposal: AgentProposal) => void;
}

const ALLOWED_NODE_TYPES = new Set<FlowNodeType>([
  'start',
  'end',
  'action.clickMappedPoint',
  'action.clickCoordinates',
  'action.clickFoundImage',
  'action.typeText',
  'action.pressKey',
  'action.wait',
  'action.moveMouse',
  'action.dragMouse',
  'action.screenshot',
  'condition.findImage',
  'logic.loop',
  'ai.brain',
]);

function ensureObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function sanitizeJsonValue(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeJsonValue(item));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      out[key] = sanitizeJsonValue(item);
    });
    return out;
  }
  return String(value);
}

function stripMarkdownFences(text: string): string {
  const trimmed = String(text || '').trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }
  return trimmed.replace(/```json/gi, '').replace(/```/g, '').trim();
}

function extractBalancedJsonObjects(text: string): string[] {
  const results: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }

    if (char === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        results.push(text.slice(start, index + 1).trim());
        start = -1;
      }
    }
  }

  return results;
}

function parsePayloadFromText(text: string): AgentPayload {
  const normalized = stripMarkdownFences(text);
  const candidates = [normalized, ...extractBalancedJsonObjects(normalized)];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as AgentPayload;
      }
    } catch {
      // ignore and try next
    }
  }

  return {
    assistantMessage: normalized || 'Nao foi possivel interpretar a resposta do agente.',
    proposal: null,
  };
}

function normalizeNode(input: unknown, index: number): Node | null {
  const raw = ensureObject(input);
  const inferredNodeType = String(
    raw.nodeType || ensureObject(raw.data).nodeType || raw.type || ''
  ).trim() as FlowNodeType;

  if (!ALLOWED_NODE_TYPES.has(inferredNodeType)) return null;

  const id = String(raw.id || `${inferredNodeType}_${Date.now()}_${index}`).trim();
  const positionRaw = ensureObject(raw.position);
  const x = Number(positionRaw.x);
  const y = Number(positionRaw.y);
  const position = {
    x: Number.isFinite(x) ? x : 120 + (index % 4) * 220,
    y: Number.isFinite(y) ? y : 120 + Math.floor(index / 4) * 140,
  };

  const payloadData =
    ensureObject(raw.data).data ||
    raw.config ||
    {};

  return {
    id,
    type: inferredNodeType,
    position,
    data: {
      nodeType: inferredNodeType,
      data: sanitizeJsonValue(payloadData),
      isRunning: false,
    },
  };
}

function normalizeEdge(input: unknown, index: number): Edge | null {
  const raw = ensureObject(input);
  const source = String(raw.source || '').trim();
  const target = String(raw.target || '').trim();
  if (!source || !target) return null;

  const sourceHandle = String(raw.sourceHandle || 'OUT').trim() || 'OUT';
  const targetHandle = raw.targetHandle ? String(raw.targetHandle).trim() : undefined;
  const id = String(raw.id || `edge_${source}_${target}_${sourceHandle}_${index}`).trim();

  return {
    id,
    source,
    target,
    sourceHandle,
    targetHandle,
  };
}

function summarizeGraph(graph: WorkflowGraph) {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  return {
    workflow: {
      id: graph.id,
      name: graph.name,
      version: graph.version,
      schemaVersion: graph.schemaVersion,
    },
    nodes: nodes.map((node) => ({
      id: node.id,
      nodeType: node.data?.nodeType || node.type,
      config: sanitizeJsonValue(node.data?.data || {}),
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      sourceHandle: edge.sourceHandle,
      target: edge.target,
      targetHandle: edge.targetHandle || null,
    })),
  };
}

export function WorkflowAgentChat({
  isOpen,
  workflow,
  onClose,
  onApplyProposal,
}: WorkflowAgentChatProps) {
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: 'agent-welcome',
      role: 'assistant',
      content: 'Descreva o fluxo que voce quer. Eu posso montar ou reorganizar os nos e conexoes.',
      createdAt: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [pendingProposal, setPendingProposal] = useState<AgentProposal | null>(null);

  const graphContext = useMemo(() => JSON.stringify(summarizeGraph(workflow), null, 2), [workflow]);

  if (!isOpen) {
    return null;
  }

  const addMessage = (role: AgentRole, content: string) => {
    const next: AgentMessage = {
      id: `${role}_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
      role,
      content,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, next]);
  };

  const sendToAgent = async () => {
    const prompt = inputText.trim();
    if (!prompt || isSending) return;

    addMessage('user', prompt);
    setInputText('');
    setIsSending(true);

    if (!window.ai?.analyzeText) {
      addMessage('assistant', 'Servico de IA indisponivel neste ambiente.');
      setIsSending(false);
      return;
    }

    const agentInstruction = [
      'Voce e um agente de automacao para montar workflows NEO.',
      'Com base no pedido do usuario e no CONTEXTO_DO_GRAFO, sugira um workflow organizado.',
      'Responda SOMENTE JSON valido no formato:',
      '{"assistantMessage":"texto curto","proposal":{"workflowName":"opcional","nodes":[...],"edges":[...]}}',
      'Se nao quiser alterar o fluxo, retorne proposal como null.',
      'Use apenas nodeType permitidos:',
      Array.from(ALLOWED_NODE_TYPES).join(', '),
      'Cada edge deve conter: id, source, target, sourceHandle.',
      'Nunca escreva markdown.',
    ].join('\n');

    try {
      const result = await window.ai.analyzeText({
        prompt: `${agentInstruction}\n\nPEDIDO_DO_USUARIO:\n${prompt}`,
        context: `CONTEXTO_DO_GRAFO:\n${graphContext}`,
        options: {
          temperature: 0.2,
          maxTokens: 2600,
        },
      });

      if (!result.success || !result.response?.answerText) {
        addMessage('assistant', result.error || 'Falha ao consultar o agente.');
        return;
      }

      const payload = parsePayloadFromText(result.response.answerText);
      const assistantText = String(payload.assistantMessage || 'Proposta gerada.').trim();
      addMessage('assistant', assistantText);

      const rawProposal = payload.proposal;
      if (!rawProposal || !Array.isArray(rawProposal.nodes) || !Array.isArray(rawProposal.edges)) {
        setPendingProposal(null);
        return;
      }

      const normalizedNodes = rawProposal.nodes
        .map((node, index) => normalizeNode(node, index))
        .filter((node): node is Node => Boolean(node));

      const nodeIds = new Set(normalizedNodes.map((node) => node.id));
      const normalizedEdges = rawProposal.edges
        .map((edge, index) => normalizeEdge(edge, index))
        .filter((edge): edge is Edge => Boolean(edge))
        .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));

      if (normalizedNodes.length === 0) {
        addMessage('assistant', 'A proposta nao trouxe nos validos. Refine o pedido com mais detalhes.');
        setPendingProposal(null);
        return;
      }

      setPendingProposal({
        workflowName: rawProposal.workflowName ? String(rawProposal.workflowName) : undefined,
        nodes: normalizedNodes,
        edges: normalizedEdges,
      });
    } catch (error: any) {
      addMessage('assistant', `Erro ao falar com agente: ${error?.message || 'erro desconhecido'}`);
    } finally {
      setIsSending(false);
    }
  };

  const applyProposal = () => {
    if (!pendingProposal) return;
    onApplyProposal(pendingProposal);
    addMessage(
      'assistant',
      `Proposta aplicada no canvas (${pendingProposal.nodes.length} nos, ${pendingProposal.edges.length} conexoes).`
    );
    setPendingProposal(null);
  };

  return (
    <div className="workflow-panel workflow-agent-panel">
      <div className="workflow-agent-header">
        <div className="workflow-agent-title">
          <FlowIcon name="brain" size={16} />
          <span>Agente de Fluxo</span>
        </div>
        <button className="btn-workflow" onClick={onClose} title="Fechar agente">
          <FlowIcon name="x" size={14} />
        </button>
      </div>

      <div className="workflow-agent-messages">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`workflow-agent-message workflow-agent-message-${message.role}`}
          >
            {message.content}
          </div>
        ))}
      </div>

      {pendingProposal && (
        <div className="workflow-agent-proposal">
          <div className="workflow-agent-proposal-title">
            Proposta pronta: {pendingProposal.nodes.length} nos, {pendingProposal.edges.length} conexoes
          </div>
          <div className="workflow-agent-proposal-actions">
            <button className="btn-workflow btn-workflow-primary" onClick={applyProposal}>
              Aplicar no Canvas
            </button>
            <button className="btn-workflow" onClick={() => setPendingProposal(null)}>
              Descartar
            </button>
          </div>
        </div>
      )}

      <div className="workflow-agent-input">
        <textarea
          className="workflow-input"
          value={inputText}
          onChange={(event) => setInputText(event.target.value)}
          placeholder="Ex.: organize esse fluxo com validacao de imagem e fallback de erro."
          rows={3}
        />
        <button className="btn-workflow btn-workflow-primary" onClick={sendToAgent} disabled={isSending}>
          {isSending ? 'Pensando...' : 'Enviar'}
        </button>
      </div>
    </div>
  );
}
