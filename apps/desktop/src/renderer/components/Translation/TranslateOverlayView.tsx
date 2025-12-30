import { useEffect, useMemo, useRef, useState } from 'react';
import { TranslationBlock } from '@ricky/shared';

type Props = {
  imageUrl: string | null;
  imageSize: { width: number; height: number } | null;
  blocks: TranslationBlock[];
  debugBoxes: boolean;
  showTooltips: boolean;
  visible: boolean;
};

export function TranslateOverlayView({
  imageUrl,
  imageSize,
  blocks,
  debugBoxes,
  showTooltips,
  visible,
}: Props): JSX.Element | null {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<TranslationBlock | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  const canRender = Boolean(imageUrl && imageSize && visible);

  const scopedBlocks = useMemo(() => blocks, [blocks]);

  useEffect(() => {
    if (!canRender || !imageUrl || !imageSize) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = imageSize.width;
    canvas.height = imageSize.height;

    const image = new Image();
    image.src = imageUrl;
    image.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      scopedBlocks.forEach((block) => {
        drawBlock(ctx, block, debugBoxes);
      });
    };
  }, [canRender, imageUrl, imageSize, scopedBlocks, debugBoxes]);

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!showTooltips || !imageSize) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const scaleX = imageSize.width / rect.width;
    const scaleY = imageSize.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    const hit = scopedBlocks.find(
      (block) =>
        x >= block.bbox.x &&
        x <= block.bbox.x + block.bbox.w &&
        y >= block.bbox.y &&
        y <= block.bbox.y + block.bbox.h
    );

    if (hit) {
      setHovered(hit);
      setHoverPos({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    } else {
      setHovered(null);
      setHoverPos(null);
    }
  };

  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        pointerEvents: showTooltips ? 'auto' : 'none',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        setHovered(null);
        setHoverPos(null);
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />
      {showTooltips && hovered && hoverPos && (
        <div
          style={{
            position: 'absolute',
            left: hoverPos.x + 12,
            top: hoverPos.y + 12,
            maxWidth: 360,
            background: 'rgba(20, 20, 20, 0.9)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff',
            padding: '8px 10px',
            borderRadius: 6,
            fontSize: 12,
            pointerEvents: 'none',
            whiteSpace: 'pre-wrap',
          }}
        >
          <div style={{ fontSize: 11, color: '#9aa0a6', marginBottom: 4 }}>Original</div>
          <div style={{ marginBottom: 6 }}>{hovered.original}</div>
          <div style={{ fontSize: 11, color: '#9aa0a6', marginBottom: 4 }}>Traduzido</div>
          <div>{hovered.translated}</div>
        </div>
      )}
    </div>
  );
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  block: TranslationBlock,
  debug: boolean
): void {
  const padding = 4;
  const { x, y, w, h } = block.bbox;
  const text = block.translated || block.original;

  ctx.save();
  ctx.fillStyle = 'rgba(10, 10, 10, 0.72)';
  ctx.fillRect(x, y, w, h);

  if (debug) {
    ctx.strokeStyle = 'rgba(0, 173, 255, 0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
  }

  const fontSize = fitFontSize(ctx, text, w - padding * 2, h - padding * 2);
  ctx.font = `${fontSize}px sans-serif`;
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'top';

  const lines = wrapText(ctx, text, w - padding * 2);
  const lineHeight = fontSize + 2;
  let offsetY = y + padding;
  lines.forEach((line) => {
    if (offsetY + lineHeight > y + h) return;
    ctx.fillText(line, x + padding, offsetY);
    offsetY += lineHeight;
  });

  ctx.restore();
}

function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxHeight: number
): number {
  let size = Math.max(10, Math.min(maxHeight, 32));
  while (size > 10) {
    ctx.font = `${size}px sans-serif`;
    const lines = wrapText(ctx, text, maxWidth);
    const height = lines.length * (size + 2);
    const width = Math.max(...lines.map((line) => ctx.measureText(line).width));
    if (height <= maxHeight && width <= maxWidth) {
      return size;
    }
    size -= 1;
  }
  return 10;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  words.forEach((word) => {
    const test = current ? `${current} ${word}` : word;
    const width = ctx.measureText(test).width;
    if (width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  });
  if (current) lines.push(current);
  return lines.length ? lines : [text];
}
