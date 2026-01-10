export class PcmChunker {
  private buffer: Buffer = Buffer.alloc(0);
  private frameBytes: number;

  constructor(sampleRate: number, frameMs: number = 20) {
    const bytes = Math.floor((sampleRate * frameMs) / 1000) * 2;
    this.frameBytes = Math.max(320, bytes);
  }

  push(chunk: Buffer, emit: (frame: Buffer) => void): void {
    if (!chunk.length) return;
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
    while (this.buffer.length >= this.frameBytes) {
      const frame = this.buffer.subarray(0, this.frameBytes);
      this.buffer = this.buffer.subarray(this.frameBytes);
      emit(frame);
    }
  }

  flush(emit: (frame: Buffer) => void): void {
    if (!this.buffer.length) return;
    emit(this.buffer);
    this.buffer = Buffer.alloc(0);
  }
}
