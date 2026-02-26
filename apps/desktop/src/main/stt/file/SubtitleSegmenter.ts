import { SubtitleSegment } from '@neo/shared';

type WordInfo = {
  word: string;
  start: number;
  end: number;
};

type SegmenterOptions = {
  maxChars?: number;
  maxDurationSec?: number;
  maxGapSec?: number;
  minDurationSec?: number;
  maxLineChars?: number;
};

const wrapText = (text: string, maxLineChars: number): string => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if (current.length + 1 + word.length > maxLineChars && lines.length < 1) {
      lines.push(current);
      current = word;
      continue;
    }
    current = `${current} ${word}`;
  }
  if (current) {
    lines.push(current);
  }
  return lines.join('\n');
};

export const segmentWords = (
  words: WordInfo[],
  options: SegmenterOptions = {}
): SubtitleSegment[] => {
  const maxChars = options.maxChars ?? 72;
  const maxDurationSec = options.maxDurationSec ?? 6;
  const maxGapSec = options.maxGapSec ?? 0.8;
  const minDurationSec = options.minDurationSec ?? 1;
  const maxLineChars = options.maxLineChars ?? 40;

  const segments: SubtitleSegment[] = [];
  let currentWords: WordInfo[] = [];
  let currentText = '';
  let segmentStart = 0;

  const flush = () => {
    if (!currentWords.length) return;
    const start = segmentStart;
    const end = currentWords[currentWords.length - 1].end;
    const rawText = currentText.trim();
    if (!rawText) {
      currentWords = [];
      currentText = '';
      return;
    }
    const duration = end - start;
    const paddedEnd = duration < minDurationSec ? start + minDurationSec : end;
    segments.push({
      startMs: Math.round(start * 1000),
      endMs: Math.round(paddedEnd * 1000),
      text: wrapText(rawText, maxLineChars),
    });
    currentWords = [];
    currentText = '';
  };

  for (const word of words) {
    if (!currentWords.length) {
      currentWords = [word];
      currentText = word.word;
      segmentStart = word.start;
      continue;
    }

    const last = currentWords[currentWords.length - 1];
    const gap = word.start - last.end;
    const nextText = `${currentText} ${word.word}`;
    const duration = word.end - segmentStart;

    const shouldBreak =
      gap > maxGapSec || duration > maxDurationSec || nextText.length > maxChars;

    if (shouldBreak) {
      flush();
      currentWords = [word];
      currentText = word.word;
      segmentStart = word.start;
      continue;
    }

    currentWords.push(word);
    currentText = nextText;
  }

  flush();

  return segments;
};

export type { WordInfo, SegmenterOptions };
