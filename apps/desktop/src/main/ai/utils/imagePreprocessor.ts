import { nativeImage } from 'electron';
import { extname } from 'path';
import { readFile } from 'fs/promises';
import { getLogger } from '@neo/logger';

const logger = getLogger();

export type ImagePreprocessOptions = {
  enableOptimization: boolean;
  maxDimension: number;
  maxBytes: number;
  quality: number;
};

export type PreprocessedImage = {
  base64Raw: string;
  base64DataUrl: string;
  mimeType: string;
  width?: number;
  height?: number;
  bytes: number;
  originalBytes: number;
  originalWidth?: number;
  originalHeight?: number;
  optimized: boolean;
  sourcePath: string;
};

const normalizeMimeType = (path: string): string => {
  const ext = extname(path).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'image/png';
};

const shouldOptimize = (
  opts: ImagePreprocessOptions,
  bytes: number,
  width?: number,
  height?: number
): boolean => {
  if (!opts.enableOptimization) return false;
  if (opts.maxBytes > 0 && bytes > opts.maxBytes) return true;
  if (opts.maxDimension > 0 && width && height) {
    return width > opts.maxDimension || height > opts.maxDimension;
  }
  return false;
};

const resizeDimensions = (
  width: number,
  height: number,
  maxDimension: number
): { width: number; height: number } => {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }
  if (width >= height) {
    return {
      width: maxDimension,
      height: Math.max(1, Math.round((height * maxDimension) / width)),
    };
  }
  return {
    width: Math.max(1, Math.round((width * maxDimension) / height)),
    height: maxDimension,
  };
};

const toBase64 = (buffer: Buffer, mimeType: string) => {
  const base64Raw = buffer.toString('base64');
  const base64DataUrl = `data:${mimeType};base64,${base64Raw}`;
  return { base64Raw, base64DataUrl };
};

export async function preprocessImage(
  imagePath: string,
  options: ImagePreprocessOptions
): Promise<PreprocessedImage> {
  const mimeType = normalizeMimeType(imagePath);
  const originalBuffer = await readFile(imagePath);
  const originalBytes = originalBuffer.length;
  const originalImage = nativeImage.createFromBuffer(originalBuffer);
  if (originalImage.isEmpty()) {
    const base64 = toBase64(originalBuffer, mimeType);
    return {
      base64Raw: base64.base64Raw,
      base64DataUrl: base64.base64DataUrl,
      mimeType,
      bytes: originalBytes,
      originalBytes,
      optimized: false,
      sourcePath: imagePath,
    };
  }
  const originalSize = originalImage.getSize();

  const originalWidth = originalSize.width || undefined;
  const originalHeight = originalSize.height || undefined;

  let outputBuffer = originalBuffer;
  let outputMime = mimeType;
  let outputWidth = originalWidth;
  let outputHeight = originalHeight;
  let optimized = false;

  if (shouldOptimize(options, originalBytes, originalWidth, originalHeight)) {
    try {
      const resizeTarget =
        originalWidth && originalHeight
          ? resizeDimensions(originalWidth, originalHeight, options.maxDimension)
          : null;

      let resized = originalImage;
      if (resizeTarget) {
        resized = originalImage.resize({
          width: resizeTarget.width,
          height: resizeTarget.height,
          quality: 'good',
        });
        outputWidth = resizeTarget.width;
        outputHeight = resizeTarget.height;
      }

      const quality = Math.min(100, Math.max(40, options.quality));

      if (mimeType === 'image/jpeg') {
        outputBuffer = resized.toJPEG(quality);
        outputMime = 'image/jpeg';
      } else if (mimeType === 'image/webp') {
        outputBuffer = resized.toPNG();
        outputMime = 'image/png';
      } else {
        if (options.maxBytes > 0 && originalBytes > options.maxBytes) {
          outputBuffer = resized.toJPEG(quality);
          outputMime = 'image/jpeg';
        } else {
          outputBuffer = resized.toPNG();
          outputMime = 'image/png';
        }
      }

      optimized = outputBuffer.length !== originalBytes || outputMime !== mimeType;
    } catch (error) {
      logger.warn({ err: error, imagePath }, 'Failed to optimize image, using original');
      outputBuffer = originalBuffer;
      outputMime = mimeType;
      outputWidth = originalWidth;
      outputHeight = originalHeight;
      optimized = false;
    }
  }

  const base64 = toBase64(outputBuffer, outputMime);

  return {
    base64Raw: base64.base64Raw,
    base64DataUrl: base64.base64DataUrl,
    mimeType: outputMime,
    width: outputWidth,
    height: outputHeight,
    bytes: outputBuffer.length,
    originalBytes,
    originalWidth,
    originalHeight,
    optimized,
    sourcePath: imagePath,
  };
}
