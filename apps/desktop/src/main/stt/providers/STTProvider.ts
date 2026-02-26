import { STTConfig, STTFinalEvent, STTPartialEvent, STTStatus } from '@neo/shared';

export interface STTProvider {
  start(config: STTConfig, modelPath: string): Promise<void>;
  stop(): Promise<void>;
  feedAudio(chunk: Buffer): void;
  getStatus(): STTStatus;
  onPartial(cb: (e: STTPartialEvent) => void): () => void;
  onFinal(cb: (e: STTFinalEvent) => void): () => void;
  onError(cb: (msg: string) => void): () => void;
  onDebug?(cb: (msg: string) => void): () => void;
}
