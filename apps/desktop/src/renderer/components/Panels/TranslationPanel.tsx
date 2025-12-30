import { useEffect, useRef, useState } from 'react';
import { TranslationResult, TranslationStatus } from '@ricky/shared';
import { TranslateOverlayView } from '../Translation/TranslateOverlayView';

const LANG_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'en', label: 'Inglês' },
  { value: 'es', label: 'Espanhol' },
  { value: 'pt', label: 'Português' },
];

export function TranslationPanel(): JSX.Element {
  const [fromLang, setFromLang] = useState('auto');
  const [toLang, setToLang] = useState('pt');
  const [liveMode, setLiveMode] = useState(false);
  const [liveInterval, setLiveInterval] = useState(4);
  const [debugBoxes, setDebugBoxes] = useState(false);
  const [showTooltips, setShowTooltips] = useState(false);
  const [status, setStatus] = useState<TranslationStatus>({ stage: 'idle' });
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const imageUrlRef = useRef<string | null>(null);

  useEffect(() => {
    imageUrlRef.current = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    return () => {
      if (imageUrlRef.current) {
        URL.revokeObjectURL(imageUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const offStatus = window.translation.onStatus((payload) => {
      setStatus(payload);
      if (payload.message) {
        setLogs((prev) => [`${new Date().toLocaleTimeString()} ${payload.message}`, ...prev].slice(0, 8));
      }
    });
    const offResult = window.translation.onResult(async (payload) => {
      setResult(payload);
      setOverlayVisible(true);
      setError(null);
      setImageSize({ width: payload.width, height: payload.height });
      try {
        const read = await window.electron?.ipcRenderer.invoke('screenshot:read', {
          filePath: payload.screenshotPath,
        });
        if (read?.buffer) {
          const blob = new Blob([read.buffer], { type: read.mimeType || 'image/png' });
          const url = URL.createObjectURL(blob);
          setImageUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return url;
          });
        }
      } catch (err: any) {
        setError(err?.message || 'Falha ao carregar imagem');
      }
    });
    const offError = window.translation.onError((payload) => {
      setError(payload.message);
      setOverlayVisible(false);
    });
    return () => {
      offStatus();
      offResult();
      offError();
    };
  }, []);

  const handleStart = async () => {
    setError(null);
    await window.translation.start({
      fromLang,
      toLang,
      liveMode,
      liveIntervalMs: Math.max(1000, liveInterval * 1000),
      debugBoxes,
      showTooltips,
      minConfidence: 35,
      minTextLength: 2,
    });
  };

  const handleStop = async () => {
    await window.translation.stop();
    setOverlayVisible(false);
  };

  const handleRefresh = async () => {
    await window.translation.refresh();
  };

  const handleExport = async (format: 'txt' | 'json') => {
    if (!result?.blocks?.length) return;
    const content =
      format === 'json'
        ? JSON.stringify(result.blocks, null, 2)
        : result.blocks.map((block) => block.translated).join('\n');
    try {
      const response = await window.electron?.ipcRenderer.invoke('translation.export', {
        format,
        content,
      });
      if (response?.path) {
        setLogs((prev) => [`Exportado: ${response.path}`, ...prev].slice(0, 8));
      }
    } catch (err: any) {
      setError(err?.message || 'Falha ao exportar');
    }
  };

  return (
    <div className="translation-panel" style={{ position: 'relative' }}>
      <div className="panel-header">
        <h3>Tradução</h3>
      </div>

      <TranslateOverlayView
        imageUrl={imageUrl}
        imageSize={imageSize}
        blocks={result?.blocks || []}
        debugBoxes={debugBoxes}
        showTooltips={showTooltips}
        visible={overlayVisible}
      />

      <div className="translation-content" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={handleStart}
            style={{
              padding: '8px 12px',
              background: '#1b5e20',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Iniciar Tradução
          </button>
          <button
            onClick={handleStop}
            style={{
              padding: '8px 12px',
              background: '#8e2424',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Parar / Sair do Overlay
          </button>
          <button
            onClick={handleRefresh}
            style={{
              padding: '8px 12px',
              background: '#2d2d2d',
              color: '#fff',
              border: '1px solid #444',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Atualizar
          </button>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Idioma origem
            <select value={fromLang} onChange={(e) => setFromLang(e.target.value)}>
              {LANG_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Idioma destino
            <select value={toLang} onChange={(e) => setToLang(e.target.value)}>
              {LANG_OPTIONS.filter((opt) => opt.value !== 'auto').map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={liveMode}
              onChange={(e) => setLiveMode(e.target.checked)}
            />
            Modo ao vivo
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Intervalo (s)
            <input
              type="number"
              min={2}
              max={15}
              value={liveInterval}
              onChange={(e) => setLiveInterval(Number(e.target.value) || 4)}
              style={{ width: 70 }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={debugBoxes}
              onChange={(e) => setDebugBoxes(e.target.checked)}
            />
            Mostrar caixas
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={showTooltips}
              onChange={(e) => setShowTooltips(e.target.checked)}
            />
            Tooltip original/traduzido
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => handleExport('txt')}
            style={{
              padding: '6px 10px',
              background: '#2d2d2d',
              color: '#fff',
              border: '1px solid #444',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Exportar TXT
          </button>
          <button
            onClick={() => handleExport('json')}
            style={{
              padding: '6px 10px',
              background: '#2d2d2d',
              color: '#fff',
              border: '1px solid #444',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Exportar JSON
          </button>
          <button
            onClick={() => setOverlayVisible((prev) => !prev)}
            style={{
              padding: '6px 10px',
              background: '#2d2d2d',
              color: '#fff',
              border: '1px solid #444',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            {overlayVisible ? 'Ocultar overlay' : 'Mostrar overlay'}
          </button>
        </div>

        <div style={{ padding: 10, background: '#1e1e1e', borderRadius: 6, border: '1px solid #333' }}>
          <div style={{ fontSize: 12, color: '#9aa0a6', marginBottom: 6 }}>Status</div>
          <div style={{ fontSize: 14 }}>
            {status.stage.toUpperCase()} {status.message ? `• ${status.message}` : ''}
          </div>
          {status.blocks !== undefined && (
            <div style={{ fontSize: 12, color: '#cfcfcf' }}>Blocos: {status.blocks}</div>
          )}
        </div>

        {error && (
          <div style={{ padding: 10, background: '#5b1a1a', borderRadius: 6 }}>
            {error}
          </div>
        )}

        <div style={{ padding: 10, background: '#121212', borderRadius: 6, border: '1px solid #2b2b2b' }}>
          <div style={{ fontSize: 12, color: '#9aa0a6', marginBottom: 6 }}>Logs</div>
          {logs.length === 0 ? (
            <div style={{ fontSize: 12, color: '#666' }}>Sem logs ainda</div>
          ) : (
            logs.map((entry, index) => (
              <div key={index} style={{ fontSize: 12, color: '#d6d6d6' }}>
                {entry}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
