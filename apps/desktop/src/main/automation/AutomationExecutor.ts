import { EventEmitter } from 'events';
import { getLogger } from '@neo/logger';
import { getAutomationStore } from '../storage/automationStore';
import { getAutomationService } from './AutomationService';
import { getMappingService } from './MappingService';
import {
  Workflow,
  WorkflowStep,
  AutomationAction,
  ExecutionStatus,
  ExecutionLog,
  ClickAction,
  ClickAtAction,
  TypeAction,
  PressKeyAction,
  WaitAction,
  ScreenshotAction,
  FindImageAction,
  MoveMouseAction,
  DragAction,
  LoopAction,
  ConditionAction,
} from '@neo/shared';

const logger = getLogger();

type ExecutionState = 'idle' | 'running' | 'paused' | 'stopped' | 'error';

export class AutomationExecutor extends EventEmitter {
  private state: ExecutionState = 'idle';
  private currentWorkflow: Workflow | null = null;
  private currentStepIndex: number = -1;
  private currentStep: WorkflowStep | null = null;
  private error: string | null = null;
  private logs: ExecutionLog[] = [];
  private pauseRequested = false;
  private stopRequested = false;
  private loopStack: Array<{ count: number; current: number; stepIndex: number }> = [];

  private store = getAutomationStore();
  private automationService = getAutomationService();
  private mappingService = getMappingService();

  async executeWorkflow(workflowId: string): Promise<void> {
    if (this.state === 'running') {
      throw new Error('Another workflow is already running');
    }

    const workflow = this.store.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow "${workflowId}" not found`);
    }

    if (!workflow.enabled) {
      throw new Error(`Workflow "${workflow.name}" is disabled`);
    }

    // Validação prévia: verificar se todos os recursos necessários existem
    this.addLog('info', `Validating workflow "${workflow.name}"...`);
    const validationErrors: string[] = [];
    for (const step of workflow.steps) {
      const action = step.action;
      if (action.type === 'click' && (action as any).params?.mappingPoint) {
        const point = this.mappingService.getMappingPointByName((action as any).params.mappingPoint);
        if (!point) {
          validationErrors.push(`Mapping point "${(action as any).params.mappingPoint}" not found`);
        }
      }
      if (action.type === 'findImage' || action.type === 'wait') {
        const templateName = (action as any).params?.templateName || (action as any).params?.orUntilImage;
        if (templateName) {
          const template = this.mappingService.getImageTemplateByName(templateName);
          if (!template) {
            validationErrors.push(`Image template "${templateName}" not found`);
          }
        }
      }
    }
    
    if (validationErrors.length > 0) {
      const errorMsg = `Validation failed:\n${validationErrors.join('\n')}`;
      this.addLog('error', errorMsg);
      throw new Error(errorMsg);
    }
    
    this.addLog('info', 'Validation passed');

    this.state = 'running';
    this.currentWorkflow = workflow;
    this.currentStepIndex = -1;
    this.currentStep = null;
    this.error = null;
    this.logs = [];
    this.pauseRequested = false;
    this.stopRequested = false;
    this.loopStack = [];

    this.emit('execution.started', { workflowId, workflowName: workflow.name });
    this.addLog('info', `Workflow "${workflow.name}" started with ${workflow.steps.length} step(s)`);

    try {
      const config = this.store.getConfig();
      
      // Ordenar steps por ordem
      const sortedSteps = [...workflow.steps].sort((a, b) => a.order - b.order);

      for (let i = 0; i < sortedSteps.length; i++) {
        if (this.stopRequested) {
          this.addLog('info', 'Workflow stopped by user');
          break;
        }

        // Aguardar se pausado
        while (this.pauseRequested && !this.stopRequested) {
          await this.automationService.wait(100);
        }

        if (this.stopRequested) {
          break;
        }

        this.currentStepIndex = i;
        this.currentStep = sortedSteps[i];
        
        // Log detalhado do passo atual
        const stepAction = this.currentStep.action;
        let stepDescription = `Step ${i + 1}/${sortedSteps.length}: ${stepAction.type}`;
        if (stepAction.type === 'click' && (stepAction as any).params?.mappingPoint) {
          stepDescription += ` (${(stepAction as any).params.mappingPoint})`;
        } else if (stepAction.type === 'findImage' && (stepAction as any).params?.templateName) {
          stepDescription += ` (${(stepAction as any).params.templateName})`;
        } else if (stepAction.type === 'type' && (stepAction as any).params?.text) {
          const text = (stepAction as any).params.text;
          stepDescription += ` ("${text.length > 20 ? text.substring(0, 20) + '...' : text}")`;
        }
        this.addLog('info', stepDescription);
        
        this.emit('execution.progress', {
          stepIndex: i,
          totalSteps: sortedSteps.length,
          step: this.currentStep,
        });

        const progress = Math.round(((i + 1) / sortedSteps.length) * 100);
        this.emit('status', this.getStatus());

        try {
          await this.executeStep(this.currentStep, config);
          this.addLog('success', `Step ${i + 1}/${sortedSteps.length} completed: ${this.currentStep.action.type}`);
        } catch (stepError: any) {
          const errorMsg = stepError?.message || 'Unknown error';
          this.addLog('error', `Step ${i + 1} failed: ${errorMsg}`);
          
          // Verificar se o step tem opção de continuar mesmo com erro
          const continueOnError = (this.currentStep.action as any).continueOnError ?? false;
          
          // Se maxRetries > 0, tentar novamente
          if (config.maxRetries > 0) {
            let retried = false;
            for (let retry = 0; retry < config.maxRetries; retry++) {
              // Delay entre tentativas (aumenta progressivamente)
              if (retry > 0) {
                const retryDelay = Math.min(500 * retry, 2000);
                this.addLog('info', `Waiting ${retryDelay}ms before retry...`);
                await this.automationService.wait(retryDelay);
              }
              
              this.addLog('info', `Retrying step ${i + 1} (attempt ${retry + 1}/${config.maxRetries})`);
              try {
                await this.executeStep(this.currentStep, config);
                this.addLog('success', `Step ${i + 1} succeeded on retry ${retry + 1}`);
                retried = true;
                break;
              } catch (retryError: any) {
                const retryErrorMsg = retryError?.message || 'Unknown error';
                this.addLog('warning', `Retry ${retry + 1} failed: ${retryErrorMsg}`);
                // Continue to next retry
              }
            }
            if (!retried) {
              if (continueOnError) {
                this.addLog('warning', `Step ${i + 1} failed after ${config.maxRetries} retries, but continuing workflow (continueOnError=true)`);
                // Continuar workflow mesmo com erro
              } else {
                throw stepError;
              }
            }
          } else {
            if (continueOnError) {
              this.addLog('warning', `Step ${i + 1} failed, but continuing workflow (continueOnError=true)`);
              // Continuar workflow mesmo com erro
            } else {
              throw stepError;
            }
          }
        }

        // Delay padrão entre ações
        if (i < sortedSteps.length - 1 && config.defaultDelayMs > 0) {
          await this.automationService.wait(config.defaultDelayMs);
        }
      }

      if (!this.stopRequested) {
        this.addLog('success', `Workflow "${workflow.name}" completed successfully`);
        this.emit('execution.completed', { workflowId, workflowName: workflow.name, success: true });
        this.state = 'idle';
      } else {
        this.addLog('info', `Workflow "${workflow.name}" stopped by user`);
        this.state = 'stopped';
      }
    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown error';
      logger.error({ err: error, workflowId }, 'Error in workflow execution');
      this.error = errorMsg;
      this.state = 'error';
      this.addLog('error', `Workflow failed: ${errorMsg}`);
      this.emit('execution.error', { workflowId, error: errorMsg });
      this.emit('execution.completed', { workflowId, workflowName: workflow?.name, success: false, error: errorMsg });
      // Não lançar o erro novamente para evitar unhandled promise rejection
      // O erro já foi logado e emitido via evento
    } finally {
      if (this.state === 'running') {
        this.state = this.stopRequested ? 'stopped' : 'idle';
      }
      this.currentWorkflow = null;
      this.currentStepIndex = -1;
      this.currentStep = null;
      this.emit('status', this.getStatus());
    }
  }

  private async executeStep(step: WorkflowStep, config: any): Promise<void> {
    const action = step.action;

    switch (action.type) {
      case 'click':
        await this.executeClick(action as ClickAction);
        break;
      case 'clickAt':
        await this.executeClickAt(action as ClickAtAction);
        break;
      case 'type':
        await this.executeType(action as TypeAction);
        break;
      case 'pressKey':
        await this.executePressKey(action as PressKeyAction);
        break;
      case 'wait':
        await this.executeWait(action as WaitAction, config);
        break;
      case 'screenshot':
        await this.executeScreenshot(action as ScreenshotAction);
        break;
      case 'findImage':
        await this.executeFindImage(action as FindImageAction, config);
        break;
      case 'moveMouse':
        await this.executeMoveMouse(action as MoveMouseAction);
        break;
      case 'drag':
        await this.executeDrag(action as DragAction);
        break;
      case 'loop':
        await this.executeLoop(action as LoopAction, config);
        break;
      case 'condition':
        await this.executeCondition(action as ConditionAction, config);
        break;
      default:
        throw new Error(`Unknown action type: ${(action as any).type}`);
    }
  }

  private async executeClick(action: ClickAction): Promise<void> {
    const { mappingPoint, x, y, button = 'left' } = action.params;

    if (mappingPoint) {
      const point = this.mappingService.getMappingPointByName(mappingPoint);
      if (!point) {
        throw new Error(`Mapping point "${mappingPoint}" not found`);
      }
      await this.automationService.click(button, point.x, point.y);
    } else if (x !== undefined && y !== undefined) {
      await this.automationService.click(button, x, y);
    } else {
      throw new Error('Either mappingPoint or x,y coordinates must be provided');
    }
  }

  private async executeClickAt(action: ClickAtAction): Promise<void> {
    const { x, y, button = 'left' } = action.params;
    await this.automationService.click(button, x, y);
  }

  private async executeType(action: TypeAction): Promise<void> {
    const { text } = action.params;
    await this.automationService.type(text);
  }

  private async executePressKey(action: PressKeyAction): Promise<void> {
    const { key, modifiers = [] } = action.params;
    await this.automationService.pressKey(key, modifiers);
  }

  private async executeWait(action: WaitAction, config: any): Promise<void> {
    const { ms, orUntilImage, timeout } = action.params;

    if (orUntilImage) {
      // Aguardar até encontrar imagem ou timeout
      const waitTimeout = timeout ?? config.imageFindTimeout;
      const startTime = Date.now();
      
      while (Date.now() - startTime < waitTimeout) {
        try {
          const found = await this.mappingService.findTemplateOnScreen(
            orUntilImage,
            config.imageFindConfidence,
            1000 // Check every second
          );
          if (found) {
            return;
          }
        } catch (error) {
          // Continue waiting
        }
        await this.automationService.wait(100);
      }
      throw new Error(`Image "${orUntilImage}" not found within timeout`);
    } else {
      await this.automationService.wait(ms);
    }
  }

  private async executeScreenshot(action: ScreenshotAction): Promise<void> {
    const { region } = action.params;
    await this.automationService.screenshot(region);
  }

  private async executeFindImage(action: FindImageAction, config: any): Promise<void> {
    const { templateName, timeout, confidence, optional } = action.params;
    try {
      this.addLog('info', `Searching for image template "${templateName}"...`);
      const found = await this.mappingService.findTemplateOnScreen(
        templateName,
        confidence ?? config.imageFindConfidence,
        timeout ?? config.imageFindTimeout
      );
      if (!found) {
        if (optional) {
          this.addLog('warning', `Image template "${templateName}" not found (optional, continuing)`);
          return; // Não lançar erro se for opcional
        }
        throw new Error(`Image template "${templateName}" not found on screen`);
      }
      this.addLog('success', `Image template "${templateName}" found at (${found.x}, ${found.y}) - ${found.width}x${found.height}px`);
    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown error';
      if (optional) {
        this.addLog('warning', `Failed to find image template "${templateName}" (optional): ${errorMsg}`);
        return; // Não lançar erro se for opcional
      }
      this.addLog('error', `Failed to find image template "${templateName}": ${errorMsg}`);
      throw error;
    }
  }

  private async executeMoveMouse(action: MoveMouseAction): Promise<void> {
    const { x, y } = action.params;
    await this.automationService.moveMouse(x, y);
  }

  private async executeDrag(action: DragAction): Promise<void> {
    const { fromX, fromY, toX, toY, button = 'left' } = action.params;
    await this.automationService.drag(fromX, fromY, toX, toY, button);
  }

  private async executeLoop(action: LoopAction, config: any): Promise<void> {
    const { count, actions } = action.params;
    const loopCount = count ?? Infinity;
    const currentIndex = this.currentStepIndex;

    for (let i = 0; i < loopCount; i++) {
      if (this.stopRequested) break;

      this.loopStack.push({
        count: loopCount,
        current: i + 1,
        stepIndex: currentIndex,
      });

      this.addLog('info', `Loop iteration ${i + 1}/${loopCount === Infinity ? '∞' : loopCount}`);

      for (const loopAction of actions) {
        if (this.stopRequested) break;
        const step: WorkflowStep = {
          id: `loop_${i}_${loopAction.id}`,
          action: loopAction,
          order: 0,
        };
        await this.executeStep(step, config);
      }

      this.loopStack.pop();
    }
  }

  private async executeCondition(action: ConditionAction, config: any): Promise<void> {
    const { condition, templateName, ifTrue, ifFalse } = action.params;

    let imageFound = false;
    try {
      const found = await this.mappingService.findTemplateOnScreen(
        templateName,
        config.imageFindConfidence,
        2000 // Quick check
      );
      imageFound = found !== null;
    } catch (error) {
      imageFound = false;
    }

    const shouldExecuteTrue = 
      (condition === 'imageFound' && imageFound) ||
      (condition === 'imageNotFound' && !imageFound);

    const actionsToExecute = shouldExecuteTrue ? ifTrue : (ifFalse || []);

    for (const condAction of actionsToExecute) {
      if (this.stopRequested) break;
      const step: WorkflowStep = {
        id: `cond_${condAction.id}`,
        action: condAction,
        order: 0,
      };
      await this.executeStep(step, config);
    }
  }

  pause(): void {
    if (this.state === 'running') {
      this.pauseRequested = true;
      this.state = 'paused';
      this.addLog('info', 'Workflow paused');
      this.emit('execution.paused');
      this.emit('status', this.getStatus());
    }
  }

  resume(): void {
    if (this.state === 'paused') {
      this.pauseRequested = false;
      this.state = 'running';
      this.addLog('info', 'Workflow resumed');
      this.emit('execution.resumed');
      this.emit('status', this.getStatus());
    }
  }

  stop(): void {
    if (this.state === 'running' || this.state === 'paused') {
      this.stopRequested = true;
      this.pauseRequested = false;
      this.state = 'stopped';
      this.addLog('info', 'Workflow stopped');
      this.emit('execution.stopped');
      this.emit('status', this.getStatus());
    }
  }

  getStatus(): ExecutionStatus {
    const totalSteps = this.currentWorkflow?.steps.length || 0;
    const progress = totalSteps > 0 && this.currentStepIndex >= 0
      ? Math.round(((this.currentStepIndex + 1) / totalSteps) * 100)
      : 0;

    return {
      status: this.state,
      currentWorkflowId: this.currentWorkflow?.id,
      currentStepIndex: this.currentStepIndex >= 0 ? this.currentStepIndex : undefined,
      currentStep: this.currentStep || undefined,
      error: this.error || undefined,
      progress,
      logs: [...this.logs],
    };
  }

  private addLog(level: ExecutionLog['level'], message: string): void {
    const log: ExecutionLog = {
      timestamp: Date.now(),
      level,
      message,
      stepId: this.currentStep?.id,
    };
    this.logs.push(log);
    // Manter apenas últimos 100 logs
    if (this.logs.length > 100) {
      this.logs.shift();
    }
  }
}

let automationExecutor: AutomationExecutor | null = null;

export function getAutomationExecutor(): AutomationExecutor {
  if (!automationExecutor) {
    automationExecutor = new AutomationExecutor();
  }
  return automationExecutor;
}

