import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import { app } from 'electron';
import { is } from '@electron-toolkit/utils';
import { STTConfig, STTFinalEvent, STTPartialEvent, STTStatus } from '@ricky/shared';
import type { STTProvider } from './STTProvider';
import { getLogger } from '@ricky/logger';
import { fork, ChildProcess } from 'child_process';

const logger = getLogger();

export class VoskProvider implements STTProvider {
  private worker: Worker | ChildProcess | null = null;
  private emitter = new EventEmitter();
  private status: STTStatus = { state: 'idle' };

  async start(config: STTConfig, modelPath: string): Promise<void> {
    if (this.worker) {
      return;
    }

    this.status = { state: 'starting' };

    // Resolver caminho do worker
    // O worker é compilado separadamente para dist/main/stt/workers/sttWorker.js
    // __dirname aponta para dist/main após o bundle do electron-vite
    let workerPath: string;
    
    // Primeiro tentar caminho relativo a __dirname (funciona em dev e produção se o bundle mantiver a estrutura)
    workerPath = join(__dirname, 'stt/workers/sttWorker.js');
    
    // Se não existir, tentar usando appPath (para desenvolvimento)
    if (!existsSync(workerPath) && is.dev) {
      const appPath = app.getAppPath();
      // appPath em dev aponta para apps/desktop, então precisamos adicionar dist/main
      const devPath = join(appPath, 'dist/main/stt/workers/sttWorker.js');
      if (existsSync(devPath)) {
        workerPath = devPath;
      }
    }
    
    // Se ainda não existir em produção, usar appPath
    if (!existsSync(workerPath) && !is.dev) {
      const appPath = app.getAppPath();
      workerPath = join(appPath, 'dist/main/stt/workers/sttWorker.js');
    }
    
    if (!existsSync(workerPath)) {
      const error = new Error(`Worker file not found: ${workerPath}`);
      logger.error({ 
        workerPath, 
        __dirname, 
        appPath: app.getAppPath(), 
        isDev: is.dev,
        triedPaths: [
          join(__dirname, 'stt/workers/sttWorker.js'),
          is.dev ? join(app.getAppPath(), 'dist/main/stt/workers/sttWorker.js') : 'N/A'
        ]
      }, 'Worker file not found');
      throw error;
    }
    
    const startWithWorker = async (): Promise<void> => {
      logger.debug({ workerPath, __dirname, isDev: is.dev }, 'Loading Vosk worker (worker_threads)');
      this.worker = new Worker(workerPath);
      await this.attachHandlersAndStart(config, modelPath);
    };

    const startWithNodeChild = async (): Promise<void> => {
      const { execPath, runAsNode } = this.resolveNodeExec();
      logger.warn({ execPath, runAsNode }, 'Using Node child process for Vosk');
      const child = fork(workerPath, [], {
        execPath,
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        cwd: app.getAppPath(),
        env: this.buildNodeEnv(runAsNode),
        serialization: 'advanced',
      });
      child.stderr?.on('data', (data) => {
        logger.error({ data: data.toString() }, 'Vosk child stderr');
      });
      this.worker = child;
      await this.attachHandlersAndStart(config, modelPath);
    };

    const shouldPreferNode =
      Boolean(process.versions.electron) && process.env.RICKY_STT_FORCE_WORKER !== '1';

    if (shouldPreferNode) {
      await startWithNodeChild();
      return;
    }

    try {
      await startWithWorker();
    } catch (error: any) {
      const message = error?.message || '';
      const lower = message.toLowerCase();
      const shouldFallback =
        lower.includes('native') ||
        lower.includes('dlopen') ||
        lower.includes('self-register') ||
        lower.includes('ffi');
      if (!shouldFallback) {
        throw error;
      }
      await this.shutdownWorker();
      await startWithNodeChild();
    }
  }

  private async attachHandlersAndStart(config: STTConfig, modelPath: string): Promise<void> {
    const worker = this.worker;
    if (!worker) {
      throw new Error('Worker not initialized');
    }

    const ready = new Promise<void>((resolve, reject) => {
      const handleReady = (message: any) => {
        if (message.type === 'ready') {
          this.status = { state: 'listening', modelId: config.modelId, language: message.language };
          worker.off('message', handleReady);
          resolve();
        }
        if (message.type === 'error') {
          worker.off('message', handleReady);
          reject(new Error(message.payload?.message || 'Erro no Vosk'));
        }
      };
      worker.on('message', handleReady);
      worker.once('exit', () => reject(new Error('Worker encerrado antes de iniciar')));
      worker.once('error', (error) => reject(error));
    });

    worker.on('message', (message) => {
      if (message.type === 'ready') {
        this.status = { state: 'listening', modelId: config.modelId, language: message.language };
        return;
      }
      if (message.type === 'partial') {
        this.emitter.emit('partial', message.payload as STTPartialEvent);
      }
      if (message.type === 'final') {
        this.emitter.emit('final', message.payload as STTFinalEvent);
      }
      if (message.type === 'error') {
        this.emitter.emit('error', message.payload?.message || 'Erro no Vosk');
      }
      if (message.type === 'debug') {
        this.emitter.emit('debug', message.payload?.message || 'debug');
      }
    });

    worker.on('error', (error) => {
      logger.error({ err: error }, 'Vosk worker error');
      this.emitter.emit('error', error.message);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        this.emitter.emit('error', `Worker encerrou com codigo ${code}`);
      }
      this.worker = null;
      this.status = { state: 'idle' };
    });

    this.sendMessage({
      type: 'init',
      payload: {
        config,
        modelPath,
      },
    });

    await ready;
  }

  async stop(): Promise<void> {
    if (!this.worker) {
      return;
    }
    this.status = { state: 'stopping' };
    
    try {
      // Tentar parar graciosamente primeiro
      await Promise.race([
        new Promise<void>((resolve) => {
          this.worker?.once('exit', () => resolve());
          this.sendMessage({ type: 'stop' });
        }),
        new Promise<void>((resolve) => {
          // Timeout de 2 segundos para parada graciosa
          setTimeout(() => {
            logger.debug('Worker stop timeout, forcing shutdown');
            resolve();
          }, 2000);
        })
      ]);
    } catch (error) {
      logger.debug({ err: error }, 'Error during graceful stop');
    } finally {
      // Garantir que o worker seja encerrado mesmo se a parada graciosa falhar
      await this.shutdownWorker();
    }
  }

  feedAudio(chunk: Buffer): void {
    if (!this.worker) {
      return;
    }
    this.sendMessage({ type: 'audio', payload: { chunk } });
  }

  getStatus(): STTStatus {
    return this.status;
  }

  onPartial(cb: (e: STTPartialEvent) => void): () => void {
    this.emitter.on('partial', cb);
    return () => this.emitter.off('partial', cb);
  }

  onFinal(cb: (e: STTFinalEvent) => void): () => void {
    this.emitter.on('final', cb);
    return () => this.emitter.off('final', cb);
  }

  onError(cb: (msg: string) => void): () => void {
    this.emitter.on('error', cb);
    return () => this.emitter.off('error', cb);
  }

  onDebug(cb: (msg: string) => void): () => void {
    this.emitter.on('debug', cb);
    return () => this.emitter.off('debug', cb);
  }

  private sendMessage(message: any): void {
    const worker = this.worker;
    if (!worker) return;
    if ('postMessage' in worker) {
      worker.postMessage(message);
      return;
    }
    worker.send?.(message);
  }

  private async shutdownWorker(): Promise<void> {
    if (!this.worker) return;
    
    // Remover listeners para evitar erros durante o shutdown
    try {
      this.worker.removeAllListeners('message');
      this.worker.removeAllListeners('error');
      this.worker.removeAllListeners('exit');
    } catch (error) {
      // Ignorar erros ao remover listeners
      logger.debug({ err: error }, 'Error removing worker listeners during shutdown');
    }
    
    try {
      if ('terminate' in this.worker) {
        // Worker threads: usar terminate com timeout
        const terminatePromise = this.worker.terminate();
        await Promise.race([
          terminatePromise,
          new Promise<void>((resolve) => {
            setTimeout(() => {
              logger.debug('Worker terminate timeout, forcing shutdown');
              resolve();
            }, 2000);
          })
        ]);
      } else {
        // Child process: usar kill com SIGTERM
        this.worker.kill('SIGTERM');
        // Aguardar um pouco para o processo terminar graciosamente
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            // Se não terminou, forçar com SIGKILL
            if (this.worker && !this.worker.killed) {
              this.worker.kill('SIGKILL');
            }
            resolve();
          }, 1000);
          
          if (this.worker) {
            this.worker.once('exit', () => {
              clearTimeout(timeout);
              resolve();
            });
          } else {
            clearTimeout(timeout);
            resolve();
          }
        });
      }
    } catch (error) {
      // Durante o shutdown, erros de workers são esperados e devem ser silenciosamente ignorados
      logger.debug({ err: error }, 'Worker shutdown error (expected during app exit)');
    } finally {
      this.worker = null;
    }
  }

  private resolveNodeExec(): { execPath: string; runAsNode: boolean } {
    const override = process.env.RICKY_STT_NODE_PATH;
    if (override) {
      return { execPath: override, runAsNode: false };
    }
    if (process.versions.electron && existsSync(process.execPath)) {
      return { execPath: process.execPath, runAsNode: true };
    }
    const candidates = ['/usr/bin/node', '/bin/node', 'node'];
    for (const candidate of candidates) {
      if (candidate === 'node') {
        return { execPath: candidate, runAsNode: false };
      }
      if (existsSync(candidate)) {
        return { execPath: candidate, runAsNode: false };
      }
    }
    return { execPath: 'node', runAsNode: false };
  }

  private buildNodeEnv(runAsNode: boolean): NodeJS.ProcessEnv {
    const env = { ...process.env };
    delete env.ELECTRON_NO_ASAR;
    if (runAsNode) {
      env.ELECTRON_RUN_AS_NODE = '1';
    } else {
      delete env.ELECTRON_RUN_AS_NODE;
    }
    const appPath = app.getAppPath();
    const nodeModules = resolve(appPath, 'node_modules');
    env.NODE_PATH = env.NODE_PATH ? `${nodeModules}:${env.NODE_PATH}` : nodeModules;
    return env;
  }
}
