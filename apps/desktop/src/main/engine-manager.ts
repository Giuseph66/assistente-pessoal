import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';
import { getLogger } from '@neo/logger';

const logger = getLogger();

/**
 * Gerenciador do processo engine STT
 */
export class EngineManager {
  private process: ChildProcess | null = null;
  private enginePath: string;

  constructor() {
    // Path para o binário do engine (compilado)
    this.enginePath = this.resolveEnginePath();
  }

  private resolveEnginePath(): string {
    const candidates = [
      join(process.cwd(), 'services', 'engine', 'dist', 'index.js'),
      join(process.cwd(), '..', '..', 'services', 'engine', 'dist', 'index.js'),
      join(__dirname, '../../services/engine/dist/index.js'),
      join(__dirname, '../../../services/engine/dist/index.js'),
      join(__dirname, '../../../../services/engine/dist/index.js'),
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }

    return candidates[0];
  }

  /**
   * Inicia o processo engine
   */
  async start(): Promise<void> {
    if (this.process) {
      logger.warn('Engine already running');
      return;
    }

    try {
      if (!existsSync(this.enginePath)) {
        logger.warn({ path: this.enginePath }, 'Engine binary not found (build @neo/engine)');
        return;
      }
      logger.info({ path: this.enginePath }, 'Starting engine process');
      this.process = spawn('node', [this.enginePath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_ENV: process.env.NODE_ENV || 'production',
        },
      });

      this.process.stdout?.on('data', (data) => {
        logger.debug({ data: data.toString() }, 'Engine stdout');
      });

      this.process.stderr?.on('data', (data) => {
        logger.error({ data: data.toString() }, 'Engine stderr');
      });

      this.process.on('exit', (code, signal) => {
        logger.warn({ code, signal }, 'Engine process exited');
        this.process = null;
      });

      this.process.on('error', (error) => {
        logger.error({ err: error }, 'Engine process error');
        this.process = null;
      });

      logger.info('Engine process started');
    } catch (error) {
      logger.error({ err: error }, 'Failed to start engine');
      throw error;
    }
  }

  /**
   * Para o processo engine
   */
  stop(): void {
    if (this.process) {
      logger.info('Stopping engine process');
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }

  /**
   * Verifica se o engine está rodando
   */
  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  /**
   * Reinicia o engine
   */
  async restart(): Promise<void> {
    this.stop();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await this.start();
  }
}

// Singleton
let engineManager: EngineManager | null = null;

/**
 * Obtém instância singleton do EngineManager
 */
export function getEngineManager(): EngineManager {
  if (!engineManager) {
    engineManager = new EngineManager();
  }
  return engineManager;
}
