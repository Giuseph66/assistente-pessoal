import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import './ScreenshotSelector.css';

type Rect = { x: number; y: number; w: number; h: number };

type SelectorPayload = {
  token: string;
  displayBounds: { x: number; y: number; width: number; height: number };
  lastRegion?: { x: number; y: number; width: number; height: number; monitorIndex?: number; displayId?: number };
  displayId: number;
  monitorIndex: number;
  longCaptureSupported?: boolean;
  longCaptureReason?: string;
  mode?: 'initial' | 'long';
  sessionId?: string;
  lockSelection?: boolean;
};

type SelectorAction = 'single' | 'long' | 'finish' | 'cancel';

export function ScreenshotSelector(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [payload, setPayload] = useState<SelectorPayload | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [dragging, setDragging] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    const handleData = (_event: any, data: SelectorPayload) => {
      setPayload(data);
      if (data.lastRegion) {
        const bounds = data.displayBounds;
        const intersects = data.lastRegion.x < bounds.x + bounds.width
          && data.lastRegion.x + data.lastRegion.width > bounds.x
          && data.lastRegion.y < bounds.y + bounds.height
          && data.lastRegion.y + data.lastRegion.height > bounds.y;

        if (intersects) {
          setRect({
            x: Math.max(0, data.lastRegion.x - bounds.x),
            y: Math.max(0, data.lastRegion.y - bounds.y),
            w: data.lastRegion.width,
            h: data.lastRegion.height,
          });
        } else {
          setRect(null);
        }
      } else {
        setRect(null);
      }
    };

    window.electron.ipcRenderer.on('screenshot-selector:data', handleData);
    return () => {
      window.electron.ipcRenderer.removeListener('screenshot-selector:data', handleData);
    };
  }, []);

  useEffect(() => {
    if (!payload) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        sendAction('cancel');
      }
      if (event.key === 'Enter') {
        if (payload?.mode === 'long') {
          sendAction('finish');
        } else {
          sendAction('single');
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [payload, rect]);

  const toGlobalRegion = (selection: Rect, bounds: SelectorPayload['displayBounds']) => {
    return {
      x: Math.floor(bounds.x + selection.x),
      y: Math.floor(bounds.y + selection.y),
      width: Math.ceil(selection.w),
      height: Math.ceil(selection.h),
    };
  };

  const sendAction = (action: SelectorAction) => {
    if (!payload) return;
    if (action === 'single' || action === 'long') {
      if (!rect || rect.w < 8 || rect.h < 8) return;
      setIsCapturing(true);
      const region = toGlobalRegion(rect, payload.displayBounds);
      try {
        localStorage.setItem('screenshot.lastRegion', JSON.stringify({
          ...region,
          monitorIndex: payload.monitorIndex,
          displayId: payload.displayId,
          savedAt: Date.now(),
        }));
      } catch {
        // ignore
      }
      setTimeout(() => {
        window.electron.ipcRenderer.send('screenshot-selector:result', {
          token: payload.token,
          action,
          region,
          monitorIndex: payload.monitorIndex,
          displayId: payload.displayId,
        });
      }, 90);
      return;
    }
    if (action === 'finish') {
      if (!rect || rect.w < 8 || rect.h < 8) return;
      const region = toGlobalRegion(rect, payload.displayBounds);
      window.electron.ipcRenderer.send('screenshot-selector:result', {
        token: payload.token,
        action,
        region,
        monitorIndex: payload.monitorIndex,
        displayId: payload.displayId,
      });
      return;
    }
    window.electron.ipcRenderer.send('screenshot-selector:result', {
      token: payload.token,
      action,
    });
  };

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (payload?.lockSelection) return;
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
    if (payload?.lockSelection) return;
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
    if (payload?.lockSelection) return;
    if (!dragging || !rect) {
      setDragging(false);
      return;
    }
    setDragging(false);
    if (rect.w < 8 || rect.h < 8) {
      setRect(null);
    }
  };

  const hasSelection = Boolean(rect && rect.w >= 8 && rect.h >= 8);
  const longSupported = payload?.longCaptureSupported !== false;
  const longDisabledReason = longSupported ? '' : payload?.longCaptureReason || 'Captura longa indisponivel';
  const isLongMode = payload?.mode === 'long';

  return (
    <div
      ref={containerRef}
      className={`screenshot-selector${isCapturing ? ' screenshot-selector--capturing' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/*
      <div className="screenshot-selector__hint">
        {isLongMode
          ? 'Longa continua. Concluir finaliza. Esc cancela.'
          : 'Arraste para selecionar. Enter captura. Esc cancela. Longa faz scroll.'}
        {!longSupported && (
          <span className="screenshot-selector__hint-warning">
            {longDisabledReason}
          </span>
        )}
      </div>
            */}

      {rect && (
        <div
          className="screenshot-selector__rect"
          style={{
            left: rect.x,
            top: rect.y,
            width: rect.w,
            height: rect.h,
          }}
        >
          <div className="screenshot-selector__rect-label">
            {Math.round(rect.w)} × {Math.round(rect.h)}
          </div>
        </div>
      )}

      <div className="screenshot-selector__actions" onMouseDown={(event) => event.stopPropagation()}>
        <button className="screenshot-selector__btn ghost" onClick={() => sendAction('cancel')}>
          Cancelar
        </button>
        <button
          className="screenshot-selector__btn icon"
          onClick={() => sendAction('long')}
          disabled={!hasSelection || !longSupported}
          title={longSupported ? 'Captura longa' : longDisabledReason}
        >
          Longa
        </button>
        <button
          className="screenshot-selector__btn primary"
          onClick={() => sendAction(isLongMode ? 'finish' : 'single')}
          disabled={!hasSelection}
        >
          {isLongMode ? 'Concluir' : 'Capturar area'}
        </button>
      </div>
    </div>
  );
}
