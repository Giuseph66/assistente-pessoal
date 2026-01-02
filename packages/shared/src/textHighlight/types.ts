export type TextHighlightBox = {
  x: number; // DIP
  y: number; // DIP
  w: number; // DIP
  h: number; // DIP
  conf?: number;
  text?: string;
};

export type TextHighlightConfig = {
  ttlMs?: number;
  minConfidence?: number;
  color?: string;
  opacity?: number;
};
