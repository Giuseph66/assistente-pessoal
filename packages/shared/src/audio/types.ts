export type AudioSourceType = 'microphone' | 'system';

export type SystemAudioSourceInfo = {
  id: string;
  name: string;
  isMonitor: boolean;
  isDefaultCandidate?: boolean;
};

export type RecordingSourceType = 'system' | 'microphone';

export type RecordingEntry = {
  id: number;
  path: string;
  sourceType: RecordingSourceType;
  sourceId?: string | null;
  createdAt: number;
  sampleRate: number;
  channels: number;
  bytes: number;
  durationMs?: number | null;
};

export type RecorderStatus = {
  state: 'idle' | 'recording' | 'stopping' | 'error';
  bytesWritten: number;
  path?: string;
  sourceId?: string;
  message?: string;
};

export type RecorderStartOptions = {
  sourceId: string;
  outPath?: string;
  wav?: boolean;
  name?: string;
};
