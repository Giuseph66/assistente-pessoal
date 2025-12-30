import pino from 'pino';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync } from 'fs';

/**
 * Níveis de log disponíveis (compatível com Pino)
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Configuração do logger
 */
export interface LoggerConfig {
  level?: LogLevel | string;
  pretty?: boolean;
  logDir?: string;
  appName?: string;
}

/**
 * Cria e configura o logger Pino
 */
export function createLogger(config: LoggerConfig = {}): pino.Logger {
  const {
    level = (process.env.LOG_LEVEL || 'info') as LogLevel,
    pretty = process.env.NODE_ENV === 'development',
    logDir = join(homedir(), '.local', 'share', 'ricky', 'logs'),
    appName = 'ricky',
  } = config;

  // Garantir que o diretório de logs existe
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }

  const logFile = join(logDir, `${appName}-${new Date().toISOString().split('T')[0]}.log`);

  const logLevel: pino.Level = level as pino.Level;
  
  const streams: pino.StreamEntry[] = [
    {
      level: logLevel,
      stream: pino.destination({
        dest: logFile,
        sync: false,
        mkdir: true,
      }),
    },
  ];

  // Em desenvolvimento, adicionar output colorido no console
  if (pretty) {
    streams.push({
      level: logLevel,
      stream: pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      }),
    });
  }

  const logger = pino(
    {
      level: logLevel,
      base: {
        pid: process.pid,
        app: appName,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    pino.multistream(streams)
  );

  return logger;
}

/**
 * Logger singleton para uso global
 */
let globalLogger: pino.Logger | null = null;

/**
 * Obtém ou cria o logger global
 */
export function getLogger(config?: LoggerConfig): pino.Logger {
  if (!globalLogger) {
    globalLogger = createLogger(config);
  }
  return globalLogger;
}

/**
 * Define o logger global (útil para testes)
 */
export function setLogger(logger: pino.Logger): void {
  globalLogger = logger;
}

/**
 * Helper para criar child logger com contexto
 */
export function createChildLogger(parent: pino.Logger, bindings: Record<string, any>): pino.Logger {
  return parent.child(bindings);
}

