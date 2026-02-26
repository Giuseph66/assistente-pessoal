import { EventEmitter } from 'events';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { app, globalShortcut, nativeImage } from 'electron';
import { getLogger } from '@neo/logger';
import { getAutomationStore } from '../storage/automationStore';
import { getAutomationService } from './AutomationService';
import { MappingPoint, ImageTemplate, MappingPointType } from '@neo/shared';
import { captureAreaInteractiveConfirmed } from '../screenshot';
import { DatabaseManager } from '../database';

const logger = getLogger();

export class MappingService extends EventEmitter {
  private mappingMode = false;
  private store = getAutomationStore();
  private automationService = getAutomationService();
  private mappingHotkeys: Set<string> = new Set();
  private pendingPointCapture: ((point: { x: number; y: number } | null) => void) | null = null;
  private pendingTemplateCapture: ((region: { x: number; y: number; width: number; height: number } | null) => void) | null = null;

  async startMappingMode(): Promise<void> {
    if (this.mappingMode) {
      logger.warn('Mapping mode already active');
      return;
    }
    this.mappingMode = true;
    
    // Registrar hotkeys para mapeamento
    // Ctrl+Shift+M = Mapear ponto de clique
    // Ctrl+Shift+T = Capturar template de imagem
    // Ctrl+Shift+Escape = Parar modo de mapeamento
    this.registerMappingHotkey('CommandOrControl+Shift+M', async () => {
      await this.handleMapPointHotkey();
    });
    
    this.registerMappingHotkey('CommandOrControl+Shift+T', async () => {
      await this.handleCaptureTemplateHotkey();
    });
    
    this.registerMappingHotkey('CommandOrControl+Shift+Escape', async () => {
      await this.stopMappingMode();
    });
    
    this.emit('mappingModeChanged', { active: true });
    logger.info('Mapping mode started - Hotkeys: Ctrl+Shift+M (ponto), Ctrl+Shift+T (template), Ctrl+Shift+Esc (parar)');
  }

  async stopMappingMode(): Promise<void> {
    if (!this.mappingMode) {
      logger.warn('Mapping mode not active');
      return;
    }
    this.mappingMode = false;
    
    // Desregistrar hotkeys
    this.unregisterMappingHotkeys();
    
    // Cancelar capturas pendentes
    if (this.pendingPointCapture) {
      this.pendingPointCapture(null);
      this.pendingPointCapture = null;
    }
    if (this.pendingTemplateCapture) {
      this.pendingTemplateCapture(null);
      this.pendingTemplateCapture = null;
    }
    
    this.emit('mappingModeChanged', { active: false });
    logger.info('Mapping mode stopped');
  }

  private registerMappingHotkey(accelerator: string, callback: () => Promise<void> | void): void {
    const success = globalShortcut.register(accelerator, () => {
      // Executar callback e tratar promises rejeitadas
      Promise.resolve()
        .then(() => callback())
        .catch((error) => {
          logger.error({ err: error, accelerator }, 'Error in mapping hotkey callback');
        });
    });

    if (success) {
      this.mappingHotkeys.add(accelerator);
      logger.debug({ accelerator }, 'Mapping hotkey registered');
    } else {
      logger.warn({ accelerator }, 'Failed to register mapping hotkey (may be in use)');
    }
  }

  private unregisterMappingHotkeys(): void {
    this.mappingHotkeys.forEach((accelerator) => {
      globalShortcut.unregister(accelerator);
    });
    this.mappingHotkeys.clear();
    logger.debug('All mapping hotkeys unregistered');
  }

  private async handleMapPointHotkey(): Promise<void> {
    if (!this.mappingMode) return;
    
    try {
      // Capturar posição atual do mouse
      const mousePos = await this.automationService.getMousePosition();
      
      // Enviar evento para o renderer mostrar diálogo de nomeação
      this.emit('mapping.pointCaptured', { x: mousePos.x, y: mousePos.y });
      
      logger.info({ x: mousePos.x, y: mousePos.y }, 'Point captured via hotkey');
    } catch (error) {
      logger.error({ err: error }, 'Failed to capture point via hotkey');
      this.emit('mapping.error', { message: 'Falha ao capturar ponto: ' + (error as any)?.message });
    }
  }

  private async handleCaptureTemplateHotkey(): Promise<void> {
    if (!this.mappingMode) return;
    
    try {
      // Usar a função de screenshot interativa existente
      const db = new DatabaseManager();
      const result = await captureAreaInteractiveConfirmed(db);
      db.close();
      
      if (result.success && result.region) {
        // Enviar evento com a região capturada
        this.emit('mapping.templateCaptured', {
          region: result.region,
          screenshotPath: result.path,
        });
        logger.info({ region: result.region }, 'Template region captured via hotkey');
      } else if (result.error && result.error !== 'Selecao cancelada') {
        this.emit('mapping.error', { message: result.error || 'Falha ao capturar template' });
      }
    } catch (error) {
      logger.error({ err: error }, 'Failed to capture template via hotkey');
      this.emit('mapping.error', { message: 'Falha ao capturar template: ' + (error as any)?.message });
    }
  }

  async recordPointFromHotkey(x: number, y: number, name: string, type: MappingPointType = 'click'): Promise<MappingPoint> {
    return await this.addMappingPoint(name, x, y, type);
  }

  async recordTemplateFromHotkey(
    name: string,
    region: { x: number; y: number; width: number; height: number },
    screenshotPath?: string
  ): Promise<ImageTemplate> {
    // Se temos um screenshot path, podemos usar ele diretamente
    if (screenshotPath) {
      const templatesDir = join(app.getPath('userData'), 'automation', 'templates');
      await mkdir(templatesDir, { recursive: true });
      
      const timestamp = Date.now();
      const filename = `${name.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.png`;
      const imagePath = join(templatesDir, filename);
      
      // Copiar o screenshot para o diretório de templates
      const { readFile } = await import('fs/promises');
      const imageData = await readFile(screenshotPath);
      await writeFile(imagePath, imageData);
      
      const template = this.store.addImageTemplate({
        name: name.trim(),
        imagePath,
        region,
      });
      
      this.emit('templateAdded', template);
      logger.info({ name, imagePath, region }, 'Image template saved from screenshot');
      return template;
    } else {
      // Se não temos path, capturar screenshot da região
      return await this.captureTemplate(name, region);
    }
  }

  isMappingMode(): boolean {
    return this.mappingMode;
  }

  async addMappingPoint(
    name: string,
    x: number,
    y: number,
    type: MappingPointType = 'click'
  ): Promise<MappingPoint> {
    if (!name || name.trim() === '') {
      throw new Error('Mapping point name is required');
    }

    const existing = this.store.getMappingPointByName(name);
    if (existing) {
      throw new Error(`Mapping point with name "${name}" already exists`);
    }

    const point = this.store.addMappingPoint({
      name: name.trim(),
      x,
      y,
      type,
    });

    this.emit('mappingPointAdded', point);
    logger.info({ name, x, y, type }, 'Mapping point added');
    return point;
  }

  getMappingPoint(id: string): MappingPoint | undefined {
    return this.store.getMappingPoint(id);
  }

  getMappingPointByName(name: string): MappingPoint | undefined {
    return this.store.getMappingPointByName(name);
  }

  getAllMappingPoints(): MappingPoint[] {
    return this.store.getMappingPoints();
  }

  async updateMappingPoint(
    id: string,
    updates: Partial<Omit<MappingPoint, 'id' | 'createdAt'>>
  ): Promise<MappingPoint | null> {
    const updated = this.store.updateMappingPoint(id, updates);
    if (updated) {
      this.emit('mappingPointUpdated', updated);
      logger.info({ id, updates }, 'Mapping point updated');
    }
    return updated;
  }

  async deleteMappingPoint(id: string): Promise<boolean> {
    const deleted = this.store.deleteMappingPoint(id);
    if (deleted) {
      this.emit('mappingPointDeleted', { id });
      logger.info({ id }, 'Mapping point deleted');
    }
    return deleted;
  }

  async captureTemplate(
    name: string,
    region?: { x: number; y: number; width: number; height: number }
  ): Promise<ImageTemplate> {
    if (!name || name.trim() === '') {
      throw new Error('Template name is required');
    }

    const existing = this.store.getImageTemplateByName(name);
    if (existing) {
      throw new Error(`Template with name "${name}" already exists`);
    }

    // Capturar screenshot (retorna Buffer)
    const screenshotBuffer = await this.automationService.screenshot(region);
    
    // Salvar template em diretório de templates
    const templatesDir = join(app.getPath('userData'), 'automation', 'templates');
    await mkdir(templatesDir, { recursive: true });
    
    const timestamp = Date.now();
    const filename = `${name.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.png`;
    const imagePath = join(templatesDir, filename);
    
    await writeFile(imagePath, screenshotBuffer);

    const template = this.store.addImageTemplate({
      name: name.trim(),
      imagePath,
      region,
    });

    this.emit('templateAdded', template);
    logger.info({ name, imagePath, region }, 'Image template captured');
    return template;
  }

  getImageTemplate(id: string): ImageTemplate | undefined {
    return this.store.getImageTemplate(id);
  }

  getImageTemplateByName(name: string): ImageTemplate | undefined {
    return this.store.getImageTemplateByName(name);
  }

  getAllImageTemplates(): ImageTemplate[] {
    return this.store.getImageTemplates();
  }

  async updateImageTemplate(
    id: string,
    updates: Partial<Omit<ImageTemplate, 'id' | 'createdAt'>>
  ): Promise<ImageTemplate | null> {
    let nextUpdates = updates;
    if (updates.name !== undefined) {
      const normalized = updates.name.trim();
      if (!normalized) {
        throw new Error('Template name is required');
      }
      const existing = this.store.getImageTemplateByName(normalized);
      if (existing && existing.id !== id) {
        throw new Error(`Template with name "${normalized}" already exists`);
      }
      nextUpdates = { ...updates, name: normalized };
    }

    const updated = this.store.updateImageTemplate(id, nextUpdates);
    if (updated) {
      this.emit('templateUpdated', updated);
      logger.info({ id, updates: nextUpdates }, 'Image template updated');
    }
    return updated;
  }

  async importImageTemplate(name: string, dataUrl: string): Promise<ImageTemplate> {
    const normalized = name?.trim();
    if (!normalized) {
      throw new Error('Template name is required');
    }

    const existing = this.store.getImageTemplateByName(normalized);
    if (existing) {
      throw new Error(`Template with name "${normalized}" already exists`);
    }

    if (!dataUrl || typeof dataUrl !== 'string') {
      throw new Error('Invalid image data');
    }

    const image = nativeImage.createFromDataURL(dataUrl);
    if (image.isEmpty()) {
      throw new Error('Invalid image data');
    }

    const templatesDir = join(app.getPath('userData'), 'automation', 'templates');
    await mkdir(templatesDir, { recursive: true });

    const timestamp = Date.now();
    const filename = `${normalized.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.png`;
    const imagePath = join(templatesDir, filename);

    await writeFile(imagePath, image.toPNG());

    const size = image.getSize();
    const template = this.store.addImageTemplate({
      name: normalized,
      imagePath,
      region: {
        x: 0,
        y: 0,
        width: size.width,
        height: size.height,
      },
    });

    this.emit('templateAdded', template);
    logger.info({ name: normalized, imagePath }, 'Image template imported');
    return template;
  }

  async replaceImageTemplate(id: string, dataUrl: string): Promise<ImageTemplate | null> {
    const template = this.store.getImageTemplate(id);
    if (!template) return null;

    if (!dataUrl || typeof dataUrl !== 'string') {
      throw new Error('Invalid image data');
    }

    const image = nativeImage.createFromDataURL(dataUrl);
    if (image.isEmpty()) {
      throw new Error('Invalid image data');
    }

    await writeFile(template.imagePath, image.toPNG());

    const size = image.getSize();
    const updates: Partial<Omit<ImageTemplate, 'id' | 'createdAt'>> = {};
    if (template.region) {
      updates.region = { ...template.region, width: size.width, height: size.height };
    }

    const updated = this.store.updateImageTemplate(id, updates);
    if (updated) {
      this.emit('templateUpdated', updated);
      logger.info({ id, width: size.width, height: size.height }, 'Image template replaced');
    }
    return updated;
  }

  async resizeImageTemplate(
    id: string,
    size: { width?: number; height?: number; keepAspect?: boolean }
  ): Promise<ImageTemplate | null> {
    const template = this.store.getImageTemplate(id);
    if (!template) return null;

    const image = nativeImage.createFromPath(template.imagePath);
    if (image.isEmpty()) {
      throw new Error(`Template image file not found: ${template.imagePath}`);
    }

    const currentSize = image.getSize();
    const keepAspect = size.keepAspect !== false;

    const normalize = (value: number | undefined, fallback: number) => {
      const next = Number(value);
      if (!Number.isFinite(next) || next <= 0) return fallback;
      return Math.round(next);
    };

    let targetWidth = normalize(size.width, currentSize.width);
    let targetHeight = normalize(size.height, currentSize.height);

    if (keepAspect) {
      const ratio = currentSize.width / currentSize.height;
      if (size.width && !size.height) {
        targetHeight = Math.max(1, Math.round(targetWidth / ratio));
      } else if (!size.width && size.height) {
        targetWidth = Math.max(1, Math.round(targetHeight * ratio));
      } else if (size.width && size.height) {
        targetHeight = Math.max(1, Math.round(targetWidth / ratio));
      }
    }

    if (!targetWidth || !targetHeight) {
      throw new Error('Invalid template size');
    }

    const resized = image.resize({ width: targetWidth, height: targetHeight, quality: 'good' });
    await writeFile(template.imagePath, resized.toPNG());

    const updates: Partial<Omit<ImageTemplate, 'id' | 'createdAt'>> = {};
    if (template.region) {
      updates.region = { ...template.region, width: targetWidth, height: targetHeight };
    }

    const updated = this.store.updateImageTemplate(id, updates);
    if (updated) {
      this.emit('templateUpdated', updated);
      logger.info({ id, width: targetWidth, height: targetHeight }, 'Image template resized');
    }
    return updated;
  }

  async cropImageTemplate(
    id: string,
    rect: { x: number; y: number; width: number; height: number }
  ): Promise<ImageTemplate | null> {
    const template = this.store.getImageTemplate(id);
    if (!template) return null;

    const image = nativeImage.createFromPath(template.imagePath);
    if (image.isEmpty()) {
      throw new Error(`Template image file not found: ${template.imagePath}`);
    }

    const imageSize = image.getSize();
    const normalize = (value: number, fallback: number) => {
      const next = Number(value);
      if (!Number.isFinite(next)) return fallback;
      return Math.round(next);
    };
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

    let cropX = normalize(rect.x, 0);
    let cropY = normalize(rect.y, 0);
    let cropWidth = normalize(rect.width, imageSize.width);
    let cropHeight = normalize(rect.height, imageSize.height);

    cropX = clamp(cropX, 0, Math.max(0, imageSize.width - 1));
    cropY = clamp(cropY, 0, Math.max(0, imageSize.height - 1));
    cropWidth = clamp(cropWidth, 1, Math.max(1, imageSize.width - cropX));
    cropHeight = clamp(cropHeight, 1, Math.max(1, imageSize.height - cropY));

    const cropped = image.crop({ x: cropX, y: cropY, width: cropWidth, height: cropHeight });
    await writeFile(template.imagePath, cropped.toPNG());

    const updates: Partial<Omit<ImageTemplate, 'id' | 'createdAt'>> = {
      region: template.region
        ? {
            x: template.region.x + cropX,
            y: template.region.y + cropY,
            width: cropWidth,
            height: cropHeight,
          }
        : {
            x: cropX,
            y: cropY,
            width: cropWidth,
            height: cropHeight,
          },
    };

    const updated = this.store.updateImageTemplate(id, updates);
    if (updated) {
      this.emit('templateUpdated', updated);
      logger.info({ id, width: cropWidth, height: cropHeight }, 'Image template cropped');
    }
    return updated;
  }

  async deleteImageTemplate(id: string): Promise<boolean> {
    const template = this.store.getImageTemplate(id);
    if (template) {
      // Opcional: deletar arquivo de imagem também
      // await unlink(template.imagePath).catch(() => {});
    }
    
    const deleted = this.store.deleteImageTemplate(id);
    if (deleted) {
      this.emit('templateDeleted', { id });
      logger.info({ id }, 'Image template deleted');
    }
    return deleted;
  }

  async findTemplateOnScreen(
    templateName: string,
    confidence?: number,
    timeout?: number
  ): Promise<{ x: number; y: number; width: number; height: number } | null> {
    const template = this.store.getImageTemplateByName(templateName);
    if (!template) {
      throw new Error(`Template "${templateName}" not found in store`);
    }

    // Verificar se o arquivo existe
    const { existsSync } = await import('fs');
    if (!existsSync(template.imagePath)) {
      logger.error({ templateName, imagePath: template.imagePath }, 'Template image file does not exist');
      throw new Error(`Template image file not found: ${template.imagePath}`);
    }

    logger.debug({ templateName, imagePath: template.imagePath }, 'Searching for template on screen');

    const config = this.store.getConfig();
    try {
      const found = await this.automationService.findImage(
        template.imagePath,
        confidence ?? config.imageFindConfidence,
        timeout ?? config.imageFindTimeout
      );

      if (!found) {
        logger.warn({ templateName }, 'Template not found on screen');
        return null;
      }

      logger.info({ templateName, region: found }, 'Template found on screen');
      return {
        x: found.left,
        y: found.top,
        width: found.width,
        height: found.height,
      };
    } catch (error: any) {
      logger.error({ err: error, templateName, imagePath: template.imagePath }, 'Failed to find template on screen');
      throw new Error(`Failed to find template "${templateName}": ${error?.message || 'Unknown error'}`);
    }
  }
}

let mappingService: MappingService | null = null;

export function getMappingService(): MappingService {
  if (!mappingService) {
    mappingService = new MappingService();
  }
  return mappingService;
}
