import { useEffect, useMemo, useRef, useState } from 'react';
import './ScreenshotPreview.css';

type PreviewItem = {
  id: string;
  filePath?: string;
  fileUrl?: string;
  createdAt: number;
  updatedAt?: number;
  sessionId?: string;
  source?: 'long' | 'single';
};

type PreviewPayload = {
  item?: PreviewItem;
  fileUrl?: string;
  filePath?: string;
  sessionId?: string;
  createdAt?: number;
  source?: 'long' | 'single';
};

const MAX_ITEMS = 8;

export function ScreenshotPreview(): JSX.Element {
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [imageMap, setImageMap] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState(false);
  const pendingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleData = (_event: any, payload: PreviewPayload) => {
      if (!payload) return;
      const baseItem = payload.item ?? {
        id: payload.sessionId || `preview-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
        sessionId: payload.sessionId,
        filePath: payload.filePath,
        fileUrl: payload.fileUrl,
        createdAt: payload.createdAt ?? Date.now(),
        source: payload.source ?? 'single',
      };

      if (!baseItem.filePath && !baseItem.fileUrl) return;

      setItems((prev) => {
        const next = [...prev];
        const existingIndex = next.findIndex((item) =>
          item.id === baseItem.id || (baseItem.sessionId && item.sessionId === baseItem.sessionId)
        );
        const now = baseItem.createdAt ?? Date.now();
        if (existingIndex >= 0) {
          const existing = next[existingIndex];
          if (
            existing.filePath !== baseItem.filePath ||
            existing.fileUrl !== baseItem.fileUrl
          ) {
            pendingRef.current.delete(existing.id);
            setImageMap((prevMap) => {
              if (!prevMap[existing.id]) return prevMap;
              const nextMap = { ...prevMap };
              delete nextMap[existing.id];
              return nextMap;
            });
          }
          const updated: PreviewItem = {
            ...next[existingIndex],
            ...baseItem,
            updatedAt: now,
          };
          next.splice(existingIndex, 1);
          next.unshift(updated);
        } else {
          next.unshift({ ...baseItem, updatedAt: now });
        }
        return next.slice(0, MAX_ITEMS);
      });

      setActiveId(baseItem.id);
    };

    window.electron.ipcRenderer.on('screenshot-preview:data', handleData);
    return () => {
      window.electron.ipcRenderer.removeListener('screenshot-preview:data', handleData);
    };
  }, []);

  useEffect(() => {
    items.forEach((item) => {
      if (!item.filePath && !item.fileUrl) return;
      if (imageMap[item.id] || pendingRef.current.has(item.id)) return;

      pendingRef.current.add(item.id);
      if (!item.filePath && item.fileUrl) {
        setImageMap((prev) => ({ ...prev, [item.id]: item.fileUrl as string }));
        pendingRef.current.delete(item.id);
        return;
      }

      window.electron.ipcRenderer
        .invoke('screenshot:read', { filePath: item.filePath })
        .then((result: { base64: string | null; mimeType: string | null; error?: string }) => {
          if (!result?.base64 || !result?.mimeType) {
            if (item.fileUrl) {
              setImageMap((prev) => ({ ...prev, [item.id]: item.fileUrl as string }));
            }
            return;
          }
          setImageMap((prev) => ({
            ...prev,
            [item.id]: `data:${result.mimeType};base64,${result.base64}`,
          }));
        })
        .catch(() => {
          if (item.fileUrl) {
            setImageMap((prev) => ({ ...prev, [item.id]: item.fileUrl as string }));
          }
        })
        .finally(() => {
          pendingRef.current.delete(item.id);
        });
    });
  }, [items, imageMap]);

  const activeItem = useMemo(() => {
    if (!items.length) return null;
    return items.find((item) => item.id === activeId) || items[0];
  }, [activeId, items]);

  const activeImage = activeItem ? imageMap[activeItem.id] : null;
  const headerLabel = activeItem?.source === 'long' ? 'Longa' : 'Preview';

  const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const handleToggleExpand = () => {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);
    window.electron.ipcRenderer.send('screenshot-preview:resize', { expanded: nextExpanded });
  };

  const handleOpen = (item?: PreviewItem | null) => {
    if (!item?.filePath) return;
    window.electron.ipcRenderer.invoke('screenshot:open', { filePath: item.filePath });
  };

  return (
    <div className={`screenshot-preview ${expanded ? 'is-expanded' : ''}`}>
      <div className="screenshot-preview__header">
        <div className="screenshot-preview__title">
          <span className="screenshot-preview__badge">{headerLabel}</span>
          <span className="screenshot-preview__count">
            {items.length > 0
              ? `${items.length} ${items.length === 1 ? 'captura' : 'capturas'}`
              : 'Sem capturas'}
          </span>
        </div>
        <div className="screenshot-preview__actions">
          <button
            className="screenshot-preview__action"
            onClick={handleToggleExpand}
            aria-label={expanded ? 'Reduzir' : 'Expandir'}
          >
            {expanded ? 'Reduzir' : 'Expandir'}
          </button>
          <button
            className="screenshot-preview__action"
            onClick={() => window.close()}
            aria-label="Fechar"
          >
            Fechar
          </button>
        </div>
      </div>

      <div
        className="screenshot-preview__stage"
        onClick={() => handleOpen(activeItem)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleOpen(activeItem);
          }
        }}
        role="button"
        tabIndex={0}
      >
        {activeImage ? (
          <img className="screenshot-preview__image" src={activeImage} alt="Screenshot" />
        ) : (
          <div className="screenshot-preview__placeholder">
            {items.length > 0 ? 'Carregando imagem...' : 'Nenhuma captura ainda'}
          </div>
        )}
        {activeItem && (
          <>
            <div className="screenshot-preview__meta">
              <span className="screenshot-preview__meta-pill">
                {activeItem.source === 'long' ? 'Longa' : 'Captura'}
              </span>
              <span className="screenshot-preview__meta-time">
                {formatTime(activeItem.updatedAt ?? activeItem.createdAt)}
              </span>
            </div>
            <div className="screenshot-preview__stage-actions">
              <button
                className="screenshot-preview__action screenshot-preview__action--ghost"
                onClick={(event) => {
                  event.stopPropagation();
                  handleOpen(activeItem);
                }}
              >
                Abrir
              </button>
            </div>
          </>
        )}
      </div>

      <div className="screenshot-preview__strip">
        {items.map((item) => {
          const thumbSrc = imageMap[item.id];
          const isActive = activeItem?.id === item.id;
          return (
            <button
              key={item.id}
              className={`screenshot-preview__thumb ${isActive ? 'is-active' : ''}`}
              onClick={() => setActiveId(item.id)}
              title="Clique para visualizar"
            >
              {thumbSrc ? (
                <img className="screenshot-preview__thumb-image" src={thumbSrc} alt="Miniatura" />
              ) : (
                <span className="screenshot-preview__thumb-placeholder">...</span>
              )}
              <span className="screenshot-preview__thumb-time">
                {formatTime(item.updatedAt ?? item.createdAt)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
