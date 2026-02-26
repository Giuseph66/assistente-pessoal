import { spawn } from 'child_process';
import { OCRBlock } from '@neo/shared';
import { OCRProvider, OCRRequest } from './OCRProvider';

const DEFAULT_LANG = 'eng+por';

type TsvRow = {
  level: number;
  page: number;
  block: number;
  par: number;
  line: number;
  word: number;
  left: number;
  top: number;
  width: number;
  height: number;
  conf: number;
  text: string;
};

export class TesseractCliProvider implements OCRProvider {
  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn('tesseract', ['--version']);
      child.on('error', () => resolve(false));
      child.on('close', (code) => resolve(code === 0));
    });
  }

  getName(): string {
    return 'tesseract-cli';
  }

  async recognize(request: OCRRequest): Promise<OCRBlock[]> {
    const lang = this.normalizeLang(request.lang);
    const tsv = await this.runTesseract(request.imagePath, lang);
    const rows = this.parseTsv(tsv);
    const blocks = this.groupByLine(rows);

    const minConfidence = request.minConfidence ?? 35;
    const minTextLength = request.minTextLength ?? 2;

    return blocks.filter((block) => {
      const text = block.text.trim();
      if (text.length < minTextLength) return false;
      if (block.confidence !== undefined && block.confidence < minConfidence) return false;
      return true;
    });
  }

  private normalizeLang(lang: string): string {
    const normalized = lang.toLowerCase();
    if (normalized === 'auto') return DEFAULT_LANG;
    if (normalized.startsWith('pt')) return 'por';
    if (normalized.startsWith('en')) return 'eng';
    if (normalized.startsWith('es')) return 'spa';
    return normalized;
  }

  private runTesseract(imagePath: string, lang: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [imagePath, 'stdout', '-l', lang, '--psm', '6', 'tsv'];
      const child = spawn('tesseract', args);
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      child.on('error', (error) => reject(error));
      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`tesseract failed: ${stderr || stdout || 'unknown error'}`));
        }
      });
    });
  }

  private parseTsv(tsv: string): TsvRow[] {
    const lines = tsv.split('\n').filter(Boolean);
    if (lines.length <= 1) return [];
    const rows: TsvRow[] = [];
    for (let i = 1; i < lines.length; i += 1) {
      const parts = lines[i].split('\t');
      if (parts.length < 12) continue;
      rows.push({
        level: Number(parts[0]),
        page: Number(parts[1]),
        block: Number(parts[2]),
        par: Number(parts[3]),
        line: Number(parts[4]),
        word: Number(parts[5]),
        left: Number(parts[6]),
        top: Number(parts[7]),
        width: Number(parts[8]),
        height: Number(parts[9]),
        conf: Number(parts[10]),
        text: parts[11] || '',
      });
    }
    return rows;
  }

  private groupByLine(rows: TsvRow[]): OCRBlock[] {
    const lineMap = new Map<string, { words: TsvRow[] }>();
    for (const row of rows) {
      if (row.level !== 5 || !row.text?.trim()) continue;
      const key = `${row.page}-${row.block}-${row.par}-${row.line}`;
      const entry = lineMap.get(key) || { words: [] };
      entry.words.push(row);
      lineMap.set(key, entry);
    }

    const blocks: OCRBlock[] = [];
    for (const [, entry] of lineMap) {
      const words = entry.words.sort((a, b) => a.left - b.left);
      const text = words.map((word) => word.text).join(' ').trim();
      if (!text) continue;
      const left = Math.min(...words.map((w) => w.left));
      const top = Math.min(...words.map((w) => w.top));
      const right = Math.max(...words.map((w) => w.left + w.width));
      const bottom = Math.max(...words.map((w) => w.top + w.height));
      const confidence =
        words.reduce((sum, w) => sum + (Number.isFinite(w.conf) ? w.conf : 0), 0) / words.length;

      blocks.push({
        text,
        confidence: Number.isFinite(confidence) ? confidence : undefined,
        bbox: {
          x: left,
          y: top,
          w: right - left,
          h: bottom - top,
        },
      });
    }

    return blocks;
  }
}
