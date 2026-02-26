import { ipcMain, IpcMainEvent } from 'electron';
import { EventEmitter } from 'events';
import type { AudioSource } from './AudioSource';
import { getLogger } from '@neo/logger';

const logger = getLogger();

export class RendererAudioSource implements AudioSource {
  private emitter = new EventEmitter();
  private active = false;
  private handler: ((event: IpcMainEvent, payload: { chunk?: ArrayBuffer | Uint8Array }) => void) | null =
    null;

  async start(_opts: { sampleRate: number }): Promise<void> {
    if (this.active) {
      return;
    }
    this.active = true;
    this.handler = (_event, payload) => {
      if (!payload?.chunk) return;
      try {
        const chunk = Buffer.from(payload.chunk as any);
        this.emitter.emit('data', chunk);
      } catch (error) {
        this.emitter.emit('error', error as Error);
      }
    };
    ipcMain.on('stt.audio', this.handler);
    logger.info('RendererAudioSource listening for stt.audio');
  }

  async stop(): Promise<void> {
    if (!this.active) {
      return;
    }
    if (this.handler) {
      ipcMain.removeListener('stt.audio', this.handler);
    }
    this.handler = null;
    this.active = false;
  }

  onData(cb: (chunk: Buffer) => void): () => void {
    this.emitter.on('data', cb);
    return () => this.emitter.off('data', cb);
  }

  onError(cb: (err: Error) => void): () => void {
    this.emitter.on('error', cb);
    return () => this.emitter.off('error', cb);
  }
}
