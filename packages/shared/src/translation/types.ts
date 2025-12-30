export type TranslationStage =
  | 'idle'
  | 'capturing'
  | 'ocr'
  | 'translating'
  | 'rendering'
  | 'error';

export type TranslationStatus = {
  stage: TranslationStage;
  message?: string;
  timing?: { startedAt: number; elapsedMs?: number };
  blocks?: number;
};

export type OCRBlock = {
  text: string;
  confidence?: number;
  bbox: { x: number; y: number; w: number; h: number };
  line?: number;
  block?: number;
};

export type TranslationBlock = {
  original: string;
  translated: string;
  bbox: { x: number; y: number; w: number; h: number };
  confidence?: number;
};

export type TranslationResult = {
  screenshotPath: string;
  width: number;
  height: number;
  blocks: TranslationBlock[];
};

export type TranslationStartOptions = {
  fromLang: string;
  toLang: string;
  liveMode: boolean;
  liveIntervalMs?: number;
  debugBoxes: boolean;
  showTooltips: boolean;
  minConfidence?: number;
  minTextLength?: number;
};
