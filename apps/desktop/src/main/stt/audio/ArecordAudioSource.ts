import { spawn, spawnSync, ChildProcessWithoutNullStreams } from 'child_process';
import { EventEmitter } from 'events';
import type { AudioSource } from './AudioSource';
import { getLogger } from '@ricky/logger';

const logger = getLogger();

export class ArecordAudioSource implements AudioSource {
  private process: ChildProcessWithoutNullStreams | null = null;
  private emitter = new EventEmitter();
  private bufferCache = Buffer.alloc(0);
  private chunkBytes = 3200;
  private deviceName: string = 'default';

  async start(opts: { sampleRate: number }): Promise<void> {
    if (this.process) {
      return;
    }

    const device = this.resolveDevice();
    this.deviceName = device || 'default';
    const args = [
      ...(device ? ['-D', device] : []),
      '-f',
      'S16_LE',
      '-c',
      '1',
      '-r',
      String(opts.sampleRate),
      '-t',
      'raw',
      '-q',
    ];
    logger.info({ device: this.deviceName, sampleRate: opts.sampleRate }, 'Starting arecord');

    this.process = spawn('arecord', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    this.chunkBytes = Math.max(320, Math.floor(opts.sampleRate * 0.1) * 2);

    this.process.stdout.on('data', (chunk: Buffer) => {
      this.bufferCache = Buffer.concat([this.bufferCache, chunk]);
      while (this.bufferCache.length >= this.chunkBytes) {
        const slice = this.bufferCache.subarray(0, this.chunkBytes);
        this.bufferCache = this.bufferCache.subarray(this.chunkBytes);
        this.emitter.emit('data', slice);
      }
    });

    this.process.stderr.on('data', (data) => {
      this.emitter.emit('error', new Error(data.toString()));
    });

    this.process.on('error', (error) => {
      this.emitter.emit('error', error);
    });

    this.process.on('exit', () => {
      this.process = null;
    });

    await new Promise<void>((resolve, reject) => {
      this.process?.once('spawn', () => resolve());
      this.process?.once('error', (error) => reject(error));
    });
  }

  async stop(): Promise<void> {
    if (!this.process) {
      return;
    }
    this.process.kill('SIGTERM');
    this.process = null;
    this.bufferCache = Buffer.alloc(0);
  }

  onData(cb: (chunk: Buffer) => void): () => void {
    this.emitter.on('data', cb);
    return () => this.emitter.off('data', cb);
  }

  onError(cb: (err: Error) => void): () => void {
    this.emitter.on('error', cb);
    return () => this.emitter.off('error', cb);
  }

  getDeviceName(): string {
    return this.deviceName;
  }

  private resolveDevice(): string | null {
    const envDevice = process.env.RICKY_STT_DEVICE;
    if (envDevice) {
      return envDevice;
    }

    const preferred = this.resolvePreferredDevice();
    if (preferred) {
      return preferred;
    }

    const hardware = this.resolveHardwareDevice();
    if (hardware) {
      return hardware;
    }

    return null;
  }

  private resolvePreferredDevice(): string | null {
    try {
      const result = spawnSync('arecord', ['-L'], { encoding: 'utf8' });
      if (result.error) {
        return null;
      }
      const output = result.stdout || '';
      const hasDevice = (name: string) => new RegExp(`^${name}$`, 'm').test(output);
      if (hasDevice('pipewire')) {
        return 'pipewire';
      }
      if (hasDevice('pulse')) {
        return 'pulse';
      }
    } catch {
      return null;
    }
    return null;
  }

  private resolveHardwareDevice(): string | null {
    try {
      const result = spawnSync('arecord', ['-l'], { encoding: 'utf8' });
      if (result.error) {
        return null;
      }
      const output = result.stdout || '';
      const match = output.match(/card\s+(\d+):.*?device\s+(\d+):/i);
      if (!match) {
        return null;
      }
      const card = match[1];
      const device = match[2];
      return `plughw:${card},${device}`;
    } catch {
      return null;
    }
  }
}
