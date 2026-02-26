/**
 * Temporary loopback HTTP server for capturing OAuth callback.
 * Listens on 127.0.0.1:PORT, captures code+state, returns an HTML success page,
 * then auto-closes.
 */
import { createServer, Server, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { getLogger } from '@neo/logger';

const logger = getLogger();

export interface CallbackResult {
    code: string;
    state: string;
}

export interface OAuthServerOptions {
    port: number;
    timeoutMs: number;
    expectedState: string;
}

const SUCCESS_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login Concluído</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      color: #e0e0e0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: rgba(255,255,255,0.06);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 48px 40px;
      text-align: center;
      max-width: 420px;
    }
    .icon { font-size: 64px; margin-bottom: 16px; }
    h1 { font-size: 24px; margin-bottom: 12px; color: #f0f0f0; }
    p { font-size: 15px; color: #aaa; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Login concluído!</h1>
    <p>Pode fechar esta janela e voltar para o NEO.</p>
  </div>
</body>
</html>`;

const ERROR_HTML = (msg: string) => `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Erro de Login</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: linear-gradient(135deg, #2e1a1a 0%, #3e1616 50%, #601010 100%);
      color: #e0e0e0;
      display: flex; align-items: center; justify-content: center; min-height: 100vh;
    }
    .card {
      background: rgba(255,255,255,0.06);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 48px 40px;
      text-align: center;
      max-width: 420px;
    }
    .icon { font-size: 64px; margin-bottom: 16px; }
    h1 { font-size: 22px; margin-bottom: 12px; color: #ffbcbc; }
    p { font-size: 14px; color: #ccc; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">❌</div>
    <h1>Erro no Login</h1>
    <p>${msg}</p>
  </div>
</body>
</html>`;

/**
 * Start the loopback server and wait for the OAuth callback.
 * Resolves with {code, state} or rejects on timeout / error.
 */
export function startOAuthCallbackServer(
    options: OAuthServerOptions
): { promise: Promise<CallbackResult>; cancel: () => void } {
    let server: Server | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    const promise = new Promise<CallbackResult>((resolve, reject) => {
        server = createServer((req: IncomingMessage, res: ServerResponse) => {
            if (!req.url || settled) {
                res.writeHead(404);
                res.end();
                return;
            }

            const parsed = new URL(req.url, `http://127.0.0.1:${options.port}`);

            if (parsed.pathname !== '/auth/callback') {
                res.writeHead(404);
                res.end('Not Found');
                return;
            }

            const code = parsed.searchParams.get('code');
            const state = parsed.searchParams.get('state');
            const error = parsed.searchParams.get('error');
            const errorDesc = parsed.searchParams.get('error_description');

            if (error) {
                logger.warn({ error, errorDesc }, 'OAuth callback returned error');
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(ERROR_HTML(errorDesc || error));
                settled = true;
                cleanupServer();
                reject(new Error(`OAuth error: ${error} — ${errorDesc || ''}`));
                return;
            }

            if (!code || !state) {
                res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(ERROR_HTML('Parâmetros incompletos (code ou state ausente).'));
                return;
            }

            if (state !== options.expectedState) {
                logger.warn('OAuth state mismatch — possible CSRF');
                res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(ERROR_HTML('State inválido. Tente novamente.'));
                return;
            }

            // Success!
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(SUCCESS_HTML);
            settled = true;
            logger.info('OAuth callback received successfully');

            // Give browser time to load the page before closing the server
            setTimeout(() => cleanupServer(), 3000);
            resolve({ code, state });
        });

        server.on('error', (err: NodeJS.ErrnoException) => {
            if (!settled) {
                settled = true;
                logger.error({ err }, 'OAuth loopback server error');
                reject(new Error(`Cannot start OAuth server on port ${options.port}: ${err.message}`));
            }
        });

        server.listen(options.port, '127.0.0.1', () => {
            logger.info({ port: options.port }, 'OAuth loopback server listening');
        });

        // Timeout
        timeout = setTimeout(() => {
            if (!settled) {
                settled = true;
                cleanupServer();
                reject(new Error('OAuth callback timeout — nenhuma resposta recebida'));
            }
        }, options.timeoutMs);
    });

    function cleanupServer() {
        if (timeout) {
            clearTimeout(timeout);
            timeout = null;
        }
        if (server) {
            server.close(() => {
                logger.debug('OAuth loopback server closed');
            });
            server = null;
        }
    }

    function cancel() {
        if (!settled) {
            settled = true;
            cleanupServer();
        }
    }

    return { promise, cancel };
}

/**
 * Extract an authorization code from a pasted redirect URL.
 * Supports both full URL and bare code string.
 */
export function extractCodeFromUrl(input: string): string | null {
    const trimmed = input.trim();

    // If it looks like a URL, parse it
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        try {
            const url = new URL(trimmed);
            return url.searchParams.get('code');
        } catch {
            return null;
        }
    }

    // Otherwise treat as bare code (if it looks reasonable)
    if (trimmed.length > 10 && !trimmed.includes(' ')) {
        return trimmed;
    }

    return null;
}
