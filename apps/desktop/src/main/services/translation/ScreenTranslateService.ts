import { EventEmitter } from 'events';
import { getLogger } from '@ricky/logger';
import {
  TranslationStartOptions,
  TranslationStatus,
  TranslationResult,
  TranslationBlock,
} from '@ricky/shared';
import { captureScreenshot } from '../../screenshot';
import { getOverlayManager } from '../../overlay';
import { OCRProvider } from './ocr/OCRProvider';
import { TesseractCliProvider } from './ocr/TesseractCliProvider';
import { TesseractJsProvider } from './ocr/TesseractJsProvider';
import { TranslateProvider } from './translate/TranslateProvider';
import { ArgosProvider } from './translate/ArgosProvider';
import { TranslationCache } from './cache/TranslationCache';

const logger = getLogger();

type ServiceStatus = TranslationStatus & { startedAt?: number };

export class ScreenTranslateService extends EventEmitter {
  private status: ServiceStatus = { stage: 'idle' };
  private options: TranslationStartOptions | null = null;
  private running = false;
  private processing = false;
  private liveTimer: NodeJS.Timeout | null = null;
  private overlayManager = getOverlayManager();
  private cache = new TranslationCache();
  private ocrProvider: OCRProvider | null = null;
  private translateProvider: TranslateProvider | null = null;
  private lastResult: TranslationResult | null = null;

  async start(options: TranslationStartOptions): Promise<void> {
    this.options = {
      ...options,
      liveIntervalMs: options.liveIntervalMs || 4000,
    };
    this.running = true;
    this.cache.clear();
    this.overlayManager.enterTranslationMode();
    await this.runOnce();
    if (this.options.liveMode) {
      this.scheduleNext();
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    this.processing = false;
    if (this.liveTimer) {
      clearTimeout(this.liveTimer);
      this.liveTimer = null;
    }
    this.overlayManager.exitTranslationMode();
    this.setStatus({ stage: 'idle' });
  }

  async refresh(): Promise<void> {
    if (!this.running || this.processing) return;
    await this.runOnce();
  }

  getStatus(): TranslationStatus {
    return this.status;
  }

  getLastResult(): TranslationResult | null {
    return this.lastResult;
  }

  private scheduleNext(): void {
    if (!this.options?.liveMode || !this.running) return;
    const interval = this.options.liveIntervalMs || 4000;
    if (this.liveTimer) clearTimeout(this.liveTimer);
    this.liveTimer = setTimeout(async () => {
      if (!this.running || this.processing) {
        this.scheduleNext();
        return;
      }
      await this.runOnce();
      this.scheduleNext();
    }, interval);
  }

  private async runOnce(): Promise<void> {
    if (!this.options) return;
    if (this.processing) return;
    this.processing = true;
    const startedAt = Date.now();

    try {
      this.setStatus({ stage: 'capturing', message: 'Capturando tela...', timing: { startedAt } });

      this.overlayManager.hide();
      const captureResult = await captureScreenshot({ mode: 'fullscreen' });
      this.overlayManager.show();

      if (!captureResult.success || !captureResult.path) {
        throw new Error(captureResult.error || 'Falha ao capturar screenshot');
      }

      const screenshotPath = captureResult.path;
      const width = captureResult.width || 0;
      const height = captureResult.height || 0;

      this.setStatus({ stage: 'ocr', message: 'Detectando textos...', timing: { startedAt } });
      const ocrProvider = await this.resolveOcrProvider();
      const ocrBlocks = await ocrProvider.recognize({
        imagePath: screenshotPath,
        lang: this.options.fromLang,
        minConfidence: this.options.minConfidence,
        minTextLength: this.options.minTextLength,
      });

      this.setStatus({ stage: 'translating', message: 'Traduzindo textos...', timing: { startedAt }, blocks: ocrBlocks.length });
      const translatedBlocks = await this.translateBlocks(ocrBlocks);

      this.setStatus({ stage: 'rendering', message: 'Renderizando overlay...', timing: { startedAt }, blocks: translatedBlocks.length });

      this.lastResult = {
        screenshotPath,
        width,
        height,
        blocks: translatedBlocks,
      };

      this.emit('result', this.lastResult);

      this.setStatus({
        stage: 'idle',
        message: 'Tradução aplicada',
        timing: { startedAt, elapsedMs: Date.now() - startedAt },
        blocks: translatedBlocks.length,
      });
    } catch (error: any) {
      logger.error({ err: error }, 'Translation pipeline failed');
      this.setStatus({
        stage: 'error',
        message: error?.message || 'Erro na tradução',
        timing: { startedAt, elapsedMs: Date.now() - startedAt },
      });
      this.emit('error', { message: error?.message || 'Erro na tradução' });
    } finally {
      this.processing = false;
    }
  }

  private setStatus(status: TranslationStatus): void {
    this.status = status;
    this.emit('status', status);
  }

  private async resolveOcrProvider(): Promise<OCRProvider> {
    if (this.ocrProvider) return this.ocrProvider;
    const cli = new TesseractCliProvider();
    if (await cli.isAvailable()) {
      this.ocrProvider = cli;
      return cli;
    }

    const jsProvider = new TesseractJsProvider();
    if (await jsProvider.isAvailable()) {
      this.ocrProvider = jsProvider;
      return jsProvider;
    }

    throw new Error('Tesseract nao encontrado. Instale: tesseract-ocr tesseract-ocr-por tesseract-ocr-eng');
  }

  private async resolveTranslateProvider(): Promise<TranslateProvider> {
    if (this.translateProvider) return this.translateProvider;
    const argos = new ArgosProvider();
    if (await argos.isAvailable()) {
      this.translateProvider = argos;
      return argos;
    }
    throw new Error('Argos Translate nao encontrado. Configure RICKY_ARGOS_PYTHON ou instale em apps/desktop/.venv (pip install argostranslate).');
  }

  private async translateBlocks(blocks: Array<{ text: string; bbox: any; confidence?: number }>): Promise<TranslationBlock[]> {
    if (!blocks.length || !this.options) return [];

    const fromLang = this.options.fromLang;
    const toLang = this.options.toLang;

    const translateProvider = await this.resolveTranslateProvider();
    const uniqueTexts = Array.from(new Set(blocks.map((block) => block.text.trim()).filter(Boolean)));

    const untranslated = uniqueTexts.filter((text) => !this.cache.get(fromLang, toLang, text));

    if (untranslated.length > 0) {
      if (translateProvider.translateBatch) {
        const translations = await translateProvider.translateBatch(untranslated, fromLang, toLang);
        translations.forEach((translated, index) => {
          this.cache.set(fromLang, toLang, untranslated[index], translated);
        });
      } else {
        for (const text of untranslated) {
          const translated = await translateProvider.translate(text, fromLang, toLang);
          this.cache.set(fromLang, toLang, text, translated);
        }
      }
    }

    return blocks.map((block) => {
      const original = block.text.trim();
      const translated = this.cache.get(fromLang, toLang, original) || original;
      return {
        original,
        translated,
        bbox: block.bbox,
        confidence: block.confidence,
      };
    });
  }
}
