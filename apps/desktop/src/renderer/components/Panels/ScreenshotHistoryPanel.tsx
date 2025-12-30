import { useState, useEffect, useRef } from 'react';
import { Screenshot } from '@ricky/shared';

export function ScreenshotHistoryPanel(): JSX.Element {
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [selectedScreenshot, setSelectedScreenshot] = useState<Screenshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const messageIdRef = useRef(0);

  // Conectar ao WebSocket gateway
  useEffect(() => {
    const ws = new WebSocket('ws://127.0.0.1:8788');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to gateway (history)');
      loadScreenshots();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle screenshot.captured event to refresh list
        if (data.type === 'screenshot.captured') {
          loadScreenshots();
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('Disconnected from gateway (history)');
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const sendMessage = (type: string, payload?: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const id = `msg-${++messageIdRef.current}`;
      const message = JSON.stringify({ id, type, payload });

      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 10000);

      const handler = (event: MessageEvent) => {
        try {
          const response = JSON.parse(event.data);
          if (response.id === id) {
            clearTimeout(timeout);
            wsRef.current?.removeEventListener('message', handler);
            if (response.type.endsWith('.response')) {
              resolve(response.payload);
            } else {
              reject(new Error('Invalid response type'));
            }
          }
        } catch (error) {
          // Ignore parsing errors for other messages
        }
      };

      wsRef.current.addEventListener('message', handler);
      wsRef.current.send(message);
    });
  };

  const loadScreenshots = async () => {
    setIsLoading(true);
    try {
      const response = await sendMessage('screenshot.list', { limit: 50 });
      if (response.screenshots) {
        setScreenshots(response.screenshots);
      }
    } catch (error) {
      console.error('Failed to load screenshots:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let canceled = false;

    const loadImages = async () => {
      const updates: Record<string, string> = {};
      const missingPaths: string[] = [];
      for (const screenshot of screenshots) {
        if (imageUrls[screenshot.file_path]) continue;
        try {
          const result = await window.electron?.ipcRenderer.invoke('screenshot:read', {
            filePath: screenshot.file_path,
          });
          if (result?.error === 'not_found') {
            missingPaths.push(screenshot.file_path);
            continue;
          }
          if (!result?.buffer) continue;
          const blob = new Blob([result.buffer], { type: result.mimeType || 'image/png' });
          const url = URL.createObjectURL(blob);
          updates[screenshot.file_path] = url;
        } catch (error) {
          console.error('Failed to load screenshot image:', error);
        }
      }

      if (!canceled) {
        if (missingPaths.length > 0) {
          setScreenshots((prev) =>
            prev.filter((screenshot) => !missingPaths.includes(screenshot.file_path))
          );
        }
        if (Object.keys(updates).length > 0) {
          setImageUrls((prev) => ({ ...prev, ...updates }));
        }
      }
    };

    loadImages();

    return () => {
      canceled = true;
    };
  }, [screenshots, imageUrls]);

  useEffect(() => {
    const validPaths = new Set(screenshots.map((screenshot) => screenshot.file_path));
    const removed = Object.keys(imageUrls).filter((path) => !validPaths.has(path));
    if (removed.length === 0) return;
    removed.forEach((path) => URL.revokeObjectURL(imageUrls[path]));
    setImageUrls((prev) => {
      const next = { ...prev };
      removed.forEach((path) => delete next[path]);
      return next;
    });
  }, [screenshots, imageUrls]);

  useEffect(() => {
    return () => {
      Object.values(imageUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imageUrls]);

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('pt-BR');
  };

  const openFolder = (path: string) => {
    // TODO: Abrir pasta via IPC
    console.log('Open folder:', path);
  };

  const copyToClipboard = async (path: string) => {
    // TODO: Copiar para clipboard via IPC
    console.log('Copy to clipboard:', path);
  };

  const deleteScreenshot = async (id: number) => {
    // TODO: Deletar via gateway
    console.log('Delete screenshot:', id);
    // Recarregar lista após deletar
    loadScreenshots();
  };

  return (
    <div className="screenshot-history-panel">
      <div className="panel-header">
        <h3>Histórico de Screenshots</h3>
        <button className="refresh-button" onClick={loadScreenshots} disabled={isLoading}>
          {isLoading ? 'Carregando...' : 'Atualizar'}
        </button>
      </div>
      <div className="screenshot-history-content">
        {isLoading ? (
          <p style={{ color: '#666', fontStyle: 'italic' }}>Carregando...</p>
        ) : screenshots.length === 0 ? (
          <p style={{ color: '#666', fontStyle: 'italic' }}>
            Nenhuma captura de tela no histórico
          </p>
        ) : (
          <div className="screenshot-grid">
            {screenshots.map((screenshot) => (
              <div
                key={screenshot.id}
                className="screenshot-item"
                onClick={() => setSelectedScreenshot(screenshot)}
              >
                <img
                  src={imageUrls[screenshot.file_path] || undefined}
                  alt={`Screenshot ${screenshot.id}`}
                  style={{
                    width: '100%',
                    height: '150px',
                    objectFit: 'cover',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                />
                <div className="screenshot-info">
                  <span className="screenshot-date" style={{ fontSize: '11px', color: '#999' }}>
                    {formatDate(screenshot.created_at)}
                  </span>
                  <span className="screenshot-size" style={{ fontSize: '11px', color: '#999' }}>
                    {screenshot.width}×{screenshot.height}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de preview */}
      {selectedScreenshot && (
        <div
          className="screenshot-modal"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setSelectedScreenshot(null)}
        >
          <div
            className="modal-content"
            style={{
              backgroundColor: '#1e1e1e',
              padding: '20px',
              borderRadius: '8px',
              maxWidth: '90vw',
              maxHeight: '90vh',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setSelectedScreenshot(null)}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '0 10px',
              }}
            >
              ×
            </button>
            <img
              src={imageUrls[selectedScreenshot.file_path] || undefined}
              alt="Screenshot preview"
              style={{
                maxWidth: '100%',
                maxHeight: '80vh',
                display: 'block',
                marginBottom: '15px',
              }}
            />
            <div className="modal-actions" style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => openFolder(selectedScreenshot.file_path)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#2d2d2d',
                  color: '#fff',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Abrir Pasta
              </button>
              <button
                onClick={() => copyToClipboard(selectedScreenshot.file_path)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#2d2d2d',
                  color: '#fff',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Copiar
              </button>
              <button
                onClick={() => {
                  if (confirm('Tem certeza que deseja deletar este screenshot?')) {
                    deleteScreenshot(selectedScreenshot.id);
                    setSelectedScreenshot(null);
                  }
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#d32f2f',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Deletar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
