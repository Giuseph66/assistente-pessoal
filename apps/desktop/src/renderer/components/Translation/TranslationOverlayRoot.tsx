import { useEffect, useState } from 'react';
import { TranslationResult, TranslationStartOptions, TranslationStatus } from '@neo/shared';

export function TranslationOverlayRoot(): JSX.Element {
  const [status, setStatus] = useState<TranslationStatus>({ stage: 'idle' });
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [pendingOptions, setPendingOptions] = useState<TranslationStartOptions | null>(null);
  const [hiddenBlocks, setHiddenBlocks] = useState<Set<number>>(new Set());

  useEffect(() => {
    const offStatus = window.translation.onStatus((payload) => {
      setStatus(payload);
    });
    window.translation.getOptions?.().then((options) => {
      if (options) {
        setPendingOptions(options);
      }
    });
    const offResult = window.translation.onResult(async (payload) => {
      setResult(payload);
      setHiddenBlocks(new Set());
    });
    const offOptions = window.translation.onOptions((payload) => {
      setPendingOptions(payload);
    });
    const offError = window.translation.onError(() => {
      // ignore
    });

    return () => {
      offStatus();
      offResult();
      offOptions();
      offError();
    };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
      {(result?.blocks || []).map((block, index) => {
        if (hiddenBlocks.has(index)) return null;
        const bbox = block.screenBbox || block.bbox;
        const fontSize = Math.max(10, Math.min(28, Math.floor((bbox.h || 16) * 0.6)));
        return (
          <div
            key={index}
            role="button"
            onClick={() => {
              setHiddenBlocks((prev) => {
                const next = new Set(prev);
                next.add(index);
                return next;
              });
            }}
            style={{
              position: 'absolute',
              left: bbox.x,
              top: bbox.y,
              width: bbox.w,
              minHeight: bbox.h,
              padding: 2,
              background: 'rgba(12, 12, 12, 0.78)',
              color: '#f5f5f5',
              border: pendingOptions?.debugBoxes ? '1px solid rgba(0, 173, 255, 0.7)' : 'none',
              boxSizing: 'border-box',
              fontSize,
              lineHeight: 1.2,
              whiteSpace: 'pre-wrap',
              pointerEvents: 'auto',
              cursor: 'pointer',
            }}
            title="Clique para ocultar"
          >
            {block.translated}
          </div>
        );
      })}
    </div>
  );
}
