import { app, BrowserWindow, ipcMain } from 'electron';
import { CommandPaletteService } from './command-palette-service';

const COMMAND_PALETTE_LIST_CHANNEL = 'command-palette:list-actions';
const COMMAND_PALETTE_EXECUTE_CHANNEL = 'command-palette:execute';
const COMMAND_PALETTE_UPDATED_EVENT = 'command-palette:updated';

function broadcast(channel: string, payload: unknown): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (win.isDestroyed()) return;
    const contents = win.webContents;
    if (contents.isDestroyed() || contents.isCrashed()) return;
    try {
      contents.send(channel, payload);
    } catch {
      // Ignore delivery errors from invalid frames.
    }
  });
}

function sanitizeQuery(payload: unknown): string | undefined {
  if (typeof payload === 'string') {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const maybeQuery = (payload as { query?: unknown }).query;
    if (typeof maybeQuery === 'string') {
      return maybeQuery;
    }
  }

  return undefined;
}

function sanitizeExecutePayload(payload: unknown): {
  actionId: string;
  context?: Record<string, unknown>;
} {
  if (typeof payload === 'string') {
    return { actionId: payload };
  }

  if (!payload || typeof payload !== 'object') {
    return { actionId: '' };
  }

  const unsafe = payload as {
    actionId?: unknown;
    context?: unknown;
  };

  return {
    actionId: typeof unsafe.actionId === 'string' ? unsafe.actionId : '',
    context: unsafe.context && typeof unsafe.context === 'object'
      ? (unsafe.context as Record<string, unknown>)
      : undefined,
  };
}

export function registerCommandPaletteIpc(service: CommandPaletteService): void {
  ipcMain.removeHandler(COMMAND_PALETTE_LIST_CHANNEL);
  ipcMain.removeHandler(COMMAND_PALETTE_EXECUTE_CHANNEL);

  ipcMain.handle(COMMAND_PALETTE_LIST_CHANNEL, async (_event, payload) => {
    return service.listActions(sanitizeQuery(payload));
  });

  ipcMain.handle(COMMAND_PALETTE_EXECUTE_CHANNEL, async (_event, payload) => {
    const { actionId, context } = sanitizeExecutePayload(payload);
    if (!actionId) {
      return {
        actionId: '',
        success: false,
        error: 'missing_action_id',
      };
    }

    return service.execute(actionId, context);
  });

  const unsubscribe = service.onUpdated((actions) => {
    broadcast(COMMAND_PALETTE_UPDATED_EVENT, actions);
  });

  app.once('before-quit', () => {
    unsubscribe();
  });
}
