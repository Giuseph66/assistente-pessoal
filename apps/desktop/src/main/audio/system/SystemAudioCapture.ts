import { EventEmitter } from 'events';
import { spawn, spawnSync, ChildProcessWithoutNullStreams } from 'child_process';
import { getLogger } from '@ricky/logger';

const logger = getLogger();

type CaptureBackend = 'parec' | 'pw-cat' | 'pw-record';

type CaptureOptions = {
  sourceId: string;
  sampleRate: number;
};

const commandExists = (cmd: string): boolean => {
  const result = spawnSync('which', [cmd], { encoding: 'utf8' });
  return result.status === 0;
};

export class SystemAudioCapture {
  private process: ChildProcessWithoutNullStreams | null = null;
  private emitter = new EventEmitter();
  private backend: CaptureBackend | null = null;
  private sourceId: string | null = null;
  private stopping = false;

  async start(options: CaptureOptions): Promise<void> {
    if (this.process) return;

    this.stopping = false;
    const backend = this.pickBackend();
    if (!backend) {
      throw new Error('parec/pw-cat/pw-record nao encontrados. Instale pipewire-pulse ou pipewire-utils.');
    }

    this.backend = backend;
    this.sourceId = options.sourceId;

    const args = this.buildArgs(backend, options);
    logger.info({ backend, args }, 'Starting system audio capture');

    this.process = spawn(backend, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.process.stdout.on('data', (chunk) => {
      this.emitter.emit('data', chunk);
    });

    this.process.stderr.on('data', (chunk) => {
      const message = chunk.toString().trim();
      if (this.stopping && message.includes('read error')) return;
      if (message) {
        this.emitter.emit('error', new Error(message));
      }
    });

    this.process.on('error', (error) => {
      this.emitter.emit('error', error);
    });

    this.process.on('close', (code) => {
      if (this.stopping) {
        this.process = null;
        this.backend = null;
        return;
      }
      if (code && code !== 0) {
        this.emitter.emit('error', new Error(`Captura encerrou com codigo ${code}`));
      }
      this.process = null;
      this.backend = null;
    });
  }

  async stop(): Promise<void> {
    if (!this.process) return;
    const proc = this.process;
    this.stopping = true;
    this.process = null;
    this.backend = null;

    proc.stdout.removeAllListeners();
    proc.stderr.removeAllListeners();

    proc.kill('SIGINT');
    setTimeout(() => {
      if (!proc.killed) {
        proc.kill('SIGKILL');
      }
    }, 800);
  }

  onData(cb: (chunk: Buffer) => void): () => void {
    this.emitter.on('data', cb);
    return () => this.emitter.off('data', cb);
  }

  onError(cb: (error: Error) => void): () => void {
    this.emitter.on('error', cb);
    return () => this.emitter.off('error', cb);
  }

  getBackend(): CaptureBackend | null {
    return this.backend;
  }

  getSourceId(): string | null {
    return this.sourceId;
  }

  private pickBackend(): CaptureBackend | null {
    if (commandExists('parec')) return 'parec';
    if (commandExists('pw-cat')) return 'pw-cat';
    if (commandExists('pw-record')) return 'pw-record';
    return null;
  }

  private buildArgs(backend: CaptureBackend, options: CaptureOptions): string[] {
    const sampleRate = String(options.sampleRate);
    if (backend === 'parec') {
      return [
        `--device=${options.sourceId}`,
        '--format=s16le',
        `--rate=${sampleRate}`,
        '--channels=1',
      ];
    }
    if (backend === 'pw-cat') {
      return [
        '--record',
        '--target',
        options.sourceId,
        '--format',
        's16le',
        '--rate',
        sampleRate,
        '--channels',
        '1',
      ];
    }

    return [
      '--target',
      options.sourceId,
      '--format',
      's16le',
      '--rate',
      sampleRate,
      '--channels',
      '1',
      '-',
    ];
  }
}
