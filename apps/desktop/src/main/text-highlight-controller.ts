import { getLogger } from '@ricky/logger';
import { getConfigManager } from '@ricky/config';
import { getTextHighlightOverlayManager } from './text-highlight-overlay';
import { getOverlayManager } from './overlay';
import { DatabaseManager } from './database';
import { captureScreenshot } from './screenshot';
import { getAIService } from './ai/AIServiceManager';

export type TextHighlightMode = 'local' | 'ai';

export type TextHighlightTranscription = {
  text: string;
  mode: TextHighlightMode;
  createdAt: number;
};

const logger = getLogger();
const config = getConfigManager();

let lastTranscription: TextHighlightTranscription | null = null;
let isRunning = false;
let lastRunAt = 0;
const runThrottleMs = 800;

export function getTextHighlightMode(): TextHighlightMode {
  return (config.get('screenshots', 'ocrMode') as TextHighlightMode) || 'local';
}

export function setTextHighlightMode(mode: TextHighlightMode): TextHighlightMode {
  const normalized: TextHighlightMode = mode === 'ai' ? 'ai' : 'local';
  config.set('screenshots', 'ocrMode', normalized);
  return normalized;
}

export function getLastTextHighlightTranscription(): TextHighlightTranscription | null {
  return lastTranscription;
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function publishTranscription(payload: TextHighlightTranscription): void {
  lastTranscription = payload;
  const overlayManager = getOverlayManager();
  overlayManager.showTextHighlightOutputWindow();
  const win = overlayManager.getTextHighlightOutputWindow();
  if (!win || win.isDestroyed()) return;

  if (win.webContents.isLoadingMainFrame()) {
    win.webContents.once('did-finish-load', () => {
      if (!win.isDestroyed()) {
        win.webContents.send('text-highlight:transcription', payload);
      }
    });
  } else {
    win.webContents.send('text-highlight:transcription', payload);
  }
}

export async function runTextHighlight(modeOverride?: TextHighlightMode): Promise<TextHighlightTranscription | null> {
  if (isRunning) return null;
  const now = Date.now();
  if (now - lastRunAt < runThrottleMs) return null;
  lastRunAt = now;
  isRunning = true;
  try {
    const mode = modeOverride || getTextHighlightMode();
    const thManager = getTextHighlightOverlayManager();

    if (mode === 'local') {
      const text = await thManager.highlightAndExtractText();
      if (!text.trim()) {
        logger.warn('TextHighlight: no text detected (local)');
        return null;
      }
      const payload = { text, mode, createdAt: Date.now() };
      publishTranscription(payload);
      return payload;
    }

    let db: DatabaseManager | null = null;
    let overlaysHidden = false;
    try {
      thManager.clearAllOverlays();
      await thManager.showLoading();
      thManager.hideOverlays();
      overlaysHidden = true;
      await delay(140);
      db = new DatabaseManager();
      const capture = await captureScreenshot({ mode: 'fullscreen' }, db);
      thManager.showOverlays();
      overlaysHidden = false;

      if (!capture.success || !capture.screenshotId) {
        throw new Error(capture.error || 'Falha ao capturar screenshot');
      }

      const aiService = getAIService(db);
      const text = await aiService.extractText(capture.screenshotId);
      if (!text.trim()) {
        logger.warn('TextHighlight: no text detected (ai)');
        return null;
      }
      const payload = { text, mode, createdAt: Date.now() };
      publishTranscription(payload);
      return payload;
    } catch (error) {
      logger.error({ err: error }, 'TextHighlight: AI extraction failed');
      return null;
    } finally {
      if (overlaysHidden) {
        thManager.showOverlays();
      }
      thManager.hideLoading();
      if (db) {
        db.close();
      }
    }
  } finally {
    isRunning = false;
  }
}
