import { SubtitleSegment } from '@ricky/shared';

const pad = (value: number, size: number): string => String(value).padStart(size, '0');

const formatTimestamp = (ms: number, separator: ',' | '.'): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const millis = Math.floor(ms % 1000);
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}${separator}${pad(millis, 3)}`;
};

export const segmentsToVtt = (segments: SubtitleSegment[]): string => {
  const lines = ['WEBVTT', ''];
  segments.forEach((segment, index) => {
    const start = formatTimestamp(segment.startMs, '.');
    const end = formatTimestamp(segment.endMs, '.');
    lines.push(String(index + 1));
    lines.push(`${start} --> ${end}`);
    lines.push(segment.text);
    lines.push('');
  });
  return lines.join('\n');
};

export const segmentsToSrt = (segments: SubtitleSegment[]): string => {
  const lines: string[] = [];
  segments.forEach((segment, index) => {
    const start = formatTimestamp(segment.startMs, ',');
    const end = formatTimestamp(segment.endMs, ',');
    lines.push(String(index + 1));
    lines.push(`${start} --> ${end}`);
    lines.push(segment.text);
    lines.push('');
  });
  return lines.join('\n');
};
