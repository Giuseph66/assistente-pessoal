import { BrowserWindow, ipcMain, app } from 'electron';
import { join, parse, resolve } from 'path';
import { existsSync } from 'fs';
import { FileTranscriber } from '../stt/file/FileTranscriber';
import { DatabaseManager } from '../database';
import { ModelManager } from '../stt/models/ModelManager';
import { SubtitleSegment, TranscribeFileRequest } from '@ricky/shared';
import { segmentsToSrt, segmentsToVtt } from '../stt/file/subtitleFormats';
import { mkdir, writeFile } from 'fs/promises';

const broadcast = (channel: string, payload: any) => {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (win.isDestroyed()) return;
    const contents = win.webContents;
    if (contents.isDestroyed() || contents.isCrashed()) return;
    try {
      contents.send(channel, payload);
    } catch {
      // ignore
    }
  });
};

const isWithinDir = (baseDir: string, targetPath: string): boolean => {
  const base = resolve(baseDir) + '/';
  const target = resolve(targetPath);
  return target.startsWith(base);
};

export function registerTranscribeFileIpc(
  db: DatabaseManager,
  modelManager: ModelManager
): void {
  const transcriber = new FileTranscriber();
  let busy = false;

  const recordingsDir = join(app.getPath('userData'), 'recordings');
  const subtitlesDir = join(app.getPath('userData'), 'subtitles');

  ipcMain.handle('transcribeFile.start', async (_event, payload: TranscribeFileRequest) => {
    if (busy) {
      throw new Error('Transcricao em andamento');
    }
    const wavPath = payload.wavPath;
    if (!wavPath || !isWithinDir(recordingsDir, wavPath)) {
      throw new Error('Arquivo fora da pasta de gravacoes');
    }
    if (!existsSync(wavPath)) {
      throw new Error('Arquivo nao encontrado');
    }

    const installed = modelManager.listInstalled();
    const activeModelId = modelManager.getActiveModelId();
    const model =
      (payload.language
        ? installed.find((item) => item.language === payload.language)
        : null) ||
      installed.find((item) => item.id === activeModelId) ||
      installed[0];
    if (!model) {
      throw new Error('Modelo Vosk nao configurado');
    }

    busy = true;
    const offProgress = transcriber.onProgress((progress) =>
      broadcast('transcribe.progress', { ...progress, wavPath })
    );

    try {
      const result = await transcriber.transcribe({
        wavPath,
        modelPath: model.installPath,
        exportFormat: payload.exportFormat,
      });

      const recording = db.getRecordingByPath(wavPath);
      if (recording) {
        db.saveRecordingSubtitles(
          recording.id,
          result.vttPath || null,
          result.srtPath || null,
          payload.language || model.language
        );
      }

      broadcast('transcribe.done', {
        wavPath,
        vttPath: result.vttPath,
        srtPath: result.srtPath,
        segmentsCount: result.segments.length,
      });

      return result;
    } catch (error: any) {
      broadcast('transcribe.error', { message: error?.message || 'Erro ao transcrever' });
      throw error;
    } finally {
      offProgress();
      busy = false;
    }
  });

  ipcMain.handle(
    'transcribeFile.saveSegments',
    async (_event, payload: { wavPath: string; segments: SubtitleSegment[] }) => {
      const wavPath = payload.wavPath;
      if (!wavPath || !isWithinDir(recordingsDir, wavPath)) {
        throw new Error('Arquivo fora da pasta de gravacoes');
      }
      await mkdir(subtitlesDir, { recursive: true });
      const baseName = parse(wavPath).name || 'subtitle';
      const vttPath = join(subtitlesDir, `${baseName}.vtt`);
      const srtPath = join(subtitlesDir, `${baseName}.srt`);
      await writeFile(vttPath, segmentsToVtt(payload.segments), 'utf8');
      await writeFile(srtPath, segmentsToSrt(payload.segments), 'utf8');
      const recording = db.getRecordingByPath(wavPath);
      if (recording) {
        db.saveRecordingSubtitles(recording.id, vttPath, srtPath, undefined);
      }
      return { vttPath, srtPath, segmentsCount: payload.segments.length };
    }
  );
}
