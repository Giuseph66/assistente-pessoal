import { useEffect, useRef } from 'react';

interface ResizeHandleProps {
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
}

/**
 * Handles para redimensionar a janela overlay
 */
export function ResizeHandle({ onResizeStart, onResizeEnd }: ResizeHandleProps): JSX.Element {
  const handleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;

    let isResizing = false;
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;
    let devicePixelRatio = 1;

    const handlePointerDown = (e: PointerEvent) => {
      e.preventDefault();
      isResizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startWidth = window.innerWidth;
      startHeight = window.innerHeight;
      devicePixelRatio = window.devicePixelRatio || 1;
      handle.setPointerCapture(e.pointerId);
      onResizeStart?.();
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (isResizing && window.electron?.ipcRenderer) {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        const newWidth = Math.max(300, startWidth + deltaX);
        const newHeight = Math.max(200, startHeight + deltaY);

        window.electron.ipcRenderer.send('overlay:resize', {
          width: Math.round(newWidth * devicePixelRatio),
          height: Math.round(newHeight * devicePixelRatio),
        });
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!isResizing) return;
      isResizing = false;
      handle.releasePointerCapture(e.pointerId);
      onResizeEnd?.();
    };

    handle.addEventListener('pointerdown', handlePointerDown);
    handle.addEventListener('pointermove', handlePointerMove);
    handle.addEventListener('pointerup', handlePointerUp);
    handle.addEventListener('pointercancel', handlePointerUp);

    return () => {
      handle.removeEventListener('pointerdown', handlePointerDown);
      handle.removeEventListener('pointermove', handlePointerMove);
      handle.removeEventListener('pointerup', handlePointerUp);
      handle.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [onResizeStart, onResizeEnd]);

  return (
    <>
      {/* Handle no canto inferior direito */}
      <div
        ref={handleRef}
        className="resize-handle"
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: '20px',
          height: '20px',
          cursor: 'nwse-resize',
          background: 'transparent',
          touchAction: 'none',
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="rgba(255, 255, 255, 0.3)"
          style={{ position: 'absolute', bottom: 0, right: 0 }}
        >
          <path d="M 0 20 L 20 0 M 10 0 L 20 10 M 0 10 L 10 20" stroke="currentColor" strokeWidth="2" />
        </svg>
      </div>
    </>
  );
}
