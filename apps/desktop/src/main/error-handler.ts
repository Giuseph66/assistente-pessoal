import { app, dialog } from 'electron';
import { getLogger } from '@neo/logger';

const logger = getLogger();

// Flag para indicar se o app está sendo encerrado
let isShuttingDown = false;

/**
 * Marca o app como em processo de shutdown
 * Isso permite filtrar erros esperados durante o encerramento
 */
export function setShuttingDown(value: boolean): void {
  isShuttingDown = value;
}

/**
 * Verifica se um erro está relacionado ao encerramento de workers
 */
function isWorkerShutdownError(error: Error): boolean {
  const message = error.message.toLowerCase();
  const stack = error.stack?.toLowerCase() || '';
  
  const shutdownKeywords = [
    'worker',
    'ending',
    'terminate',
    'shutdown',
    'worker_threads',
    'child_process',
  ];
  
  return shutdownKeywords.some(keyword => 
    message.includes(keyword) || stack.includes(keyword)
  );
}

/**
 * Configura error handlers globais para o aplicativo
 */
export function setupErrorHandlers(): void {
  // Handler para erros não capturados
  process.on('uncaughtException', (error: Error) => {
    // Durante o shutdown, ignorar erros relacionados a workers
    if (isShuttingDown && isWorkerShutdownError(error)) {
      logger.debug({ err: error }, 'Ignoring worker shutdown error during app exit');
      return;
    }
    
    logger.fatal({ err: error }, 'Uncaught exception');
    dialog.showErrorBox(
      'Erro Fatal',
      `O aplicativo encontrou um erro inesperado:\n\n${error.message}\n\nO aplicativo será fechado.`
    );
    app.quit();
  });

  // Handler para promises rejeitadas
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    // Durante o shutdown, ignorar rejeições relacionadas a workers
    if (isShuttingDown) {
      const errorMessage = reason?.message?.toLowerCase() || String(reason).toLowerCase();
      if (isWorkerShutdownError({ message: errorMessage, stack: String(reason) } as Error)) {
        logger.debug({ reason }, 'Ignoring worker shutdown rejection during app exit');
        return;
      }
    }
    
    // Extrair informação útil do motivo
    let reasonInfo: any;
    if (reason instanceof Error) {
      reasonInfo = {
        name: reason.name,
        message: reason.message,
        stack: reason.stack,
      };
    } else if (reason !== null && typeof reason === 'object') {
      // Tentar serializar o objeto
      try {
        reasonInfo = {
          type: typeof reason,
          constructor: reason?.constructor?.name,
          keys: Object.keys(reason),
          stringified: JSON.stringify(reason, null, 2)?.substring(0, 500),
        };
      } catch {
        reasonInfo = { type: typeof reason, value: String(reason) };
      }
    } else {
      reasonInfo = { type: typeof reason, value: String(reason) };
    }
    
    logger.error(
      { reason: reasonInfo, promiseInfo: promise?.toString?.()?.substring(0, 200) },
      'Unhandled promise rejection'
    );
  });

  // Handler para warnings
  process.on('warning', (warning: Error) => {
    logger.warn({ warning }, 'Process warning');
  });

  // Handler para erros no renderer process
  app.on('render-process-gone', (event, webContents, details) => {
    logger.error({ details }, 'Renderer process crashed');
    dialog.showErrorBox(
      'Renderer Process Crashed',
      `O processo de renderização travou:\n\n${details.reason}\n\nO aplicativo pode não funcionar corretamente.`
    );
  });

  // Handler para webContents crashed
  app.on('web-contents-created', (event, webContents) => {
    webContents.on('render-process-gone', (event, details) => {
      logger.error({ details }, 'WebContents render process gone');
    });
  });
}

/**
 * Wrapper para funções assíncronas com tratamento de erro
 */
export function asyncHandler<T extends (...args: any[]) => Promise<any>>(
  fn: T
): T {
  return ((...args: any[]) => {
    return fn(...args).catch((error) => {
      logger.error({ err: error, args }, 'Async handler error');
      throw error;
    });
  }) as T;
}

/**
 * Wrapper para funções síncronas com tratamento de erro
 */
export function syncHandler<T extends (...args: any[]) => any>(fn: T): T {
  return ((...args: any[]) => {
    try {
      return fn(...args);
    } catch (error) {
      logger.error({ err: error, args }, 'Sync handler error');
      throw error;
    }
  }) as T;
}
