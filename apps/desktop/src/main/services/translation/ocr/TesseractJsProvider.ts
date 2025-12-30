import { OCRBlock } from '@ricky/shared';
import { OCRProvider, OCRRequest } from './OCRProvider';

export class TesseractJsProvider implements OCRProvider {
  async isAvailable(): Promise<boolean> {
    try {
      await import(/* @vite-ignore */ 'tesseract.js');
      return true;
    } catch {
      return false;
    }
  }

  getName(): string {
    return 'tesseract.js';
  }

  async recognize(request: OCRRequest): Promise<OCRBlock[]> {
    const { createWorker } = await import(/* @vite-ignore */ 'tesseract.js');
    const lang = this.normalizeLang(request.lang);
    const worker = await createWorker(lang);
    try {
      const { data } = await worker.recognize(request.imagePath);
      const minConfidence = request.minConfidence ?? 35;
      const minTextLength = request.minTextLength ?? 2;

      return (data?.lines || [])
        .map((line: any) => ({
          text: line.text || '',
          confidence: line.confidence,
          bbox: {
            x: line.bbox?.x0 || 0,
            y: line.bbox?.y0 || 0,
            w: (line.bbox?.x1 || 0) - (line.bbox?.x0 || 0),
            h: (line.bbox?.y1 || 0) - (line.bbox?.y0 || 0),
          },
        }))
        .filter((block: OCRBlock) => {
          const text = block.text.trim();
          if (text.length < minTextLength) return false;
          if (block.confidence !== undefined && block.confidence < minConfidence) return false;
          return true;
        });
    } finally {
      await worker.terminate();
    }
  }

  private normalizeLang(lang: string): string {
    const normalized = lang.toLowerCase();
    if (normalized === 'auto') return 'eng+por';
    if (normalized.startsWith('pt')) return 'por';
    if (normalized.startsWith('en')) return 'eng';
    if (normalized.startsWith('es')) return 'spa';
    return normalized;
  }
}
