import { mouse, keyboard, screen, Button, Key, loadImage, centerOf, Region, Point, Image } from '@nut-tree-fork/nut-js';
import { clipboard } from 'electron';
import { getLogger } from '@ricky/logger';
import sharp from 'sharp';

// Tipo local para MouseButton (evita problemas de importação)
type MouseButton = 'left' | 'right' | 'middle';

const logger = getLogger();

// Nota: O @nut-tree-fork/nut-js não tem um ImageFinder provider disponível no npm.
// Implementamos uma solução alternativa usando sharp para comparação de imagens.

export class AutomationService {
  private initialized = false;
  private imageFinderAvailable = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      // Configurar velocidade do mouse (opcional)
      mouse.config.mouseSpeed = 1000;
      keyboard.config.autoDelayMs = 50;
      
      // Sharp será verificado apenas quando for usado (lazy check)
      // Evita crash durante inicialização
      this.imageFinderAvailable = true;
      
      this.initialized = true;
      logger.info('AutomationService initialized');
    } catch (error) {
      logger.error({ err: error }, 'Failed to initialize AutomationService');
      throw error;
    }
  }
  
  isImageFinderAvailable(): boolean {
    return this.imageFinderAvailable;
  }

  async moveMouse(x: number, y: number): Promise<void> {
    await this.ensureInitialized();
    try {
      await mouse.setPosition({ x, y });
      logger.debug({ x, y }, 'Mouse moved');
    } catch (error) {
      logger.error({ err: error, x, y }, 'Failed to move mouse');
      throw error;
    }
  }

  async click(button: MouseButton = 'left', x?: number, y?: number): Promise<void> {
    await this.ensureInitialized();
    try {
      const nutButton = this.mapButton(button);
      
      if (x !== undefined && y !== undefined) {
        await mouse.setPosition({ x, y });
      }
      
      await mouse.click(nutButton);
      logger.debug({ button, x, y }, 'Mouse clicked');
    } catch (error) {
      logger.error({ err: error, button, x, y }, 'Failed to click');
      throw error;
    }
  }

  async doubleClick(button: MouseButton = 'left', x?: number, y?: number): Promise<void> {
    await this.ensureInitialized();
    try {
      const nutButton = this.mapButton(button);
      
      if (x !== undefined && y !== undefined) {
        await mouse.setPosition({ x, y });
      }
      
      await mouse.doubleClick(nutButton);
      logger.debug({ button, x, y }, 'Mouse double clicked');
    } catch (error) {
      logger.error({ err: error, button, x, y }, 'Failed to double click');
      throw error;
    }
  }

  async rightClick(x?: number, y?: number): Promise<void> {
    await this.click('right', x, y);
  }

  async drag(fromX: number, fromY: number, toX: number, toY: number, button: MouseButton = 'left'): Promise<void> {
    await this.ensureInitialized();
    try {
      const nutButton = this.mapButton(button);
      await mouse.setPosition(new Point(fromX, fromY));
      await mouse.pressButton(nutButton);
      await mouse.drag([new Point(toX, toY)]);
      await mouse.releaseButton(nutButton);
      logger.debug({ fromX, fromY, toX, toY, button }, 'Mouse dragged');
    } catch (error) {
      logger.error({ err: error, fromX, fromY, toX, toY, button }, 'Failed to drag');
      throw error;
    }
  }

  async type(text: string, delayMs?: number): Promise<void> {
    await this.ensureInitialized();
    try {
      if (delayMs) {
        keyboard.config.autoDelayMs = delayMs;
      }
      await keyboard.type(text);
      logger.debug({ textLength: text.length }, 'Text typed');
    } catch (error) {
      logger.error({ err: error }, 'Failed to type text');
      throw error;
    }
  }

  async pressKey(key: string, modifiers: string[] = []): Promise<void> {
    await this.ensureInitialized();
    try {
      const nutKey = this.mapKey(key);
      const modifierKeys = (modifiers || []).map((m) => this.mapKey(m));

      // CRÍTICO: em muitas versões do nut-js, pressKey() mantém a tecla pressionada;
      // é necessário fazer press+release explicitamente (igual ao pasteText()).
      for (const mk of modifierKeys) {
        await keyboard.pressKey(mk);
      }

      await keyboard.pressKey(nutKey);
      await keyboard.releaseKey(nutKey);

      for (const mk of [...modifierKeys].reverse()) {
        await keyboard.releaseKey(mk);
      }
      
      logger.debug({ key, modifiers }, 'Key pressed');
    } catch (error) {
      logger.error({ err: error, key, modifiers }, 'Failed to press key');
      throw error;
    }
  }

  /**
   * Cola texto na posição atual do cursor (onde o usuário está focado)
   * Usa o clipboard do sistema + Ctrl+V (ou Cmd+V no macOS)
   */
  async pasteText(text: string): Promise<void> {
    await this.ensureInitialized();
    if (!text || text.trim() === '') {
      logger.warn('pasteText called with empty text');
      return;
    }

    try {
      // Colocar o texto no clipboard
      clipboard.writeText(text);
      
      // Verificar se o clipboard foi atualizado corretamente
      const clipboardText = clipboard.readText();
      if (clipboardText !== text) {
        logger.warn({ expected: text.substring(0, 50), got: clipboardText.substring(0, 50) }, 'Clipboard text mismatch, retrying...');
        clipboard.writeText(text);
      }
      
      // Simular Ctrl+V (ou Cmd+V no macOS)
      const modKey = process.platform === 'darwin' ? Key.LeftSuper : Key.LeftControl;
      const vKey = Key.V;

      // CRÍTICO: em muitas versões do nut-js, pressKey() mantém a tecla pressionada;
      // é necessário fazer press+release explicitamente.
      await keyboard.pressKey(modKey);
      await keyboard.pressKey(vKey);
      await keyboard.releaseKey(vKey);
      await keyboard.releaseKey(modKey);
      
      logger.info({ textLength: text.length }, 'Text pasted via clipboard + Ctrl+V');
    } catch (error) {
      logger.error({ err: error, textLength: text?.length }, 'Failed to paste text');
      throw error;
    }
  }

  async screenshot(region?: { x: number; y: number; width: number; height: number }): Promise<Buffer> {
    await this.ensureInitialized();
    try {
      let image: Image;
      if (region) {
        const screenRegion = new Region(region.x, region.y, region.width, region.height);
        image = await screen.grabRegion(screenRegion);
      } else {
        image = await screen.grab();
      }
      logger.debug({ hasRegion: !!region }, 'Screenshot captured');
      // Converter Image para Buffer PNG usando sharp
      const rawData = await image.toRGB();
      const buffer = await sharp(Buffer.from(rawData.data), {
        raw: {
          width: rawData.width,
          height: rawData.height,
          channels: 4
        }
      }).png().toBuffer();
      return buffer;
    } catch (error) {
      logger.error({ err: error, region }, 'Failed to capture screenshot');
      throw error;
    }
  }

  async findImage(templatePath: string, confidence: number = 0.8, timeout: number = 5000): Promise<Region | null> {
    await this.ensureInitialized();
    
    // Verificar se o arquivo existe
    const { existsSync } = await import('fs');
    if (!existsSync(templatePath)) {
      logger.error({ templatePath }, 'Template image file does not exist');
      throw new Error(`Template image file not found: ${templatePath}`);
    }
    
    // Usar busca alternativa com sharp
    if (this.imageFinderAvailable) {
      return await this.findImageWithSharp(templatePath, confidence, timeout);
    }
    
    // Fallback para nut.js (provavelmente vai falhar sem provider)
    let template: any = null;
    try {
      template = await loadImage(templatePath);
    } catch (error: any) {
      logger.error({ err: error, templatePath }, 'Failed to load template image');
      throw new Error(`Failed to load template image: ${error?.message || 'Unknown error'}`);
    }
    
    const startTime = Date.now();
    const checkInterval = 200;
    let attemptCount = 0;
    
    while (Date.now() - startTime < timeout) {
      attemptCount++;
      try {
        const region = await screen.find(template);
        logger.debug({ templatePath, confidence, found: true, attempts: attemptCount, elapsed: Date.now() - startTime }, 'Image found');
        return region;
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        
        if (errorMsg.includes('No ImageFinder registered')) {
          logger.warn({ templatePath }, 'ImageFinder provider not registered. Trying alternative method...');
          // Tentar método alternativo
          return await this.findImageWithSharp(templatePath, confidence, timeout - (Date.now() - startTime));
        }
        
        if (errorMsg.includes('No match') || errorMsg.includes('not found')) {
          const remaining = timeout - (Date.now() - startTime);
          if (remaining > 0) {
            await new Promise((resolve) => setTimeout(resolve, checkInterval));
            continue;
          }
          break;
        }
        
        logger.debug({ err: error, templatePath, attempt: attemptCount }, 'Error during image search, retrying...');
        await new Promise((resolve) => setTimeout(resolve, checkInterval));
      }
    }
    
    const elapsed = Date.now() - startTime;
    logger.warn({ templatePath, timeout, elapsed, attempts: attemptCount }, 'Image not found within timeout');
    return null;
  }

  /**
   * Busca de imagem alternativa usando sharp para comparação de pixels
   * Implementa template matching simples por comparação direta
   */
  private async findImageWithSharp(templatePath: string, confidence: number, timeout: number): Promise<Region | null> {
    const startTime = Date.now();
    const checkInterval = 500; // Verificar a cada 500ms (mais lento mas mais preciso)
    let attemptCount = 0;
    
    // Carregar template uma vez e fazer cópia profunda dos dados
    let templateRaw: Buffer | null = null;
    let templateWidth = 0;
    let templateHeight = 0;
    let templateChannels = 4;
    
    try {
      // Carregar template e fazer cópia imediata dos dados para evitar problemas com VIPS
      const templateImage = await loadImage(templatePath);
      const templateRgb = await templateImage.toRGB();
      templateWidth = templateRgb.width || 0;
      templateHeight = templateRgb.height || 0;
      templateChannels = templateRgb.channels || 4;
      
      // CRÍTICO: Fazer cópia profunda do Buffer imediatamente para evitar reutilização de objetos VIPS
      const originalData = templateRgb.data as Buffer;
      if (originalData && Buffer.isBuffer(originalData)) {
        templateRaw = Buffer.from(originalData);
      }
      
      // Limpar referências ao objeto VIPS (deixar GC limpar)
      // Não podemos atribuir null diretamente, mas podemos garantir que não reutilizamos
      
      if (!templateWidth || !templateHeight || !templateRaw?.length) {
        logger.error({ templatePath }, 'Invalid template image dimensions');
        return null;
      }
      
      logger.debug({ templatePath, templateWidth, templateHeight, confidence }, 'Starting image search with raw matcher');
      
      while (Date.now() - startTime < timeout) {
        attemptCount++;
        
        let screenshotImage: any = null;
        let screenshotRgb: any = null;
        
        try {
          // Capturar screenshot da tela
          screenshotImage = await screen.grab();
          screenshotRgb = await screenshotImage.toRGB();
          const screenWidth = screenshotRgb.width || 0;
          const screenHeight = screenshotRgb.height || 0;
          const screenChannels = screenshotRgb.channels || 4;
          const scaleX = screenshotRgb.pixelDensity?.scaleX || 1;
          const scaleY = screenshotRgb.pixelDensity?.scaleY || 1;
          
          if (!screenWidth || !screenHeight) {
            logger.warn('Invalid screenshot dimensions');
            await new Promise((resolve) => setTimeout(resolve, checkInterval));
            continue;
          }
          
          // CRÍTICO: Fazer cópia profunda do Buffer imediatamente
          const originalScreenshotData = screenshotRgb.data as Buffer;
          let screenshotRaw: Buffer | null = null;
          if (originalScreenshotData && Buffer.isBuffer(originalScreenshotData)) {
            screenshotRaw = Buffer.from(originalScreenshotData);
          }
          
          // Não reutilizar screenshotRgb/screenshotImage após copiar os dados
          
          if (!screenshotRaw) {
            await new Promise((resolve) => setTimeout(resolve, checkInterval));
            continue;
          }
          
          // Buscar template na imagem (simples comparação de pixels)
          const result = this.templateMatch(
            screenshotRaw,
            screenWidth,
            screenHeight,
            screenChannels,
            templateRaw!,
            templateWidth,
            templateHeight,
            templateChannels,
            confidence
          );
          
          // Limpar referência ao screenshotRaw após uso
          screenshotRaw = null;
          
          if (result) {
            const safeScaleX = scaleX > 0 ? scaleX : 1;
            const safeScaleY = scaleY > 0 ? scaleY : 1;
            const scaled = {
              x: Math.round(result.x / safeScaleX),
              y: Math.round(result.y / safeScaleY),
              width: Math.round(templateWidth / safeScaleX),
              height: Math.round(templateHeight / safeScaleY),
            };

            logger.info({
              templatePath,
              found: true,
              position: scaled,
              attempts: attemptCount,
              elapsed: Date.now() - startTime,
              scale: { x: safeScaleX, y: safeScaleY },
            }, 'Image found with matcher');

            return new Region(scaled.x, scaled.y, scaled.width, scaled.height);
          }
          
          const remaining = timeout - (Date.now() - startTime);
          if (remaining > checkInterval) {
            await new Promise((resolve) => setTimeout(resolve, checkInterval));
          } else {
            break;
          }
        } catch (error: any) {
          logger.debug({ err: error, attempt: attemptCount }, 'Error during sharp image search');
          await new Promise((resolve) => setTimeout(resolve, checkInterval));
        }
      }
      
      const elapsed = Date.now() - startTime;
      logger.warn({ templatePath, timeout, elapsed, attempts: attemptCount }, 'Image not found within timeout (sharp)');
      return null;
    } catch (error: any) {
      logger.error({ err: error, templatePath }, 'Failed to search image with sharp');
      return null;
    }
  }

  /**
   * Template matching simples por comparação de pixels
   * Retorna a posição do primeiro match encontrado ou null
   */
  private templateMatch(
    screenPixels: Buffer,
    screenWidth: number,
    screenHeight: number,
    screenChannels: number,
    templatePixels: Buffer,
    templateWidth: number,
    templateHeight: number,
    templateChannels: number,
    confidence: number
  ): { x: number; y: number } | null {
    const compareChannels = Math.min(3, screenChannels, templateChannels);
    if (compareChannels <= 0) {
      return null;
    }
    // Otimização: pular pixels para acelerar a busca
    const stepBase = Math.max(1, Math.floor(Math.min(templateWidth, templateHeight) / 12));
    const step = Math.min(8, stepBase);
    const stepX = step;
    const stepY = step;
    
    // Limitar área de busca
    const maxX = screenWidth - templateWidth;
    const maxY = screenHeight - templateHeight;
    
    if (maxX < 0 || maxY < 0) {
      return null; // Template maior que a tela
    }
    
    // Pixels a comparar para verificação rápida
    const sampleSize = Math.max(1, Math.min(100, Math.floor(templateWidth * templateHeight * 0.1)));
    const samplePoints: Array<{ tx: number; ty: number }> = [];
    
    // Gerar pontos de amostragem aleatórios mas determinísticos
    for (let i = 0; i < sampleSize; i++) {
      const tx = Math.floor((i * 7) % templateWidth);
      const ty = Math.floor((i * 11) % templateHeight);
      samplePoints.push({ tx, ty });
    }
    
    // Buscar
    const computeMatchRatio = (x: number, y: number) => {
      let matches = 0;
      const total = samplePoints.length;
      if (total === 0) return 0;
      
      for (const { tx, ty } of samplePoints) {
        const screenIdx = ((y + ty) * screenWidth + (x + tx)) * screenChannels;
        const templateIdx = (ty * templateWidth + tx) * templateChannels;
        
        let diff = 0;
        for (let c = 0; c < compareChannels; c++) {
          diff += Math.abs(screenPixels[screenIdx + c] - templatePixels[templateIdx + c]);
        }
        
        if (diff < 30) {
          matches++;
        }
      }
      
      return matches / total;
    };
    
    const refineMatch = (x: number, y: number) => {
      let bestX = x;
      let bestY = y;
      let bestRatio = computeMatchRatio(x, y);
      
      for (let dy = -stepY; dy <= stepY; dy++) {
        for (let dx = -stepX; dx <= stepX; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx > maxX || ny > maxY) continue;
          
          const nRatio = computeMatchRatio(nx, ny);
          if (nRatio > bestRatio) {
            bestRatio = nRatio;
            bestX = nx;
            bestY = ny;
          }
        }
      }
      
      return { x: bestX, y: bestY, ratio: bestRatio };
    };
    
    let bestCandidate: { x: number; y: number; ratio: number } | null = null;
    
    for (let y = 0; y <= maxY; y += stepY) {
      for (let x = 0; x <= maxX; x += stepX) {
        const matchRatio = computeMatchRatio(x, y);
        
        if (!bestCandidate || matchRatio > bestCandidate.ratio) {
          bestCandidate = { x, y, ratio: matchRatio };
        }
        
        if (matchRatio >= confidence) {
          const refined = refineMatch(x, y);
          if (refined.ratio >= confidence) {
            return { x: refined.x, y: refined.y };
          }
        }
      }
    }
    
    if (bestCandidate) {
      const refined = refineMatch(bestCandidate.x, bestCandidate.y);
      if (refined.ratio >= confidence) {
        return { x: refined.x, y: refined.y };
      }
    }
    
    return null;
  }

  async getScreenSize(): Promise<{ width: number; height: number }> {
    await this.ensureInitialized();
    try {
      const width = await screen.width();
      const height = await screen.height();
      return { width, height };
    } catch (error) {
      logger.error({ err: error }, 'Failed to get screen size');
      throw error;
    }
  }

  async wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getMousePosition(): Promise<{ x: number; y: number }> {
    await this.ensureInitialized();
    try {
      const position = await mouse.getPosition();
      return { x: position.x, y: position.y };
    } catch (error) {
      logger.error({ err: error }, 'Failed to get mouse position');
      throw error;
    }
  }

  private mapButton(button: MouseButton): Button {
    switch (button) {
      case 'left':
        return Button.LEFT;
      case 'right':
        return Button.RIGHT;
      case 'middle':
        return Button.MIDDLE;
      default:
        return Button.LEFT;
    }
  }

  private mapKey(key: string): Key {
    const keyMap: Record<string, Key> = {
      Enter: Key.Enter,
      Escape: Key.Escape,
      Tab: Key.Tab,
      Space: Key.Space,
      Backspace: Key.Backspace,
      Delete: Key.Delete,
      ArrowUp: Key.Up,
      ArrowDown: Key.Down,
      ArrowLeft: Key.Left,
      ArrowRight: Key.Right,
      Home: Key.Home,
      End: Key.End,
      PageUp: Key.PageUp,
      PageDown: Key.PageDown,
      F1: Key.F1,
      F2: Key.F2,
      F3: Key.F3,
      F4: Key.F4,
      F5: Key.F5,
      F6: Key.F6,
      F7: Key.F7,
      F8: Key.F8,
      F9: Key.F9,
      F10: Key.F10,
      F11: Key.F11,
      F12: Key.F12,
      Control: Key.LeftControl,
      Alt: Key.LeftAlt,
      Shift: Key.LeftShift,
      Meta: Key.LeftSuper,
      // Letras (sempre em minúsculo)
      a: Key.A, b: Key.B, c: Key.C, d: Key.D, e: Key.E, f: Key.F,
      g: Key.G, h: Key.H, i: Key.I, j: Key.J, k: Key.K, l: Key.L,
      m: Key.M, n: Key.N, o: Key.O, p: Key.P, q: Key.Q, r: Key.R,
      s: Key.S, t: Key.T, u: Key.U, v: Key.V, w: Key.W, x: Key.X,
      y: Key.Y, z: Key.Z,
      // Números
      '0': Key.Num0, '1': Key.Num1, '2': Key.Num2, '3': Key.Num3, '4': Key.Num4,
      '5': Key.Num5, '6': Key.Num6, '7': Key.Num7, '8': Key.Num8, '9': Key.Num9,
    };

    const raw = (key || '').trim();
    if (raw && keyMap[raw]) return keyMap[raw];

    const lower = raw.toLowerCase();
    if (lower && keyMap[lower]) return keyMap[lower];

    logger.warn({ key }, 'Unknown key, using as-is');
    return raw as any;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

let automationService: AutomationService | null = null;

export function getAutomationService(): AutomationService {
  if (!automationService) {
    automationService = new AutomationService();
  }
  return automationService;
}
