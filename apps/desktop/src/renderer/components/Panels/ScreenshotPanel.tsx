import { useState, useEffect, useRef } from 'react';
import { Screenshot } from '@ricky/shared';

export function ScreenshotPanel(): JSX.Element {
  const [latestScreenshot, setLatestScreenshot] = useState<Screenshot | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messageIdRef = useRef(0);
  const imageUrlRef = useRef<string | null>(null);

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

  const loadLatestScreenshot = async () => {
    try {
      const response = await sendMessage('screenshot.list', { limit: 1 });
      if (response.screenshots && response.screenshots.length > 0) {
        setLatestScreenshot(response.screenshots[0]);
      } else {
        setLatestScreenshot(null);
      }
    } catch (error) {
      console.error('Failed to load latest screenshot:', error);
    }
  };

  useEffect(() => {
    const loadImage = async () => {
      if (!latestScreenshot) {
        if (imageUrlRef.current) {
          URL.revokeObjectURL(imageUrlRef.current);
          imageUrlRef.current = null;
        }
        setImageUrl(null);
        return;
      }

      try {
        const result = await window.electron?.ipcRenderer.invoke('screenshot:read', {
          filePath: latestScreenshot.file_path,
        });
        if (result?.error === 'not_found') {
          setLatestScreenshot(null);
          if (imageUrlRef.current) {
            URL.revokeObjectURL(imageUrlRef.current);
            imageUrlRef.current = null;
          }
          setImageUrl(null);
          return;
        }
        if (!result?.buffer) return;
        const blob = new Blob([result.buffer], { type: result.mimeType || 'image/png' });
        const url = URL.createObjectURL(blob);
        if (imageUrlRef.current) {
          URL.revokeObjectURL(imageUrlRef.current);
        }
        imageUrlRef.current = url;
        setImageUrl(url);
      } catch (error) {
        console.error('Failed to load screenshot image:', error);
      }
    };

    loadImage();
  }, [latestScreenshot]);

  // Conectar ao WebSocket gateway
  useEffect(() => {
    const ws = new WebSocket('ws://127.0.0.1:8788');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to gateway');
      // Carregar screenshot mais recente ao conectar
      loadLatestScreenshot();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle screenshot.captured event
        if (data.type === 'screenshot.captured') {
          if (data.payload?.screenshot) {
            setLatestScreenshot(data.payload.screenshot);
          }
          setIsCapturing(false);
          // Recarregar para garantir que temos a mais recente
          loadLatestScreenshot();
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsCapturing(false);
    };

    ws.onclose = () => {
      console.log('Disconnected from gateway');
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (imageUrlRef.current) {
        URL.revokeObjectURL(imageUrlRef.current);
        imageUrlRef.current = null;
      }
      // Cleanup IPC listener
      if (window.electron?.ipcRenderer) {
        window.electron.ipcRenderer.removeAllListeners('screenshot:captured');
      }
    };
  }, []);

  const handleCapture = () => {
    setIsCapturing(true);
    // Usar IPC diretamente para iniciar captura (mais confiável)
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.send('screenshot:startCapture');
      // Resetar o estado após um tempo (o seletor vai esconder/mostrar o overlay)
      setTimeout(() => {
        setIsCapturing(false);
      }, 500);
    } else {
      // Fallback: tentar WebSocket
      sendMessage('screenshot.startCapture').catch((error) => {
        console.error('Failed to start capture:', error);
        setIsCapturing(false);
      });
    }
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('pt-BR');
  };

  const openFolder = (path: string) => {
    // TODO: Abrir pasta via IPC
    console.log('Open folder:', path);
  };

  return (
    <div className="screenshot-panel">
      <div className="panel-header">
        <h3>Capturas de Tela</h3>
        <button
          className="capture-button"
          onClick={handleCapture}
          disabled={isCapturing}
        >
          {isCapturing ? 'Capturando...' : 'Capturar'}
        </button>
      </div>
      <div className="screenshot-content">
        {isCapturing ? (
          <p style={{ color: '#666', fontStyle: 'italic' }}>
            Selecionando área da tela...
          </p>
        ) : latestScreenshot ? (
          <div className="screenshot-preview">
            <img
              src={imageUrl || undefined}
              alt="Screenshot mais recente"
              style={{
                width: '100%',
                maxHeight: '400px',
                objectFit: 'contain',
                borderRadius: '4px',
                marginBottom: '10px',
              }}
            />
            <div className="screenshot-info">
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: '#999', fontSize: '12px' }}>
                  {formatDate(latestScreenshot.created_at)}
                </span>
              </div>
              <div style={{ color: '#999', fontSize: '12px' }}>
                {latestScreenshot.width} × {latestScreenshot.height}
              </div>
              <div style={{ marginTop: '10px' }}>
                <button
                  onClick={() => openFolder(latestScreenshot.file_path)}
                  style={{
                    padding: '4px 12px',
                    fontSize: '12px',
                    marginRight: '8px',
                  }}
                >
                  Abrir Pasta
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p style={{ color: '#666', fontStyle: 'italic' }}>
            Nenhuma captura de tela ainda. Clique em "Capturar" para tirar uma screenshot.
          </p>
        )}
      </div>
    </div>
  );
}
