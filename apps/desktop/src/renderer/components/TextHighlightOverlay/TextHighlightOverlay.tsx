import { useEffect, useRef, useState } from 'react';
import type { TextHighlightBox } from '@ricky/shared';
import './TextHighlightOverlay.css';

type TextHighlightPayload = {
  boxes: TextHighlightBox[];
  ttlMs?: number;
};

const DEFAULT_TTL_MS = 2000;

export function TextHighlightOverlay(): JSX.Element {
  const [boxes, setBoxes] = useState<TextHighlightBox[]>([]);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const clearTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const clearBoxes = () => {
    setBoxes([]);
    setVisible(false);
    if (clearTimerRef.current) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
  };

  useEffect(() => {
    const handleBoxes = (payload: TextHighlightPayload) => {
      const nextBoxes = Array.isArray(payload?.boxes) ? payload.boxes : [];
      const ttlMs = typeof payload?.ttlMs === 'number' ? payload.ttlMs : DEFAULT_TTL_MS;

      if (clearTimerRef.current) {
        window.clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }

      setBoxes(nextBoxes);

      if (ttlMs > 0) {
        clearTimerRef.current = window.setTimeout(() => {
          clearBoxes();
        }, ttlMs);
      }
    };

    const offBoxes = window.textHighlightAPI?.onBoxes(handleBoxes);
    const offClear = window.textHighlightAPI?.onClear(() => {
      clearBoxes();
    });
    const offLoading = window.textHighlightAPI?.onLoading((payload) => {
      setLoading(Boolean(payload?.loading));
    });

    return () => {
      offBoxes?.();
      offClear?.();
      offLoading?.();
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (clearTimerRef.current) {
        window.clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!boxes.length) return;
    setVisible(false);
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = window.requestAnimationFrame(() => {
      setVisible(true);
    });
  }, [boxes]);

  return (
    <div className="text-highlight-overlay">
      {loading ? <div className="text-highlight-loading" aria-label="Carregando" /> : null}
      {boxes.map((box, index) => (
        <div
          key={`${index}-${box.x}-${box.y}-${box.w}-${box.h}`}
          className={`text-highlight-box${visible ? ' is-visible' : ''}`}
          style={{
            left: box.x,
            top: box.y,
            width: box.w,
            height: box.h,
          }}
        />
      ))}
    </div>
  );
}
