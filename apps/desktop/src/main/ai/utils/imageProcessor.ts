import sharp from 'sharp';
import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { getLogger } from '@neo/logger';
import { app } from 'electron';

const logger = getLogger();

// NOTA: sharp.cache(false) e sharp.concurrency(1) removidos
// pois causavam crash fatal com libvips em algumas versões

/**
 * Comprime imagem se necessário, mantendo aspect ratio
 * Retorna o caminho da imagem (original ou otimizada)
 * 
 * Se a compressão falhar, retorna a imagem original sem erro
 */
export async function compressImageIfNeeded(
  imagePath: string,
  maxDimension: number
): Promise<{ path: string; wasCompressed: boolean }> {
  // Variável para controlar se devemos tentar compressão
  // Pode ser desabilitada via env var se necessário
  const isElectron = Boolean(process.versions.electron);
  const compressionEnabled =
    process.env.DISABLE_IMAGE_COMPRESSION !== 'true' &&
    (!isElectron || process.env.RICKY_ENABLE_IMAGE_COMPRESSION === '1');
  
  if (!compressionEnabled) {
    logger.debug(
      { imagePath, isElectron },
      'Image compression disabled, using original'
    );
    return { path: imagePath, wasCompressed: false };
  }

  try {
    // Aguarda um pouco para garantir que o arquivo está totalmente escrito
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Verifica se o arquivo existe e é acessível
    if (!existsSync(imagePath)) {
      logger.warn({ imagePath }, 'Image file does not exist');
      return { path: imagePath, wasCompressed: false };
    }

    // Lê metadata sem criar instância persistente
    let metadata;
    try {
      metadata = await sharp(imagePath, { failOnError: false, sequentialRead: true }).metadata();
    } catch (sharpError: any) {
      logger.error({ err: sharpError, imagePath }, 'Failed to read image metadata with Sharp');
      // Se falhar, retorna o caminho original
      return { path: imagePath, wasCompressed: false };
    }

    if (!metadata.width || !metadata.height) {
      logger.warn({ imagePath }, 'Could not read image dimensions');
      return { path: imagePath, wasCompressed: false };
    }

    // Verifica se precisa comprimir
    const needsCompression =
      metadata.width > maxDimension || metadata.height > maxDimension;

    if (!needsCompression) {
      return { path: imagePath, wasCompressed: false };
    }

    // Calcula novas dimensões mantendo aspect ratio
    let newWidth = metadata.width;
    let newHeight = metadata.height;

    if (metadata.width > metadata.height) {
      // Largura é maior
      if (metadata.width > maxDimension) {
        newWidth = maxDimension;
        newHeight = Math.round((metadata.height * maxDimension) / metadata.width);
      }
    } else {
      // Altura é maior ou igual
      if (metadata.height > maxDimension) {
        newHeight = maxDimension;
        newWidth = Math.round((metadata.width * maxDimension) / metadata.height);
      }
    }

    logger.debug(
      {
        original: `${metadata.width}x${metadata.height}`,
        compressed: `${newWidth}x${newHeight}`,
      },
      'Compressing image'
    );

    // Cria diretório para imagens otimizadas
    const optimizedDir = join(app.getPath('userData'), 'screenshots', 'optimized');
    if (!existsSync(optimizedDir)) {
      await mkdir(optimizedDir, { recursive: true });
    }

    // Gera nome do arquivo otimizado
    const { extname, basename } = await import('path');
    const ext = extname(imagePath);
    const baseName = basename(imagePath, ext);
    const optimizedPath = join(optimizedDir, `${baseName}_optimized${ext}`);

    // Cria nova instância do Sharp para processar (não reusa a anterior)
    try {
      await sharp(imagePath, { failOnError: false, sequentialRead: true })
        .resize(newWidth, newHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .toFile(optimizedPath);

      logger.info({ original: imagePath, optimized: optimizedPath }, 'Image compressed');

      return { path: optimizedPath, wasCompressed: true };
    } catch (processError: any) {
      logger.error({ err: processError, imagePath }, 'Failed to process image with Sharp');
      // Em caso de erro no processamento, retorna o original
      return { path: imagePath, wasCompressed: false };
    }
  } catch (error: any) {
    logger.error({ err: error, imagePath }, 'Failed to compress image');
    // Em caso de erro, retorna o caminho original
    return { path: imagePath, wasCompressed: false };
  }
}
