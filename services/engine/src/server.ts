import { WebSocketServer, WebSocket } from 'ws';
import { getLogger } from '@ricky/logger';
import { IpcChannels } from '@ricky/shared';
import { STTManager } from './stt/manager.js';

const logger = getLogger({ appName: 'ricky-engine' });

export interface WebSocketMessage {
  id?: string;
  type: string;
  payload: any;
  timestamp?: number;
}

export interface WebSocketResponse extends WebSocketMessage {
  type: string;
  payload: any;
}

/**
 * Cria e configura o servidor WebSocket
 */
export async function createServer(port: number = 8787): Promise<WebSocketServer> {
  const wss = new WebSocketServer({ port, host: '127.0.0.1' });
  const sttManager = new STTManager();

  wss.on('listening', () => {
    logger.info({ port }, 'WebSocket server listening');
  });

  wss.on('connection', (ws: WebSocket) => {
    logger.info('Client connected');

    ws.on('message', async (message: Buffer) => {
      try {
        const data: WebSocketMessage = JSON.parse(message.toString());
        await handleMessage(ws, data, sttManager);
      } catch (error) {
        logger.error({ err: error }, 'Failed to parse message');
        sendError(ws, 'parse_error', 'Failed to parse message');
      }
    });

    ws.on('close', () => {
      logger.info('Client disconnected');
      sttManager.stop();
    });

    ws.on('error', (error) => {
      logger.error({ err: error }, 'WebSocket error');
    });

    // Envia mensagem de boas-vindas
    sendMessage(ws, {
      type: 'system.connected',
      payload: { message: 'Connected to Ricky Engine' },
    });
  });

  wss.on('error', (error) => {
    logger.error({ err: error }, 'WebSocket server error');
  });

  return wss;
}

/**
 * Processa mensagens recebidas
 */
async function handleMessage(
  ws: WebSocket,
  message: WebSocketMessage,
  sttManager: STTManager
): Promise<void> {
  const { id, type, payload } = message;

  logger.debug({ type, id }, 'Received message');

  try {
    switch (type) {
      case IpcChannels.STT_START:
        const language = payload?.language || 'en';
        await sttManager.start(language, (event) => {
          sendMessage(ws, event);
        });
        sendResponse(ws, id, {
          type: 'stt.start.response',
          payload: { success: true, state: 'transcribing' },
        });
        break;

      case IpcChannels.STT_STOP:
        await sttManager.stop();
        sendResponse(ws, id, {
          type: 'stt.stop.response',
          payload: { success: true, state: 'idle' },
        });
        break;

      case 'system.health':
        sendResponse(ws, id, {
          type: 'system.health.response',
          payload: {
            status: 'ok',
            stt: {
              active: sttManager.isActive(),
              provider: sttManager.getProvider(),
            },
          },
        });
        break;

      default:
        logger.warn({ type }, 'Unknown message type');
        sendError(ws, id, `Unknown message type: ${type}`);
    }
  } catch (error: any) {
    logger.error({ err: error, type }, 'Error handling message');
    sendError(ws, id, error.message || 'Unknown error');
  }
}

/**
 * Envia uma resposta para o cliente
 */
function sendResponse(ws: WebSocket, id: string | undefined, response: WebSocketResponse): void {
  sendMessage(ws, {
    ...response,
    id,
    timestamp: Date.now(),
  });
}

/**
 * Envia uma mensagem para o cliente
 */
function sendMessage(ws: WebSocket, message: Partial<WebSocketMessage>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        ...message,
        timestamp: message.timestamp || Date.now(),
      })
    );
  }
}

/**
 * Envia uma mensagem de erro
 */
function sendError(ws: WebSocket, id: string | undefined, message: string): void {
  sendResponse(ws, id, {
    type: 'error',
    payload: { message },
  });
}
