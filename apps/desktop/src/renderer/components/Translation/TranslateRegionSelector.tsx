import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { TranslationRegion } from '@neo/shared';

type Props = {
  active: boolean;
  onCancel: () => void;
  onSelect: (region: TranslationRegion) => void;
};

type Rect = { x: number; y: number; w: number; h: number };

export function TranslateRegionSelector({ active, onCancel, onSelect }: Props): JSX.Element | null {
  const containerRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!active) {
      startRef.current = null;
      setRect(null);
      setDragging(false);
    }
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [active, onCancel]);

  if (!active) return null;

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    startRef.current = { x, y };
    setRect({ x, y, w: 0, h: 0 });
    setDragging(true);
  };

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (!dragging || !startRef.current) return;
    const container = containerRef.current;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    const currentX = event.clientX - bounds.left;
    const currentY = event.clientY - bounds.top;
    const start = startRef.current;
    const x = Math.min(start.x, currentX);
    const y = Math.min(start.y, currentY);
    const w = Math.abs(currentX - start.x);
    const h = Math.abs(currentY - start.y);
    setRect({ x, y, w, h });
  };

  const handleMouseUp = () => {
    if (!dragging || !rect) {
      setDragging(false);
      return;
    }
    setDragging(false);

    if (rect.w < 20 || rect.h < 20) {
      setRect(null);
      return;
    }

    const scale = window.devicePixelRatio || 1;
    const region: TranslationRegion = {
      x: Math.round(rect.x * scale),
      y: Math.round(rect.y * scale),
      width: Math.round(rect.w * scale),
      height: Math.round(rect.h * scale),
    };

    onSelect(region);
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3000,
        cursor: 'crosshair',
        background: 'rgba(0, 0, 0, 0.25)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          background: 'rgba(16, 16, 16, 0.9)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#fff',
          padding: '8px 10px',
          borderRadius: 6,
          fontSize: 12,
        }}
      >
        Arraste para selecionar a area. ESC cancela.
      </div>
      {rect && (
        <div
          style={{
            position: 'absolute',
            left: rect.x,
            top: rect.y,
            width: rect.w,
            height: rect.h,
            border: '2px solid #00bfff',
            background: 'rgba(0, 191, 255, 0.15)',
            boxSizing: 'border-box',
          }}
        />
      )}
    </div>
  );
}
