import { getLogger } from '@neo/logger';
import {
  AIBrainData,
  AIConfig,
  AIProviderId,
  ChatRequest,
  FlowNode,
  MappingPoint,
  VisionRequest,
  VisionResponse,
  ImageTemplate,
} from '@neo/shared';
import { AutomationService, getAutomationService } from '../AutomationService';
import { MappingService, getMappingService } from '../MappingService';
import { DatabaseManager } from '../../database';
import { AIProviderManager, getAIProviderManager } from '../../ai/AIProviderManager';
import { ApiError, ApiKeyPool } from '../../ai/ApiKeyPool';
import { KeyStorage } from '../../ai/storage/KeyStorage';
import { AIConfigStore, getAIConfigStore } from '../../storage/aiConfigStore';

const logger = getLogger();

const DEFAULT_PROVIDER: AIProviderId = 'gemini';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_FAILSAFE_TOOL_CALLS = 200;
const MAX_TURNS_PER_NODE = 60;
const AI_DECISION_MAX_ATTEMPTS = 3;

type ToolArgs = Record<string, unknown>;

interface BrainToolCall {
  channel: string;
  args?: ToolArgs;
}

interface BrainResponsePayload {
  route?: string;
  toolCalls?: BrainToolCall[];
  message?: string;
  memoryPatch?: string;
}

interface ToolExecutionResult {
  channel: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

interface BrainRouteResult {
  route: string;
  toolCallsExecuted: number;
  turns: number;
  message?: string;
  memoryPatch?: string;
}

interface BrainExecutionContext {
  workflowId: string;
  workflowName: string;
  runId: string;
  nodeId: string;
  nodeNeighborhood?: {
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
  } | null;
  lastFoundImage?: {
    x: number;
    y: number;
    width: number;
    height: number;
    templateName?: string;
  } | null;
}

type ToolHandler = (args: ToolArgs) => Promise<unknown>;

export class FlowBrainExecutor {
  private readonly automationService: AutomationService;
  private readonly mappingService: MappingService;
  private readonly providerManager: AIProviderManager;
  private readonly keyStorage: KeyStorage;
  private readonly keyPool: ApiKeyPool;
  private readonly aiConfigStore: AIConfigStore;
  private readonly toolRegistry: Map<string, ToolHandler>;

  constructor(
    private readonly db: DatabaseManager,
    deps?: {
      automationService?: AutomationService;
      mappingService?: MappingService;
      providerManager?: AIProviderManager;
      keyStorage?: KeyStorage;
      aiConfigStore?: AIConfigStore;
      keyPool?: ApiKeyPool;
    }
  ) {
    this.automationService = deps?.automationService || getAutomationService();
    this.mappingService = deps?.mappingService || getMappingService();
    this.providerManager = deps?.providerManager || getAIProviderManager();
    this.keyStorage = deps?.keyStorage || new KeyStorage();
    this.aiConfigStore = deps?.aiConfigStore || getAIConfigStore();
    this.keyPool = deps?.keyPool || new ApiKeyPool(this.db, this.keyStorage);
    this.toolRegistry = this.buildToolRegistry();
  }

  async executeNode(node: FlowNode, context: BrainExecutionContext): Promise<BrainRouteResult> {
    const brainData = this.normalizeBrainData(node.data.data as AIBrainData);
    const validRoutes = new Set([...brainData.routes, 'ERROR']);
    const failSafeLimit = this.toPositiveInteger(brainData.failSafeMaxToolCalls, DEFAULT_FAILSAFE_TOOL_CALLS);
    const allowedChannels = this.resolveAllowedChannels(brainData.toolChannels);

    const conversation: Array<{ role: 'assistant' | 'user'; content: string }> = [];
    let toolCallsExecuted = 0;
    let latestMessage: string | undefined;
    let latestMemoryPatch: string | undefined;

    logger.info(
      {
        nodeId: context.nodeId,
        workflowId: context.workflowId,
        inputMode: brainData.inputMode,
        routes: brainData.routes,
        failSafeLimit,
      },
      'FlowBrainExecutor: starting ai.brain node'
    );

    for (let turn = 1; turn <= MAX_TURNS_PER_NODE; turn += 1) {
      const response = await this.requestAgentDecision(brainData, context, conversation);
      const parsed = this.parseAgentResponse(response.answerText);

      latestMessage = parsed.message || latestMessage;
      latestMemoryPatch = parsed.memoryPatch || latestMemoryPatch;

      if (parsed.route) {
        if (validRoutes.has(parsed.route)) {
          logger.info(
            { nodeId: context.nodeId, route: parsed.route, toolCallsExecuted, turn },
            'FlowBrainExecutor: route selected'
          );
          return {
            route: parsed.route,
            toolCallsExecuted,
            turns: turn,
            message: latestMessage,
            memoryPatch: latestMemoryPatch,
          };
        }

        logger.warn(
          { nodeId: context.nodeId, route: parsed.route, validRoutes: Array.from(validRoutes) },
          'FlowBrainExecutor: invalid route returned by AI'
        );
        return {
          route: 'ERROR',
          toolCallsExecuted,
          turns: turn,
          message: `Rota inválida: ${parsed.route}`,
          memoryPatch: latestMemoryPatch,
        };
      }

      const toolCalls = Array.isArray(parsed.toolCalls) ? parsed.toolCalls : [];
      if (toolCalls.length === 0) {
        logger.warn({ nodeId: context.nodeId, turn }, 'FlowBrainExecutor: no route and no toolCalls');
        return {
          route: 'ERROR',
          toolCallsExecuted,
          turns: turn,
          message: 'Resposta IA sem route e sem toolCalls',
          memoryPatch: latestMemoryPatch,
        };
      }

      const executionResults: ToolExecutionResult[] = [];
      for (const toolCall of toolCalls) {
        toolCallsExecuted += 1;
        if (toolCallsExecuted > failSafeLimit) {
          logger.error(
            { nodeId: context.nodeId, failSafeLimit, toolCallsExecuted },
            'FlowBrainExecutor: fail-safe tool limit reached'
          );
          return {
            route: 'ERROR',
            toolCallsExecuted,
            turns: turn,
            message: `Fail-safe atingido (${failSafeLimit} tool-calls)`,
            memoryPatch: latestMemoryPatch,
          };
        }

        const toolResult = await this.executeToolCall(toolCall, allowedChannels);
        executionResults.push(toolResult);
      }

      conversation.push({
        role: 'assistant',
        content: this.safeSerialize({
          route: parsed.route,
          message: parsed.message,
          memoryPatch: parsed.memoryPatch,
          toolCalls,
        }),
      });
      conversation.push({
        role: 'user',
        content: `RESULTADOS_DAS_FERRAMENTAS:\n${this.safeSerialize(executionResults)}\nCom base nisso, responda novamente SOMENTE em JSON.`,
      });
    }

    logger.error({ nodeId: context.nodeId }, 'FlowBrainExecutor: max turns reached');
    return {
      route: 'ERROR',
      toolCallsExecuted,
      turns: MAX_TURNS_PER_NODE,
      message: 'Limite de iterações do nó IA atingido',
      memoryPatch: latestMemoryPatch,
    };
  }

  private normalizeBrainData(data: AIBrainData): AIBrainData {
    const routes = Array.isArray(data?.routes)
      ? Array.from(new Set(data.routes.map((route) => String(route || '').trim()).filter((route) => Boolean(route) && route !== 'ERROR')))
      : [];
    const defaultRoute = routes.includes(data?.defaultRoute) ? data.defaultRoute : (routes[0] || 'OUT');
    const inputMode = data?.inputMode || 'hybrid';
    const captureScope = data?.captureScope || 'fullscreen';
    const toolChannels = Array.isArray(data?.toolChannels)
      ? data.toolChannels.map((c) => String(c || '').trim()).filter(Boolean)
      : ['*'];

    return {
      ...data,
      instruction: String(data?.instruction || '').trim(),
      contextTemplate: data?.contextTemplate ? String(data.contextTemplate) : '',
      inputMode,
      captureScope,
      captureRegion: data?.captureRegion,
      routes: routes.length ? routes : ['OUT'],
      defaultRoute,
      toolChannels: toolChannels.length ? toolChannels : ['*'],
      failSafeMaxToolCalls: this.toPositiveInteger(data?.failSafeMaxToolCalls, DEFAULT_FAILSAFE_TOOL_CALLS),
    };
  }

  private resolveAllowedChannels(channels: string[]): Set<string> | '*' {
    if (channels.some((channel) => channel === '*')) {
      return '*';
    }
    return new Set(channels);
  }

  private isChannelAllowed(channel: string, allowed: Set<string> | '*'): boolean {
    return allowed === '*' || allowed.has(channel);
  }

  private async requestAgentDecision(
    data: AIBrainData,
    context: BrainExecutionContext,
    conversation: Array<{ role: 'assistant' | 'user'; content: string }>
  ): Promise<VisionResponse> {
    const { providerId, modelName } = this.resolveProviderAndModel();
    const provider = this.providerManager.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider de IA indisponível: ${providerId}`);
    }

    const messages: ChatRequest['messages'] = [
      {
        role: 'system',
        content: [
          'Você é um orquestrador de automações.',
          'Responda apenas JSON válido, sem markdown e sem texto fora do JSON.',
          'Contrato JSON:',
          '{"route":"<ROTA_VALIDA_OU_ERROR>","toolCalls":[{"channel":"nome","args":{}}],"message":"opcional","memoryPatch":"opcional"}',
          'Se route for definida, ela deve ser uma das rotas válidas do nó ou ERROR.',
          'Se usar toolCalls, use nomes de channels exatos.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: this.buildUserPrompt(data, context),
      },
      ...conversation,
    ];

    const options = {
      modelName,
      temperature: typeof data.temperature === 'number' ? data.temperature : undefined,
      maxTokens: typeof data.maxTokens === 'number' ? data.maxTokens : undefined,
    };

    let lastError: unknown;
    for (let attempt = 1; attempt <= AI_DECISION_MAX_ATTEMPTS; attempt += 1) {
      const key = await this.keyPool.getNextKeyAsync(providerId);
      if (!key) {
        throw new Error(`Nenhuma API key disponível para provider "${providerId}"`);
      }

      try {
        if (data.inputMode === 'context') {
          const response = await provider.analyzeText({ messages, options }, key.key);
          if (key.id > 0) this.keyPool.markSuccess(key.id);
          return response;
        }

        const screenshot = await this.captureForMode(data);
        const visionRequest: VisionRequest = {
          image: screenshot,
          messages,
          options,
        };
        const response = await provider.analyzeImage(visionRequest, key.key);
        if (key.id > 0) this.keyPool.markSuccess(key.id);
        return response;
      } catch (error: any) {
        if (data.inputMode !== 'context' && this.shouldFallbackToContextDecision(error)) {
          logger.warn(
            {
              nodeId: context.nodeId,
              attempt,
              inputMode: data.inputMode,
              reason: error?.message || String(error),
            },
            'FlowBrainExecutor: visual decision failed, falling back to context-only decision'
          );

          try {
            const fallbackMessages: ChatRequest['messages'] = [
              ...messages,
              {
                role: 'user',
                content: [
                  'ENTRADA_VISUAL_INDISPONIVEL nesta tentativa.',
                  `Motivo: ${String(error?.message || error || 'erro desconhecido').slice(0, 300)}.`,
                  'Continue apenas com contexto textual e responda SOMENTE JSON válido.',
                ].join('\n'),
              },
            ];
            const fallbackResponse = await provider.analyzeText({ messages: fallbackMessages, options }, key.key);
            if (key.id > 0) this.keyPool.markSuccess(key.id);
            return fallbackResponse;
          } catch (fallbackError: any) {
            lastError = fallbackError;
            if (key.id > 0) {
              this.keyPool.markFailure(key.id, this.toApiError(fallbackError));
            }

            const retryable = this.isRetryableDecisionError(fallbackError);
            const shouldRetry = retryable && attempt < AI_DECISION_MAX_ATTEMPTS;
            logger.warn(
              {
                nodeId: context.nodeId,
                attempt,
                maxAttempts: AI_DECISION_MAX_ATTEMPTS,
                retryable,
                error: fallbackError?.message || String(fallbackError),
              },
              'FlowBrainExecutor: context fallback attempt failed'
            );

            if (!shouldRetry) {
              throw fallbackError;
            }

            await this.sleep(200 * attempt);
            continue;
          }
        }

        lastError = error;
        if (key.id > 0) {
          this.keyPool.markFailure(key.id, this.toApiError(error));
        }

        const retryable = this.isRetryableDecisionError(error);
        const shouldRetry = retryable && attempt < AI_DECISION_MAX_ATTEMPTS;
        logger.warn(
          {
            nodeId: context.nodeId,
            attempt,
            maxAttempts: AI_DECISION_MAX_ATTEMPTS,
            retryable,
            error: error?.message || String(error),
          },
          'FlowBrainExecutor: AI decision attempt failed'
        );

        if (!shouldRetry) {
          throw error;
        }

        await this.sleep(200 * attempt);
      }
    }

    throw (lastError instanceof Error ? lastError : new Error('Falha desconhecida na decisão da IA'));
  }

  private buildUserPrompt(data: AIBrainData, context: BrainExecutionContext): string {
    const routeList = data.routes.join(', ');
    const tools = data.toolChannels.join(', ');

    const runtimeState = {
      workflowId: context.workflowId,
      workflowName: context.workflowName,
      runId: context.runId,
      nodeId: context.nodeId,
      nodeNeighborhood: context.nodeNeighborhood || null,
      inputMode: data.inputMode,
      captureScope: data.captureScope,
      routes: data.routes,
      defaultRoute: data.defaultRoute,
      toolChannels: data.toolChannels,
      lastFoundImage: context.lastFoundImage || null,
    };

    return [
      `INSTRUCAO_DO_NO:\n${data.instruction || 'Sem instrução definida.'}`,
      data.contextTemplate ? `\nTEMPLATE_DE_CONTEXTO:\n${data.contextTemplate}` : '',
      `\nROTAS_VALIDAS: ${routeList}`,
      `\nROTA_PADRAO: ${data.defaultRoute}`,
      `\nCANAIS_PERMITIDOS: ${tools}`,
      `\nESTADO_RUNTIME:\n${this.safeSerialize(runtimeState)}`,
      '\nRetorne somente JSON válido.',
    ].join('\n');
  }

  private async captureForMode(data: AIBrainData): Promise<VisionRequest['image']> {
    const region = data.captureScope === 'region' ? this.normalizeRegion(data.captureRegion) : undefined;
    const imageBuffer = await this.automationService.screenshot(region);
    const base64Raw = imageBuffer.toString('base64');
    return {
      base64Raw,
      base64DataUrl: `data:image/png;base64,${base64Raw}`,
      mimeType: 'image/png',
      base64: base64Raw,
    };
  }

  private normalizeRegion(region?: { x: number; y: number; width: number; height: number }) {
    if (!region) return undefined;
    const width = Math.max(1, Math.round(Number(region.width) || 1));
    const height = Math.max(1, Math.round(Number(region.height) || 1));
    const x = Math.round(Number(region.x) || 0);
    const y = Math.round(Number(region.y) || 0);
    return { x, y, width, height };
  }

  private parseAgentResponse(answerText: string): BrainResponsePayload {
    const normalized = this.stripMarkdownFences(answerText);
    const parsed = this.parseJsonObjectFromText(normalized);

    const route = typeof parsed.route === 'string' ? parsed.route.trim() : undefined;
    const toolCalls = Array.isArray(parsed.toolCalls)
      ? parsed.toolCalls
          .map((call: any) => ({
            channel: String(call?.channel || '').trim(),
            args: this.ensureObject(call?.args),
          }))
          .filter((call: BrainToolCall) => call.channel.length > 0)
      : undefined;

    return {
      route: route || undefined,
      toolCalls,
      message: typeof parsed.message === 'string' ? parsed.message : undefined,
      memoryPatch: typeof parsed.memoryPatch === 'string' ? parsed.memoryPatch : undefined,
    };
  }

  private stripMarkdownFences(text: string): string {
    const trimmed = String(text || '').trim();
    const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fencedMatch?.[1]) {
      return fencedMatch[1].trim();
    }
    // Fallback: remove fences inline quando a resposta vem com texto adicional.
    return trimmed
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
  }

  private parseJsonObjectFromText(text: string): Record<string, unknown> {
    const trimmed = text.trim();
    const candidates = [trimmed, ...this.extractBalancedJsonObjects(trimmed)];
    let lastError: unknown = null;

    for (const candidate of candidates) {
      if (!candidate) continue;
      try {
        const parsed = JSON.parse(candidate);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch (error) {
        lastError = error;
      }
    }

    const reason =
      lastError && typeof lastError === 'object' && 'message' in (lastError as any)
        ? String((lastError as any).message)
        : 'Resposta IA não contém JSON válido';
    throw new Error(`Falha ao parsear JSON da IA: ${reason}`);
  }

  private extractBalancedJsonObjects(text: string): string[] {
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

  private async executeToolCall(
    toolCall: BrainToolCall,
    allowedChannels: Set<string> | '*'
  ): Promise<ToolExecutionResult> {
    const channel = toolCall.channel;
    if (!this.isChannelAllowed(channel, allowedChannels)) {
      return {
        channel,
        ok: false,
        error: `Canal não permitido para este nó: ${channel}`,
      };
    }

    const handler = this.toolRegistry.get(channel);
    if (!handler) {
      return {
        channel,
        ok: false,
        error: `Canal inexistente: ${channel}`,
      };
    }

    try {
      const result = await handler(toolCall.args || {});
      logger.info({ channel }, 'FlowBrainExecutor: tool executed');
      return {
        channel,
        ok: true,
        result,
      };
    } catch (error: any) {
      logger.warn({ channel, err: error }, 'FlowBrainExecutor: tool execution failed');
      return {
        channel,
        ok: false,
        error: error?.message || 'Erro ao executar ferramenta',
      };
    }
  }

  private buildToolRegistry(): Map<string, ToolHandler> {
    return new Map<string, ToolHandler>([
      ['automation.moveMouse', async (args) => this.withMoveMouse(args)],
      ['automation.click', async (args) => this.withClick(args)],
      ['automation.doubleClick', async (args) => this.withDoubleClick(args)],
      ['automation.drag', async (args) => this.withDrag(args)],
      ['automation.typeText', async (args) => this.withTypeText(args)],
      ['automation.pressKey', async (args) => this.withPressKey(args)],
      ['automation.pasteText', async (args) => this.withPasteText(args)],
      ['automation.wait', async (args) => this.withWait(args)],
      ['automation.getMousePosition', async () => this.automationService.getMousePosition()],
      ['automation.getScreenSize', async () => this.automationService.getScreenSize()],
      ['automation.screenshot', async (args) => this.withScreenshot(args)],
      ['mapping.findTemplateOnScreen', async (args) => this.withFindTemplateOnScreen(args)],
      ['mapping.getMappingPointByName', async (args) => this.withGetMappingPointByName(args)],
      ['mapping.getImageTemplateByName', async (args) => this.withGetImageTemplateByName(args)],
      ['mapping.addMappingPoint', async (args) => this.withAddMappingPoint(args)],
      ['mapping.updateMappingPoint', async (args) => this.withUpdateMappingPoint(args)],
      ['mapping.deleteMappingPoint', async (args) => this.withDeleteMappingPoint(args)],
      ['mapping.captureTemplate', async (args) => this.withCaptureTemplate(args)],
      ['mapping.importImageTemplate', async (args) => this.withImportImageTemplate(args)],
      ['mapping.updateImageTemplate', async (args) => this.withUpdateImageTemplate(args)],
      ['mapping.deleteImageTemplate', async (args) => this.withDeleteImageTemplate(args)],
    ]);
  }

  private async withMoveMouse(args: ToolArgs) {
    const x = this.requireNumber(args.x, 'x');
    const y = this.requireNumber(args.y, 'y');
    await this.automationService.moveMouse(x, y);
    return { ok: true, x, y };
  }

  private async withClick(args: ToolArgs) {
    const button = this.toMouseButton(args.button);
    const x = this.optionalNumber(args.x);
    const y = this.optionalNumber(args.y);
    await this.automationService.click(button, x, y);
    return { ok: true, button, x, y };
  }

  private async withDoubleClick(args: ToolArgs) {
    const button = this.toMouseButton(args.button);
    const x = this.optionalNumber(args.x);
    const y = this.optionalNumber(args.y);
    await this.automationService.doubleClick(button, x, y);
    return { ok: true, button, x, y };
  }

  private async withDrag(args: ToolArgs) {
    const fromX = this.requireNumber(args.fromX, 'fromX');
    const fromY = this.requireNumber(args.fromY, 'fromY');
    const toX = this.requireNumber(args.toX, 'toX');
    const toY = this.requireNumber(args.toY, 'toY');
    const button = this.toMouseButton(args.button);
    await this.automationService.drag(fromX, fromY, toX, toY, button);
    return { ok: true, fromX, fromY, toX, toY, button };
  }

  private async withTypeText(args: ToolArgs) {
    const text = this.requireString(args.text, 'text');
    const delayMs = this.optionalNumber(args.delayMs);
    await this.automationService.type(text, delayMs);
    return { ok: true, textLength: text.length, delayMs };
  }

  private async withPressKey(args: ToolArgs) {
    const key = this.requireString(args.key, 'key');
    const modifiers = this.optionalStringArray(args.modifiers);
    await this.automationService.pressKey(key, modifiers);
    return { ok: true, key, modifiers };
  }

  private async withPasteText(args: ToolArgs) {
    const text = this.requireString(args.text, 'text');
    await this.automationService.pasteText(text);
    return { ok: true, textLength: text.length };
  }

  private async withWait(args: ToolArgs) {
    const ms = this.requireNumber(args.ms, 'ms');
    await this.automationService.wait(ms);
    return { ok: true, ms };
  }

  private async withScreenshot(args: ToolArgs) {
    const region = this.ensureRegionObject(args.region);
    const buffer = await this.automationService.screenshot(region);
    const base64 = buffer.toString('base64');
    return {
      mimeType: 'image/png',
      bytes: buffer.length,
      base64DataUrl: `data:image/png;base64,${base64}`,
    };
  }

  private async withFindTemplateOnScreen(args: ToolArgs) {
    const templateName = this.requireString(args.templateName, 'templateName');
    const confidence = this.optionalNumber(args.confidence);
    const timeout = this.optionalNumber(args.timeout);
    const found = await this.mappingService.findTemplateOnScreen(templateName, confidence, timeout);
    return found;
  }

  private async withGetMappingPointByName(args: ToolArgs): Promise<MappingPoint | null> {
    const name = this.requireString(args.name, 'name');
    return this.mappingService.getMappingPointByName(name) || null;
  }

  private async withGetImageTemplateByName(args: ToolArgs): Promise<ImageTemplate | null> {
    const name = this.requireString(args.name, 'name');
    return this.mappingService.getImageTemplateByName(name) || null;
  }

  private async withAddMappingPoint(args: ToolArgs) {
    const name = this.requireString(args.name, 'name');
    const x = this.requireNumber(args.x, 'x');
    const y = this.requireNumber(args.y, 'y');
    const type = this.optionalString(args.type) || 'click';
    return this.mappingService.addMappingPoint(name, x, y, type as any);
  }

  private async withUpdateMappingPoint(args: ToolArgs) {
    const id = this.requireString(args.id, 'id');
    const updates = this.ensureObject(args.updates) as Partial<Omit<MappingPoint, 'id' | 'createdAt'>>;
    return this.mappingService.updateMappingPoint(id, updates);
  }

  private async withDeleteMappingPoint(args: ToolArgs) {
    const id = this.requireString(args.id, 'id');
    return this.mappingService.deleteMappingPoint(id);
  }

  private async withCaptureTemplate(args: ToolArgs) {
    const name = this.requireString(args.name, 'name');
    const region = this.ensureRegionObject(args.region);
    return this.mappingService.captureTemplate(name, region);
  }

  private async withImportImageTemplate(args: ToolArgs) {
    const name = this.requireString(args.name, 'name');
    const dataUrl = this.requireString(args.dataUrl, 'dataUrl');
    return this.mappingService.importImageTemplate(name, dataUrl);
  }

  private async withUpdateImageTemplate(args: ToolArgs) {
    const id = this.requireString(args.id, 'id');
    const updates = this.ensureObject(args.updates) as Partial<Omit<ImageTemplate, 'id' | 'createdAt'>>;
    return this.mappingService.updateImageTemplate(id, updates);
  }

  private async withDeleteImageTemplate(args: ToolArgs) {
    const id = this.requireString(args.id, 'id');
    return this.mappingService.deleteImageTemplate(id);
  }

  private resolveProviderAndModel(): { providerId: AIProviderId; modelName: string } {
    const saved = this.aiConfigStore.getLastConfig() as Partial<AIConfig> & {
      provider?: AIProviderId;
      model?: string;
    };

    const preferredProvider = (saved.providerId || saved.provider || DEFAULT_PROVIDER) as AIProviderId;
    const providerId = this.providerManager.hasProvider(preferredProvider)
      ? preferredProvider
      : DEFAULT_PROVIDER;

    return {
      providerId,
      modelName: saved.modelName || saved.model || DEFAULT_MODEL,
    };
  }

  private toApiError(error: any): ApiError {
    const statusCode = Number(
      error?.statusCode ??
      error?.status ??
      error?.response?.status ??
      error?.cause?.statusCode
    );
    const normalizedStatus = Number.isFinite(statusCode) ? statusCode : undefined;
    const code = String(error?.code || error?.error?.code || (normalizedStatus ? `HTTP_${normalizedStatus}` : 'unknown_error'));
    return {
      code,
      statusCode: normalizedStatus,
      message: error?.message || 'AI provider error',
    };
  }

  private isRetryableDecisionError(error: any): boolean {
    const statusCode = Number(
      error?.statusCode ??
      error?.status ??
      error?.response?.status ??
      error?.cause?.statusCode
    );

    if (Number.isFinite(statusCode)) {
      const status = statusCode as number;
      if (status === 408 || status === 409 || status === 425 || status === 429) return true;
      if (status >= 500 && status <= 599) return true;
    }

    const message = String(error?.message || error || '').toLowerCase();
    const code = String(error?.code || '').toLowerCase();
    const transientHints = [
      'terminated',
      'abort',
      'timeout',
      'timed out',
      'socket hang up',
      'network',
      'connection reset',
      'econnreset',
      'etimedout',
      'ehostunreach',
      'temporary',
      'unavailable',
    ];

    if (transientHints.some((hint) => message.includes(hint))) return true;
    if (transientHints.some((hint) => code.includes(hint))) return true;
    return false;
  }

  private shouldFallbackToContextDecision(error: any): boolean {
    if (this.isRetryableDecisionError(error)) return true;

    const message = String(error?.message || error || '').toLowerCase();
    const code = String(error?.code || '').toLowerCase();
    const visualHints = [
      'screenshot',
      'capture',
      'grab',
      'image',
      'vision',
      'vips',
      'sharp',
      'invalid image',
      'failed to capture',
    ];

    if (visualHints.some((hint) => message.includes(hint))) return true;
    if (visualHints.some((hint) => code.includes(hint))) return true;
    return false;
  }

  private ensureObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private requireString(value: unknown, field: string): string {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      throw new Error(`Campo obrigatório ausente: ${field}`);
    }
    return normalized;
  }

  private optionalString(value: unknown): string | undefined {
    const normalized = String(value ?? '').trim();
    return normalized || undefined;
  }

  private requireNumber(value: unknown, field: string): number {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      throw new Error(`Campo numérico inválido: ${field}`);
    }
    return num;
  }

  private optionalNumber(value: unknown): number | undefined {
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
  }

  private optionalStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  private ensureRegionObject(value: unknown): { x: number; y: number; width: number; height: number } | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const region = value as Record<string, unknown>;
    return {
      x: this.requireNumber(region.x, 'region.x'),
      y: this.requireNumber(region.y, 'region.y'),
      width: Math.max(1, this.requireNumber(region.width, 'region.width')),
      height: Math.max(1, this.requireNumber(region.height, 'region.height')),
    };
  }

  private toMouseButton(value: unknown): 'left' | 'right' | 'middle' {
    const raw = String(value || 'left').toLowerCase();
    if (raw === 'right') return 'right';
    if (raw === 'middle') return 'middle';
    return 'left';
  }

  private toPositiveInteger(value: unknown, fallback: number): number {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 1) return fallback;
    return Math.round(num);
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private safeSerialize(payload: unknown): string {
    return JSON.stringify(
      payload,
      (_key, value) => {
        if (typeof value === 'string' && value.length > 400) {
          return `${value.slice(0, 220)}...[truncated ${value.length - 220} chars]`;
        }
        return value;
      },
      2
    );
  }
}
