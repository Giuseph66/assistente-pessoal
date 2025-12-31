import type {
  LiveTranscriptionProviderId,
  STTConfig,
  STTFinalEvent,
  STTPartialEvent,
  STTStatus,
} from '@ricky/shared';

export type LiveTranscriptionProviderConfig = STTConfig & {
  apiKey?: string;
  modelName?: string;
  modelPath?: string;
};

export type LiveTranscriptionError = {
  message: string;
  debug?: string;
  code?: string;
  providerId?: LiveTranscriptionProviderId;
};

export interface LiveTranscriptionProvider {
  id: LiveTranscriptionProviderId;
  start(config: LiveTranscriptionProviderConfig): Promise<void>;
  pushAudio(chunk: Buffer): void;
  stop(): Promise<void>;
  dispose(): Promise<void>;
  onPartial(cb: (event: STTPartialEvent) => void): () => void;
  onFinal(cb: (event: STTFinalEvent) => void): () => void;
  onStatus(cb: (status: STTStatus) => void): () => void;
  onError(cb: (error: LiveTranscriptionError) => void): () => void;
  onDebug?(cb: (message: string) => void): () => void;
}
