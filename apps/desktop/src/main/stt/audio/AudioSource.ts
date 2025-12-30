export interface AudioSource {
  start(opts: { sampleRate: number }): Promise<void>;
  stop(): Promise<void>;
  onData(cb: (chunk: Buffer) => void): () => void;
  onError(cb: (err: Error) => void): () => void;
}
