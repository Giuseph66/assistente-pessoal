import { open } from 'fs/promises';
import { dirname } from 'path';
import { mkdir } from 'fs/promises';

export class WavWriter {
  private filePath: string;
  private fileHandle: Awaited<ReturnType<typeof open>> | null = null;
  private dataBytes = 0;
  private sampleRate: number;
  private channels: number;

  constructor(filePath: string, sampleRate: number, channels: number) {
    this.filePath = filePath;
    this.sampleRate = sampleRate;
    this.channels = channels;
  }

  async init(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    this.fileHandle = await open(this.filePath, 'w');
    const header = this.buildHeader(0);
    await this.fileHandle.write(header, 0, header.length, 0);
  }

  async write(chunk: Buffer): Promise<void> {
    if (!this.fileHandle) {
      throw new Error('WavWriter not initialized');
    }
    await this.fileHandle.write(chunk);
    this.dataBytes += chunk.length;
  }

  async finalize(): Promise<void> {
    if (!this.fileHandle) return;
    const header = this.buildHeader(this.dataBytes);
    await this.fileHandle.write(header, 0, header.length, 0);
    await this.fileHandle.close();
    this.fileHandle = null;
  }

  getBytesWritten(): number {
    return this.dataBytes;
  }

  private buildHeader(dataSize: number): Buffer {
    const buffer = Buffer.alloc(44);
    const byteRate = this.sampleRate * this.channels * 2;
    const blockAlign = this.channels * 2;

    buffer.write('RIFF', 0, 'ascii');
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8, 'ascii');
    buffer.write('fmt ', 12, 'ascii');
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(this.channels, 22);
    buffer.writeUInt32LE(this.sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36, 'ascii');
    buffer.writeUInt32LE(dataSize, 40);

    return buffer;
  }
}
