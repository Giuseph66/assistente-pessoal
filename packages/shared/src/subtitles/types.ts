export type SubtitleSegment = {
  startMs: number;
  endMs: number;
  text: string;
};

export type SubtitleExportFormat = 'vtt' | 'srt' | 'both';

export type TranscribeFileRequest = {
  wavPath: string;
  language?: string;
  exportFormat?: SubtitleExportFormat;
};

export type TranscribeProgress = {
  percent: number;
  currentTimeMs: number;
  textPartial?: string;
};

export type TranscribeDone = {
  vttPath?: string;
  srtPath?: string;
  segmentsCount: number;
};
