import { useEffect, useState } from 'react';
import './MappingOverlay.css';

interface MappingOverlayProps {
  onStop: () => void;
  onPointCaptured: (x: number, y: number) => void;
  onTemplateCaptured: (region: { x: number; y: number; width: number; height: number }, screenshotPath?: string) => void;
}

export function MappingOverlay({ onStop, onPointCaptured, onTemplateCaptured }: MappingOverlayProps): JSX.Element {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showPointDialog, setShowPointDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [capturedPoint, setCapturedPoint] = useState<{ x: number; y: number } | null>(null);
  const [capturedTemplate, setCapturedTemplate] = useState<{ region: { x: number; y: number; width: number; height: number }; screenshotPath?: string } | null>(null);
  const [newPointName, setNewPointName] = useState('');
  const [newTemplateName, setNewTemplateName] = useState('');

  useEffect(() => {
    const updateMousePosition = async () => {
      try {
        const pos = await window.automation.getMousePosition();
        setMousePos(pos);
      } catch (error) {
        // Ignore errors
      }
    };

    const interval = setInterval(updateMousePosition, 100);
    updateMousePosition();

    // Listeners para eventos de hotkeys
    const unsubPoint = window.automation.onPointCaptured?.((data: { x: number; y: number }) => {
      setCapturedPoint(data);
      setShowPointDialog(true);
      onPointCaptured(data.x, data.y);
    });

    const unsubTemplate = window.automation.onTemplateCaptured?.((data: { region: { x: number; y: number; width: number; height: number }; screenshotPath?: string }) => {
      setCapturedTemplate(data);
      setShowTemplateDialog(true);
      onTemplateCaptured(data.region, data.screenshotPath);
    });

    const unsubError = window.automation.onMappingError?.((data: { message: string }) => {
      alert(`Erro: ${data.message}`);
    });

    return () => {
      clearInterval(interval);
      unsubPoint?.();
      unsubTemplate?.();
      unsubError?.();
    };
  }, [onPointCaptured, onTemplateCaptured]);

  const handleSavePoint = async () => {
    if (!newPointName.trim() || !capturedPoint) return;
    try {
      await window.automation.recordPointFromHotkey(capturedPoint.x, capturedPoint.y, newPointName.trim(), 'click');
      setNewPointName('');
      setShowPointDialog(false);
      setCapturedPoint(null);
    } catch (error: any) {
      alert(`Erro ao salvar ponto: ${error?.message || 'Erro desconhecido'}`);
    }
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim() || !capturedTemplate) return;
    try {
      await window.automation.recordTemplateFromHotkey(
        newTemplateName.trim(),
        capturedTemplate.region,
        capturedTemplate.screenshotPath
      );
      setNewTemplateName('');
      setShowTemplateDialog(false);
      setCapturedTemplate(null);
    } catch (error: any) {
      alert(`Erro ao salvar template: ${error?.message || 'Erro desconhecido'}`);
    }
  };

  return (
    <div className="mapping-overlay">
      <div className="mapping-overlay-content">
        <div className="mapping-overlay-info">
          <div className="mapping-coordinates">
            <strong>Coordenadas do Mouse:</strong> ({mousePos.x}, {mousePos.y})
          </div>
          <div className="mapping-instructions">
            <h4 style={{ margin: '0 0 12px 0', color: '#fff' }}>Modo de Mapeamento Ativo</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#cfcfcf' }}>
              <p style={{ margin: 0 }}>
                <strong style={{ color: '#6366f1' }}>Ctrl+Shift+M</strong> - Mapear ponto de clique na posição atual do mouse
              </p>
              <p style={{ margin: 0 }}>
                <strong style={{ color: '#6366f1' }}>Ctrl+Shift+T</strong> - Capturar região para template de imagem
              </p>
              <p style={{ margin: 0 }}>
                <strong style={{ color: '#ef4444' }}>Ctrl+Shift+Esc</strong> - Parar modo de mapeamento
              </p>
            </div>
            <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '8px', fontSize: '12px', color: '#a5b4fc' }}>
              💡 <strong>Dica:</strong> Posicione o mouse onde deseja mapear e pressione Ctrl+Shift+M
            </div>
          </div>
          <button className="btn btn-danger btn-sm" onClick={onStop} style={{ marginTop: '16px' }}>
            ⏹️ Parar Mapeamento
          </button>
        </div>

        {showPointDialog && capturedPoint && (
          <div className="mapping-dialog">
            <h4>Registrar Ponto</h4>
            <p style={{ fontSize: '12px', color: '#999', margin: '0 0 12px 0' }}>
              Coordenadas: ({capturedPoint.x}, {capturedPoint.y})
            </p>
            <input
              type="text"
              placeholder="Nome do ponto (ex: Botão Login, Campo Email)"
              value={newPointName}
              onChange={(e) => setNewPointName(e.target.value)}
              className="mapping-input"
              autoFocus
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleSavePoint();
                if (e.key === 'Escape') {
                  setShowPointDialog(false);
                  setCapturedPoint(null);
                }
              }}
            />
            <div className="mapping-dialog-actions">
              <button className="btn btn-primary" onClick={handleSavePoint} disabled={!newPointName.trim()}>
                Salvar
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowPointDialog(false);
                  setCapturedPoint(null);
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {showTemplateDialog && capturedTemplate && (
          <div className="mapping-dialog">
            <h4>Capturar Template de Imagem</h4>
            <p style={{ fontSize: '12px', color: '#999', margin: '0 0 12px 0' }}>
              Região: ({capturedTemplate.region.x}, {capturedTemplate.region.y}) -{' '}
              {capturedTemplate.region.width}x{capturedTemplate.region.height}px
            </p>
            <input
              type="text"
              placeholder="Nome do template (ex: Botão Salvar, Ícone Menu)"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              className="mapping-input"
              autoFocus
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleSaveTemplate();
                if (e.key === 'Escape') {
                  setShowTemplateDialog(false);
                  setCapturedTemplate(null);
                }
              }}
            />
            <div className="mapping-dialog-actions">
              <button className="btn btn-primary" onClick={handleSaveTemplate} disabled={!newTemplateName.trim()}>
                Salvar Template
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowTemplateDialog(false);
                  setCapturedTemplate(null);
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
