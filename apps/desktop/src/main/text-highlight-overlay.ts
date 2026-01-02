import { BrowserWindow, screen, desktopCapturer } from 'electron';
import { join } from 'path';
import { writeFile } from 'fs/promises';
import { spawn } from 'child_process';
import { getLogger } from '@ricky/logger';
import { TesseractJsProvider } from './services/translation/ocr/TesseractJsProvider';
import { TesseractCliProvider } from './services/translation/ocr/TesseractCliProvider';
import type { OCRProvider } from './services/translation/ocr/OCRProvider';
import type { TextHighlightBox } from '@ricky/shared';
import * as os from 'os';
import { is } from '@electron-toolkit/utils';

type WordItem = {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  conf?: number;
  lineKey?: string;
};

// Overlay manager for OCR-based text highlights across all displays.
export class TextHighlightOverlayManager {
  private overlays: Map<number, BrowserWindow> = new Map(); // display.id -> Window
  private logger = getLogger();
  private readonly ttlMsDefault = 0;
  private readonly minConfidenceDefault = 45;
  private readonly minTextLengthDefault = 2;
  private readonly throttleMs = 800;
  private readonly loadingMinDurationMs = 450;
  private lastRunAt = 0;
  private isRunning = false;
  private listenersBound = false;
  private ocrProvider: OCRProvider | null = null;
  private ocrProviderKind: 'cli' | 'js' | null = null;
  private readonly phraseGapMultiplier = 1.2;
  private loadingState = false;
  private loadingStartedAt: number | null = null;
  private loadingHideTimer: NodeJS.Timeout | null = null;

  // Initialize overlays for all displays (primary + others as needed)
  async initialize(): Promise<void> {
    const displays = screen.getAllDisplays();
    this.logger.info(`TextHighlightOverlayManager: initializing overlays for ${displays.length} display(s)`);
    await this.ensureOverlays();
    this.bindDisplayListeners();
  }

  private async ensureOverlayForDisplay(display: Electron.Display): Promise<void> {
    if (this.overlays.has(display.id)) return;
    this.logger.debug(`TextHighlightOverlayManager: creating overlay for display ${display.id} bounds ${JSON.stringify(display.bounds)}`);
    const win = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      focusable: false,
      hasShadow: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
      show: true
    });

    // Load the overlay UI from the renderer entry with the text highlight hash.
    try {
      if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#text-highlight-overlay`);
        this.logger.info('Overlay loaded via renderer URL (dev)');
      } else {
        const overlayHtmlPath = join(__dirname, '../renderer/index.html');
        win.loadFile(overlayHtmlPath, { hash: 'text-highlight-overlay' });
        this.logger.info(`Overlay HTML loaded from ${overlayHtmlPath}`);
      }
    } catch (err) {
      this.logger.error({ err, display: display.id }, 'Failed to load overlay HTML for text highlight (trying fallback)');
      // Fallback: load a minimal inline page to ensure overlay exists
      win.loadURL('data:text/html,<html><body style="margin:0;background:transparent;"></body></html>');
    }
    // Catch any subsequent load failures (e.g., dist file missing in build)
    win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      this.logger.error({ errorCode, errorDescription, validatedURL }, 'TextHighlightOverlay: did-fail-load while loading overlay HTML');
    });
    win.webContents.on('did-finish-load', () => {
      if (!win.isDestroyed()) {
        win.webContents.send('text-highlight:loading', { loading: this.loadingState });
      }
    });

    // Do not steal input
    win.setIgnoreMouseEvents(true, { forward: true });
    win.setAlwaysOnTop(true, 'screen-saver');
    win.on('closed', () => {
      this.overlays.delete(display.id);
    });

    this.overlays.set(display.id, win);
  }

  private getOverlayWindow(display?: Electron.Display): BrowserWindow | null {
    const d = display ?? screen.getPrimaryDisplay();
    return this.overlays.get(d.id) ?? null;
  }

  private async ensureOverlays(): Promise<void> {
    const displays = screen.getAllDisplays();
    for (const display of displays) {
      await this.ensureOverlayForDisplay(display);
      const win = this.overlays.get(display.id);
      if (win && !win.isDestroyed()) {
        win.setBounds(display.bounds, true);
      }
    }
  }

  private bindDisplayListeners(): void {
    if (this.listenersBound) return;
    this.listenersBound = true;
    screen.on('display-added', async (_event, display) => {
      await this.ensureOverlayForDisplay(display);
    });
    screen.on('display-removed', (_event, display) => {
      const win = this.overlays.get(display.id);
      if (win && !win.isDestroyed()) {
        win.close();
      }
      this.overlays.delete(display.id);
    });
    screen.on('display-metrics-changed', (_event, display) => {
      const win = this.overlays.get(display.id);
      if (win && !win.isDestroyed()) {
        win.setBounds(display.bounds, true);
      }
    });
  }

  private cleanWordItems(items: WordItem[]): WordItem[] {
    return items.filter((item) => {
      if (!item.text || !item.text.trim()) return false;
      if (!Number.isFinite(item.x) || !Number.isFinite(item.y)) return false;
      if (!Number.isFinite(item.w) || !Number.isFinite(item.h)) return false;
      return item.w > 0 && item.h > 0;
    });
  }

  private getBroadcastWindows(): BrowserWindow[] {
    const windows = new Set<BrowserWindow>();
    for (const win of this.overlays.values()) {
      if (win && !win.isDestroyed()) {
        windows.add(win);
      }
    }
    for (const win of BrowserWindow.getAllWindows()) {
      if (win && !win.isDestroyed()) {
        windows.add(win);
      }
    }
    return Array.from(windows);
  }

  private broadcastLoading(loading: boolean): void {
    for (const win of this.getBroadcastWindows()) {
      win.webContents.send('text-highlight:loading', { loading });
    }
  }

  private setLoadingAllOverlays(loading: boolean): void {
    if (loading) {
      if (this.loadingHideTimer) {
        clearTimeout(this.loadingHideTimer);
        this.loadingHideTimer = null;
      }
      this.loadingStartedAt = Date.now();
      this.loadingState = true;
      this.broadcastLoading(true);
      return;
    } else {
      if (!this.loadingState) return;
      const elapsed = Date.now() - (this.loadingStartedAt ?? Date.now());
      if (elapsed < this.loadingMinDurationMs) {
        const remaining = this.loadingMinDurationMs - elapsed;
        if (this.loadingHideTimer) {
          clearTimeout(this.loadingHideTimer);
        }
        this.loadingHideTimer = setTimeout(() => {
          this.loadingHideTimer = null;
          this.loadingState = false;
          this.broadcastLoading(false);
        }, remaining);
        return;
      }
      this.loadingState = false;
    }
    this.broadcastLoading(false);
  }

  private setOverlaysVisible(visible: boolean): void {
    for (const win of this.overlays.values()) {
      if (!win || win.isDestroyed()) continue;
      if (visible) {
        if (!win.isVisible()) {
          if (typeof win.showInactive === 'function') {
            win.showInactive();
          } else {
            win.show();
          }
        }
      } else if (win.isVisible()) {
        win.hide();
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private buildTextFromBoxes(boxes: TextHighlightBox[]): string {
    if (!boxes.length) return '';
    const sorted = [...boxes].sort((a, b) => (a.y + a.h / 2) - (b.y + b.h / 2));
    const lines: Array<{ centerY: number; height: number; boxes: TextHighlightBox[] }> = [];

    for (const box of sorted) {
      const centerY = box.y + box.h / 2;
      let assigned = false;
      for (const line of lines) {
        const threshold = Math.max(8, line.height * 0.6);
        if (Math.abs(centerY - line.centerY) <= threshold) {
          line.boxes.push(box);
          line.centerY = (line.centerY * (line.boxes.length - 1) + centerY) / line.boxes.length;
          line.height = (line.height * (line.boxes.length - 1) + box.h) / line.boxes.length;
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        lines.push({ centerY, height: box.h, boxes: [box] });
      }
    }

    return lines
      .map((line) =>
        line.boxes
          .sort((a, b) => a.x - b.x)
          .map((box) => box.text || '')
          .filter(Boolean)
          .join(' ')
          .trim()
      )
      .filter(Boolean)
      .join('\n');
  }

  // Capture a single display and run OCR
  private async captureDisplayForOCR(display: Electron.Display): Promise<Buffer | null> {
    const scale = display.scaleFactor || 1;
    const thumbSize = {
      width: Math.floor(display.size.width * scale),
      height: Math.floor(display.size.height * scale),
    };

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: thumbSize,
    });

    const srcById = sources.find((s) => String(s.display_id) === String(display.id));
    const screenSources = sources.filter((s) => s.id.startsWith('screen:'));
    const displayIndex = screen.getAllDisplays().findIndex((d) => d.id === display.id);
    const src = srcById || screenSources[displayIndex] || screenSources[0];
    if (!src && sources.length > 0) {
      this.logger.warn({ displayId: display.id }, 'TextHighlightOverlay: falling back to first capturer source');
    }
    if (!src || !src.thumbnail) return null;
    return src.thumbnail.toPNG();
  }

  // Run OCR on the given PNG buffer and return word-level boxes to avoid cross-column lines.
  private async runTextHighlightBoxesFromBuffer(
    pngBuffer: Buffer,
    minConfidence = this.minConfidenceDefault,
    minTextLength = this.minTextLengthDefault
  ): Promise<TextHighlightBox[]> {
    await this.resolveOcrProvider();
    const tmpDir = os.tmpdir();
    const tmpPath = join(tmpDir, `text-highlight-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}.png`);
    await writeFile(tmpPath, pngBuffer);
    const lang = this.normalizeLang('auto');

    try {
      if (this.ocrProviderKind === 'cli') {
        const tsv = await this.runTesseractCli(tmpPath, lang);
        const words = this.tsvToWordItems(tsv);
        return this.groupWordsIntoPhrases(words, minConfidence, minTextLength);
      }
      const data = await this.runTesseractJs(tmpPath, lang);
      const lineBoxes = this.tesseractJsToLineBoxes(data, minConfidence, minTextLength);
      if (lineBoxes.length > 0) {
        return lineBoxes;
      }
      const words = this.tesseractJsToWordItems(data);
      return this.groupWordsIntoPhrases(words, minConfidence, minTextLength);
    } finally {
      try {
        await require('fs').promises.unlink(tmpPath);
      } catch {
        // ignore
      }
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

  private async resolveOcrProvider(): Promise<OCRProvider> {
    if (this.ocrProvider) return this.ocrProvider;
    const cli = new TesseractCliProvider();
    if (await cli.isAvailable()) {
      this.ocrProvider = cli;
      this.ocrProviderKind = 'cli';
      this.logger.info('TextHighlightOverlay: using tesseract-cli');
      return cli;
    }
    const jsProvider = new TesseractJsProvider();
    if (await jsProvider.isAvailable()) {
      this.ocrProvider = jsProvider;
      this.ocrProviderKind = 'js';
      this.logger.info('TextHighlightOverlay: using tesseract.js');
      return jsProvider;
    }
    throw new Error('Tesseract OCR nao encontrado (tesseract-ocr ou tesseract.js)');
  }

  private runTesseractCli(imagePath: string, lang: string): Promise<string> {
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

  private async runTesseractJs(imagePath: string, lang: string): Promise<any> {
    const { createWorker } = await import(/* @vite-ignore */ 'tesseract.js');
    const worker = await createWorker(lang);
    try {
      try {
        await worker.setParameters({ tessedit_pageseg_mode: '6' });
      } catch {
        // ignore if not supported
      }
      const { data } = await worker.recognize(imagePath);
      return data;
    } finally {
      await worker.terminate();
    }
  }

  private tsvToWordItems(tsv: string): WordItem[] {
    const lines = tsv.split('\n').filter(Boolean);
    if (lines.length <= 1) return [];
    const words: WordItem[] = [];
    for (let i = 1; i < lines.length; i += 1) {
      const parts = lines[i].split('\t');
      if (parts.length < 12) continue;
      const level = Number(parts[0]);
      if (level !== 5) continue;
      const page = parts[1];
      const block = parts[2];
      const par = parts[3];
      const line = parts[4];
      const left = Number(parts[6]);
      const top = Number(parts[7]);
      const width = Number(parts[8]);
      const height = Number(parts[9]);
      const conf = Number(parts[10]);
      const text = parts[11] || '';
      const trimmed = text.trim();
      if (!trimmed) continue;
      words.push({
        x: left,
        y: top,
        w: width,
        h: height,
        conf: Number.isFinite(conf) ? conf : undefined,
        text: trimmed,
        lineKey: `${page}-${block}-${par}-${line}`,
      });
    }
    return words;
  }

  private tesseractJsToWordItems(data: any): WordItem[] {
    const words = Array.isArray(data?.words) ? data.words : [];
    const items: WordItem[] = [];
    for (const word of words) {
      const text = String(word?.text || '').trim();
      if (!text) continue;
      const conf = typeof word?.confidence === 'number' ? word.confidence : word?.conf;
      const bbox = word?.bbox || {};
      const x0 = Number(bbox.x0 ?? bbox.left ?? 0);
      const y0 = Number(bbox.y0 ?? bbox.top ?? 0);
      const x1 = Number(bbox.x1 ?? (x0 + (bbox.width ?? 0)));
      const y1 = Number(bbox.y1 ?? (y0 + (bbox.height ?? 0)));
      const w = x1 - x0;
      const h = y1 - y0;
      if (!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(w) || !Number.isFinite(h)) {
        continue;
      }
      if (w <= 0 || h <= 0) continue;
      items.push({
        x: x0,
        y: y0,
        w,
        h,
        conf: typeof conf === 'number' ? conf : undefined,
        text,
      });
    }
    return items;
  }

  private tesseractJsToLineBoxes(
    data: any,
    minConfidence: number,
    minTextLength: number
  ): TextHighlightBox[] {
    const lines = Array.isArray(data?.lines) ? data.lines : [];
    const boxes: TextHighlightBox[] = [];

    for (const line of lines) {
      const words = Array.isArray(line?.words) ? line.words : [];
      const lineText = String(line?.text || '').trim();
      const fallbackText = words.map((word) => String(word?.text || '').trim()).filter(Boolean).join(' ').trim();
      const text = lineText || fallbackText;

      if (!text || text.length < minTextLength) continue;

      const confidence = typeof line?.confidence === 'number' ? line.confidence : line?.conf;
      if (typeof confidence === 'number' && confidence >= 0 && confidence < minConfidence) continue;

      const bbox = line?.bbox || {};
      let x0 = Number(bbox.x0 ?? bbox.left ?? 0);
      let y0 = Number(bbox.y0 ?? bbox.top ?? 0);
      let x1 = Number(bbox.x1 ?? (x0 + (bbox.width ?? 0)));
      let y1 = Number(bbox.y1 ?? (y0 + (bbox.height ?? 0)));

      if (!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(x1) || !Number.isFinite(y1)) {
        x0 = NaN;
        y0 = NaN;
        x1 = NaN;
        y1 = NaN;
      }

      if (!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(x1) || !Number.isFinite(y1)) {
        const wordBoxes = words.map((word) => word?.bbox || {});
        const xs: number[] = [];
        const ys: number[] = [];
        const rights: number[] = [];
        const bottoms: number[] = [];
        for (const wb of wordBoxes) {
          const wx0 = Number(wb.x0 ?? wb.left ?? 0);
          const wy0 = Number(wb.y0 ?? wb.top ?? 0);
          const wx1 = Number(wb.x1 ?? (wx0 + (wb.width ?? 0)));
          const wy1 = Number(wb.y1 ?? (wy0 + (wb.height ?? 0)));
          if (!Number.isFinite(wx0) || !Number.isFinite(wy0) || !Number.isFinite(wx1) || !Number.isFinite(wy1)) {
            continue;
          }
          xs.push(wx0);
          ys.push(wy0);
          rights.push(wx1);
          bottoms.push(wy1);
        }
        if (xs.length) {
          x0 = Math.min(...xs);
          y0 = Math.min(...ys);
          x1 = Math.max(...rights);
          y1 = Math.max(...bottoms);
        }
      }

      const w = x1 - x0;
      const h = y1 - y0;
      if (!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(w) || !Number.isFinite(h)) {
        continue;
      }
      if (w <= 0 || h <= 0) continue;

      boxes.push({
        x: x0,
        y: y0,
        w,
        h,
        conf: typeof confidence === 'number' ? confidence : undefined,
        text,
      });
    }

    return boxes;
  }

  private groupWordsIntoPhrases(
    words: WordItem[],
    minConfidence: number,
    minTextLength: number
  ): TextHighlightBox[] {
    const filtered = this.cleanWordItems(words).filter((word) => {
      const conf = typeof word.conf === 'number' ? word.conf : undefined;
      if (typeof conf === 'number' && conf >= 0 && conf < minConfidence) return false;
      return true;
    });
    if (!filtered.length) return [];

    const lines = this.groupWordsIntoLines(filtered);
    const phrases: TextHighlightBox[] = [];

    for (const lineWords of lines) {
      const sorted = [...lineWords].sort((a, b) => a.x - b.x);
      const heights = sorted.map((w) => w.h).sort((a, b) => a - b);
      const lineHeight = heights[Math.floor(heights.length / 2)] || 0;
      const gapThreshold = Math.max(20, lineHeight * this.phraseGapMultiplier);

      let current: WordItem[] = [];
      let prevRight = 0;

      for (const word of sorted) {
        const gap = word.x - prevRight;
        if (current.length === 0 || gap <= gapThreshold) {
          current.push(word);
        } else {
          const phrase = this.buildPhraseBox(current);
          if (phrase && phrase.text && phrase.text.length >= minTextLength) {
            phrases.push(phrase);
          }
          current = [word];
        }
        prevRight = word.x + word.w;
      }

      if (current.length > 0) {
        const phrase = this.buildPhraseBox(current);
        if (phrase && phrase.text && phrase.text.length >= minTextLength) {
          phrases.push(phrase);
        }
      }
    }

    return phrases;
  }

  private groupWordsIntoLines(words: WordItem[]): WordItem[][] {
    const withLineKey = words.filter((word) => word.lineKey);
    if (withLineKey.length === words.length) {
      const map = new Map<string, WordItem[]>();
      for (const word of words) {
        const key = word.lineKey as string;
        const bucket = map.get(key) || [];
        bucket.push(word);
        map.set(key, bucket);
      }
      return Array.from(map.values());
    }

    const sorted = [...words].sort((a, b) => (a.y + a.h / 2) - (b.y + b.h / 2));
    const lines: Array<{ centerY: number; items: WordItem[]; height: number }> = [];

    for (const word of sorted) {
      const centerY = word.y + word.h / 2;
      let assigned = false;
      for (const line of lines) {
        const threshold = Math.max(8, line.height * 0.6);
        if (Math.abs(centerY - line.centerY) <= threshold) {
          line.items.push(word);
          line.centerY = (line.centerY * (line.items.length - 1) + centerY) / line.items.length;
          line.height = (line.height * (line.items.length - 1) + word.h) / line.items.length;
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        lines.push({ centerY, items: [word], height: word.h });
      }
    }

    return lines.map((line) => line.items);
  }

  private buildPhraseBox(words: WordItem[]): TextHighlightBox | null {
    if (!words.length) return null;
    const xs = words.map((w) => w.x);
    const ys = words.map((w) => w.y);
    const rights = words.map((w) => w.x + w.w);
    const bottoms = words.map((w) => w.y + w.h);
    const text = words.map((w) => w.text).join(' ').trim();
    const confs = words.map((w) => w.conf).filter((c) => typeof c === 'number') as number[];
    const conf = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : undefined;

    const x = Math.min(...xs);
    const y = Math.min(...ys);
    const w = Math.max(...rights) - x;
    const h = Math.max(...bottoms) - y;

    if (w <= 0 || h <= 0 || !text) return null;
    return { x, y, w, h, conf, text };
  }

  // Public API: highlight on all displays
  async highlightAllDisplays(): Promise<void> {
    await this.runHighlightFlow(false);
  }

  async highlightAndExtractText(): Promise<string> {
    return this.runHighlightFlow(true);
  }

  async showLoading(): Promise<void> {
    await this.ensureOverlays();
    this.setLoadingAllOverlays(true);
  }

  hideLoading(): void {
    this.setLoadingAllOverlays(false);
  }

  showOverlays(): void {
    this.setOverlaysVisible(true);
  }

  hideOverlays(): void {
    this.setOverlaysVisible(false);
  }

  private async runHighlightFlow(collectText: boolean): Promise<string> {
    if (this.isRunning) return '';
    const now = Date.now();
    if (now - this.lastRunAt < this.throttleMs) return '';
    this.lastRunAt = now;
    this.isRunning = true;
    const displays = screen.getAllDisplays();
    const textByDisplay: string[] = [];
    try {
      this.clearAllOverlays();
      await this.ensureOverlays();
      this.setLoadingAllOverlays(true);
      this.setOverlaysVisible(false);
      await this.delay(140);
      const captures: Array<{ display: Electron.Display; pngBuffer: Buffer; scaleFactor: number }> = [];
      for (const display of displays) {
        const pngBuffer = await this.captureDisplayForOCR(display);
        if (!pngBuffer) {
          this.logger.warn({ displayId: display.id }, 'TextHighlightOverlay: capture returned empty buffer');
          continue;
        }
        captures.push({ display, pngBuffer, scaleFactor: display.scaleFactor || 1 });
      }
      this.setOverlaysVisible(true);
      for (const capture of captures) {
        try {
          const scaleFactor = capture.scaleFactor;
          const rawBoxes = await this.runTextHighlightBoxesFromBuffer(
            capture.pngBuffer,
            this.minConfidenceDefault,
            this.minTextLengthDefault
          );
          if (collectText) {
            const text = this.buildTextFromBoxes(rawBoxes);
            if (text) textByDisplay.push(text);
          }
          const boxes = rawBoxes
            .map((b) => ({
              ...b,
              x: b.x / scaleFactor,
              y: b.y / scaleFactor,
              w: b.w / scaleFactor,
              h: b.h / scaleFactor,
            }))
            .filter((b) => b.w > 0 && b.h > 0);
          const ttlMs = this.ttlMsDefault;
          this.logger.info({ displayId: capture.display.id, boxes: boxes.length }, 'TextHighlightOverlay: OCR boxes ready');
          // Send to overlay renderer (reuse the existing overlay window)
          const overlayWindow = this.getOverlayWindow(capture.display);
          if (overlayWindow && overlayWindow.webContents) {
            overlayWindow.webContents.send('text-highlight:setBoxes', { boxes, ttlMs });
          }
        } catch (err) {
          this.logger.error({ err, displayId: capture.display.id }, 'TextHighlightOverlay: failed to process display');
        }
      }
    } finally {
      this.setOverlaysVisible(true);
      this.setLoadingAllOverlays(false);
      this.isRunning = false;
    }
    return textByDisplay.filter(Boolean).join('\n\n');
  }

  clearAllOverlays(): void {
    for (const win of this.overlays.values()) {
      if (win && !win.isDestroyed()) {
        win.webContents.send('text-highlight:clear');
      }
    }
  }
}

let textHighlightOverlayManager: TextHighlightOverlayManager | null = null;
export function getTextHighlightOverlayManager(): TextHighlightOverlayManager {
  if (!textHighlightOverlayManager) {
    textHighlightOverlayManager = new TextHighlightOverlayManager();
  }
  return textHighlightOverlayManager;
}
