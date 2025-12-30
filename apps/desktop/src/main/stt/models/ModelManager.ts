import { app } from 'electron';
import { EventEmitter } from 'events';
import { createWriteStream, promises as fs } from 'fs';
import { basename, dirname, join } from 'path';
import { pipeline } from 'stream/promises';
import { createHash } from 'crypto';
import extractZip from 'extract-zip';
import { ModelDescriptor, InstalledModel } from '@ricky/shared';
import { modelCatalog } from './modelCatalog';
import { getConfigStore } from '../../storage/configStore';
import { getLogger } from '@ricky/logger';
import https from 'https';
import http, { type IncomingMessage } from 'http';

const logger = getLogger();

export type ModelInstallProgressEvent = {
  modelId: string;
  progress: number;
};

export type ModelInstallDoneEvent = {
  modelId: string;
  installPath: string;
};

export type ModelInstallErrorEvent = {
  modelId: string;
  message: string;
};

export class ModelManager {
  private emitter = new EventEmitter();
  private configStore = getConfigStore();

  getCatalog(): ModelDescriptor[] {
    return modelCatalog;
  }

  listInstalled(): InstalledModel[] {
    return this.configStore.getInstalledModels();
  }

  getActiveModelId(): string {
    return this.configStore.getConfig().modelId;
  }

  async setActiveModel(modelId: string): Promise<void> {
    const installed = this.listInstalled().find((model) => model.id === modelId);
    if (!installed) {
      throw new Error('Modelo nao instalado');
    }
    this.configStore.setConfig({ modelId });
  }

  async install(modelId: string): Promise<InstalledModel> {
    const descriptor = this.getCatalog().find((model) => model.id === modelId);
    if (!descriptor) {
      throw new Error('Modelo nao encontrado');
    }

    const existing = this.listInstalled().find((model) => model.id === modelId);
    if (existing) {
      return existing;
    }

    if (descriptor.source !== 'remote' || !descriptor.url) {
      throw new Error('Modelo nao pode ser instalado automaticamente');
    }

    const modelsRoot = this.getModelsRoot();
    await fs.mkdir(modelsRoot, { recursive: true });
    const targetDir = join(modelsRoot, descriptor.id);

    const archivePath = join(app.getPath('temp'), `${descriptor.id}.zip`);

    try {
      await this.downloadFile(descriptor, archivePath);
      await fs.rm(targetDir, { recursive: true, force: true });
      await extractZip(archivePath, { dir: targetDir });
      const modelDir = await this.resolveModelDir(targetDir);
      await this.validateModelDirectory(modelDir);

      const installed: InstalledModel = {
        ...descriptor,
        installed: true,
        installPath: modelDir,
        installedAt: Date.now(),
      };

      const updated = [...this.listInstalled(), installed];
      this.configStore.setInstalledModels(updated);
      const currentConfig = this.configStore.getConfig();
      if (!currentConfig.modelId) {
        this.configStore.setConfig({ modelId: installed.id });
      }
      this.emitter.emit('install-done', {
        modelId: descriptor.id,
        installPath: modelDir,
      } as ModelInstallDoneEvent);

      return installed;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao instalar modelo';
      this.emitter.emit('install-error', {
        modelId: descriptor.id,
        message,
      } as ModelInstallErrorEvent);
      throw error;
    } finally {
      await fs.unlink(archivePath).catch(() => undefined);
    }
  }

  async remove(modelId: string): Promise<void> {
    const installed = this.listInstalled().find((model) => model.id === modelId);
    if (!installed) {
      return;
    }

    const modelsRoot = this.getModelsRoot();
    if (installed.installPath.startsWith(modelsRoot)) {
      await fs.rm(installed.installPath, { recursive: true, force: true });
    }

    const updated = this.listInstalled().filter((model) => model.id !== modelId);
    this.configStore.setInstalledModels(updated);

    const currentConfig = this.configStore.getConfig();
    if (currentConfig.modelId === modelId) {
      this.configStore.setConfig({ modelId: '' });
    }
  }

  async importModel(path: string, overrides?: Partial<ModelDescriptor>): Promise<InstalledModel> {
    const modelDir = await this.resolveModelDir(path);
    await this.validateModelDirectory(modelDir);

    const existing = this.listInstalled().find((model) => model.installPath === modelDir);
    if (existing) {
      return existing;
    }

    const name = basename(modelDir);
    const baseId = overrides?.id || `custom-${name}`;
    const existingById = this.listInstalled().find((model) => model.id === baseId);
    if (existingById) {
      return existingById;
    }
    const finalId = baseId;
    const installed: InstalledModel = {
      id: finalId,
      label: overrides?.label || `Custom: ${name}`,
      language: overrides?.language || 'pt-BR',
      source: 'localPath',
      sizeMB: overrides?.sizeMB,
      accuracyHint: overrides?.accuracyHint,
      url: undefined,
      sha256: undefined,
      defaultSampleRate: overrides?.defaultSampleRate || 16000,
      installed: true,
      installPath: modelDir,
      installedAt: Date.now(),
    };

    const updated = [...this.listInstalled().filter((model) => model.id !== installed.id), installed];
    this.configStore.setInstalledModels(updated);

    return installed;
  }

  onInstallProgress(cb: (event: ModelInstallProgressEvent) => void): () => void {
    this.emitter.on('install-progress', cb);
    return () => this.emitter.off('install-progress', cb);
  }

  onInstallDone(cb: (event: ModelInstallDoneEvent) => void): () => void {
    this.emitter.on('install-done', cb);
    return () => this.emitter.off('install-done', cb);
  }

  onInstallError(cb: (event: ModelInstallErrorEvent) => void): () => void {
    this.emitter.on('install-error', cb);
    return () => this.emitter.off('install-error', cb);
  }

  private getModelsRoot(): string {
    return join(app.getPath('home'), '.local', 'share', 'ricky', 'vosk-models');
  }

  private async validateModelDirectory(path: string): Promise<void> {
    const entries = await fs.readdir(path, { withFileTypes: true });
    const folders = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);

    const hasLegacyLayout = folders.includes('conf') && (folders.includes('am') || folders.includes('graph'));
    const hasModernLayout =
      files.includes('final.mdl') &&
      (files.includes('HCLr.fst') || files.includes('HCLG.fst') || files.includes('Gr.fst'));

    if (!hasLegacyLayout && !hasModernLayout) {
      throw new Error('Diretorio de modelo invalido (estrutura Vosk nao reconhecida)');
    }
  }

  private async resolveModelDir(rootDir: string): Promise<string> {
    const queue: Array<{ dir: string; depth: number }> = [{ dir: rootDir, depth: 0 }];
    const seen = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;
      const { dir, depth } = current;
      if (seen.has(dir)) continue;
      seen.add(dir);

      try {
        await this.validateModelDirectory(dir);
        return dir;
      } catch {
        if (depth >= 3) continue;
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const subdirs = entries
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
          .filter((name) => !name.startsWith('.') && name !== '__MACOSX');
        for (const subdir of subdirs) {
          queue.push({ dir: join(dir, subdir), depth: depth + 1 });
        }
      }
    }

    throw new Error('Nao foi possivel localizar o modelo dentro do pacote extraido');
  }

  private async downloadFile(descriptor: ModelDescriptor, destination: string): Promise<void> {
    const url = descriptor.url;
    if (!url) {
      throw new Error('URL invalida para download');
    }

    await fs.mkdir(dirname(destination), { recursive: true });

    const handleResponse = async (response: IncomingMessage, resolve: () => void, reject: (error: Error) => void) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        await this.downloadFile({ ...descriptor, url: response.headers.location }, destination);
        resolve();
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Falha ao baixar modelo: ${response.statusCode}`));
        return;
      }

      const total = Number(response.headers['content-length'] || 0);
      let downloaded = 0;

      response.on('data', (chunk) => {
        downloaded += chunk.length;
        if (total > 0) {
          const progress = Math.round((downloaded / total) * 100);
          this.emitter.emit('install-progress', {
            modelId: descriptor.id,
            progress,
          } as ModelInstallProgressEvent);
        }
      });

      const fileStream = createWriteStream(destination);
      await pipeline(response, fileStream);

      if (descriptor.sha256) {
        const hash = createHash('sha256');
        const fileBuffer = await fs.readFile(destination);
        hash.update(fileBuffer);
        const digest = hash.digest('hex');
        if (digest !== descriptor.sha256) {
          throw new Error('SHA256 do modelo nao confere');
        }
      }

      this.emitter.emit('install-progress', {
        modelId: descriptor.id,
        progress: 100,
      } as ModelInstallProgressEvent);
      resolve();
    };

    await new Promise<void>((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      const request = client.get(url, (response) => {
        handleResponse(response, resolve, reject).catch((error) => reject(error));
      });
      request.on('error', (error) => {
        logger.error({ err: error }, 'Failed to download model');
        reject(error);
      });
    });
  }
}
