export type STTLanguage = 'pt-BR' | 'en-US' | string;

export type ModelDescriptor = {
  id: string;
  language: STTLanguage;
  label: string;
  sizeMB?: number;
  accuracyHint?: string;
  source: 'bundled' | 'remote' | 'localPath';
  url?: string;
  sha256?: string;
  defaultSampleRate?: number;
};

export type InstalledModel = ModelDescriptor & {
  installed: true;
  installPath: string;
  installedAt: number;
};

export type STTConfig = {
  provider: 'vosk';
  modelId: string;
  sampleRate: number;
  enablePartial: boolean;
  partialDebounceMs: number;
  maxSegmentSeconds: number;
};

export type STTPartialEvent = {
  text: string;
  confidence?: number;
  ts: number;
};

export type STTFinalEvent = {
  text: string;
  confidence?: number;
  ts: number;
};

export type STTStatus =
  | { state: 'idle' }
  | { state: 'starting' }
  | { state: 'running'; modelId: string; language: STTLanguage }
  | { state: 'stopping' }
  | { state: 'error'; message: string };
