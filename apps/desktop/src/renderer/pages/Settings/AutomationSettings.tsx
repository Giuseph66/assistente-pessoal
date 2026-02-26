import { useEffect, useRef, useState } from 'react';
import {
  AutomationConfig,
  MappingPoint,
  ImageTemplate,
  Workflow,
  ExecutionStatus,
} from '@neo/shared';
import { WorkflowEditor } from '../../components/Automation/WorkflowEditor';
import { MappingOverlay } from '../../components/Automation/MappingOverlay';
import { WorkflowSettings } from '../../components/AutomationFlow/WorkflowSettings';

// Componente para exibir template com prévia de imagem
function TemplateItem({ template, onDelete, onUpdated }: { template: ImageTemplate; onDelete: () => void; onUpdated: () => void }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [displaySize, setDisplaySize] = useState<{ width: number; height: number } | null>(null);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [editName, setEditName] = useState(template.name);
  const [replaceDataUrl, setReplaceDataUrl] = useState<string | null>(null);
  const [replaceFileName, setReplaceFileName] = useState<string | null>(null);
  const [replaceRegion, setReplaceRegion] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [editorImageSize, setEditorImageSize] = useState<{ width: number; height: number } | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const cropAreaRef = useRef<HTMLDivElement | null>(null);
  const cropImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    let active = true;
    const loadImage = async () => {
      try {
        setLoading(true);
        const result = await window.electron?.ipcRenderer.invoke('screenshot:read', {
          filePath: template.imagePath,
        });
        if (!active) return;
        if (result?.base64 && result?.mimeType) {
          const dataUrl = `data:${result.mimeType};base64,${result.base64}`;
          setImageUrl(dataUrl);
          const img = new Image();
          img.onload = () => {
            if (!active) return;
            setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
          };
          img.onerror = () => {
            if (!active) return;
            setImageSize(null);
          };
          img.src = dataUrl;
        } else {
          setImageUrl(null);
          setImageSize(null);
        }
      } catch (error) {
        console.error('Failed to load template image:', error);
        if (active) {
          setImageUrl(null);
          setImageSize(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadImage();
    return () => {
      active = false;
    };
  }, [template.imagePath, template.updatedAt]);

  useEffect(() => {
    if (!showEditor) {
      setEditName(template.name);
    }
  }, [template.name, showEditor]);

  const previewUrl = replaceDataUrl ?? imageUrl;

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const getFileName = (filePath: string) => {
    const normalized = filePath.replace(/\\/g, '/');
    const parts = normalized.split('/');
    return parts[parts.length - 1] || filePath;
  };

  const getCurrentSize = () => {
    const size = editorImageSize ?? imageSize;
    const width = size?.width ?? template.region?.width ?? 0;
    const height = size?.height ?? template.region?.height ?? 0;
    return { width, height };
  };

  const getSelectionSize = () => {
    const size = editorImageSize ?? imageSize;
    if (!size || !displaySize || !cropRect) return null;
    const scaleX = size.width / displaySize.width;
    const scaleY = size.height / displaySize.height;
    return {
      width: Math.max(1, Math.round(cropRect.width * scaleX)),
      height: Math.max(1, Math.round(cropRect.height * scaleY)),
    };
  };

  const updateDisplaySize = () => {
    if (!cropImageRef.current) return;
    const rect = cropImageRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    setDisplaySize({ width: rect.width, height: rect.height });
    if (cropImageRef.current.naturalWidth && cropImageRef.current.naturalHeight) {
      setEditorImageSize({
        width: cropImageRef.current.naturalWidth,
        height: cropImageRef.current.naturalHeight,
      });
    }
    setCropRect((prev) => prev ?? { x: 0, y: 0, width: rect.width, height: rect.height });
  };

  useEffect(() => {
    if (!showEditor) return;
    const raf = requestAnimationFrame(updateDisplaySize);
    return () => cancelAnimationFrame(raf);
  }, [showEditor, previewUrl]);

  const handleOpenEditor = () => {
    setEditError(null);
    setCropRect(null);
    setDisplaySize(null);
    setDragStart(null);
    setEditName(template.name);
    setReplaceDataUrl(null);
    setReplaceFileName(null);
    setReplaceRegion(null);
    setEditorImageSize(null);
    setIsCapturing(false);
    setShowEditor(true);
  };

  const getRelativePoint = (clientX: number, clientY: number) => {
    if (!cropAreaRef.current) return null;
    const rect = cropAreaRef.current.getBoundingClientRect();
    const x = clamp(clientX - rect.left, 0, rect.width);
    const y = clamp(clientY - rect.top, 0, rect.height);
    return { x, y, width: rect.width, height: rect.height };
  };

  const updateCropFromClient = (clientX: number, clientY: number) => {
    if (!dragStart) return;
    const point = getRelativePoint(clientX, clientY);
    if (!point) return;
    const x = Math.min(dragStart.x, point.x);
    const y = Math.min(dragStart.y, point.y);
    const width = Math.max(1, Math.abs(point.x - dragStart.x));
    const height = Math.max(1, Math.abs(point.y - dragStart.y));
    setCropRect({ x, y, width, height });
  };

  const handleCropMouseDown = (event: React.MouseEvent) => {
    if (!previewUrl) return;
    const point = getRelativePoint(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    setDragStart({ x: point.x, y: point.y });
    setCropRect({ x: point.x, y: point.y, width: 1, height: 1 });
  };

  const handleCropMouseMove = (event: React.MouseEvent) => {
    updateCropFromClient(event.clientX, event.clientY);
  };

  const handleCropMouseUp = () => {
    setDragStart(null);
  };

  useEffect(() => {
    if (!dragStart) return;

    const handleWindowMouseMove = (event: MouseEvent) => {
      updateCropFromClient(event.clientX, event.clientY);
    };

    const handleWindowMouseUp = () => {
      setDragStart(null);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [dragStart]);

  const handleResetCrop = () => {
    if (!displaySize) return;
    setCropRect({ x: 0, y: 0, width: displaySize.width, height: displaySize.height });
    setEditError(null);
  };

  const handleCaptureReplacement = async () => {
    if (isCapturing) return;
    setIsCapturing(true);
    setEditError(null);

    try {
      const result = await window.automation.captureTemplateInteractive();
      if (!result?.success) {
        if (result?.error && result.error !== 'Selecao cancelada') {
          setEditError(result.error);
        }
        return;
      }

      if (!result.path) {
        setEditError('Falha ao capturar imagem.');
        return;
      }

      const readResult = await window.electron?.ipcRenderer.invoke('screenshot:read', {
        filePath: result.path,
      });
      if (!readResult?.base64 || !readResult?.mimeType) {
        setEditError('Falha ao carregar captura.');
        return;
      }

      const dataUrl = `data:${readResult.mimeType};base64,${readResult.base64}`;
      setReplaceDataUrl(dataUrl);
      setReplaceFileName(getFileName(result.path));
      setReplaceRegion(result.region ?? null);
      setCropRect(null);
      setDisplaySize(null);
      setEditorImageSize(null);
    } catch (error: any) {
      setEditError(error?.message || 'Falha ao capturar imagem.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleClearReplacement = () => {
    setReplaceDataUrl(null);
    setReplaceFileName(null);
    setReplaceRegion(null);
    setEditError(null);
    setCropRect(null);
    setDisplaySize(null);
    setEditorImageSize(null);
  };

  const handleSaveChanges = async () => {
    const normalizedName = editName.trim();
    if (!normalizedName) {
      setEditError('Nome do template é obrigatório.');
      return;
    }

    const size = editorImageSize ?? imageSize;
    if (cropRect && (!displaySize || !size)) {
      setEditError('Aguarde a imagem carregar antes de recortar.');
      return;
    }

    const selectionRect = displaySize
      ? cropRect ?? { x: 0, y: 0, width: displaySize.width, height: displaySize.height }
      : null;
    const isFullSelection =
      !selectionRect ||
      !displaySize ||
      (selectionRect.x <= 0 &&
        selectionRect.y <= 0 &&
        selectionRect.width >= displaySize.width - 1 &&
        selectionRect.height >= displaySize.height - 1);
    const shouldCrop = Boolean(selectionRect && displaySize && size && !isFullSelection);

    setSaving(true);
    setEditError(null);
    try {
      if (replaceDataUrl) {
        const updated = await window.automation.replaceImageTemplate(template.id, replaceDataUrl);
        if (!updated) {
          throw new Error('Template não encontrado.');
        }
      }

      if (replaceRegion) {
        const updated = await window.automation.updateImageTemplate(template.id, { region: replaceRegion });
        if (!updated) {
          throw new Error('Template não encontrado.');
        }
      }

      if (shouldCrop && selectionRect && displaySize && size) {
        if (selectionRect.width < 1 || selectionRect.height < 1) {
          throw new Error('Seleção inválida.');
        }

        const scaleX = size.width / displaySize.width;
        const scaleY = size.height / displaySize.height;
        let cropX = Math.round(selectionRect.x * scaleX);
        let cropY = Math.round(selectionRect.y * scaleY);
        let cropWidth = Math.round(selectionRect.width * scaleX);
        let cropHeight = Math.round(selectionRect.height * scaleY);

        cropX = clamp(cropX, 0, Math.max(0, size.width - 1));
        cropY = clamp(cropY, 0, Math.max(0, size.height - 1));
        cropWidth = clamp(cropWidth, 1, Math.max(1, size.width - cropX));
        cropHeight = clamp(cropHeight, 1, Math.max(1, size.height - cropY));

        const updated = await window.automation.cropImageTemplate(template.id, {
          x: cropX,
          y: cropY,
          width: cropWidth,
          height: cropHeight,
        });
        if (!updated) {
          throw new Error('Template não encontrado.');
        }
      }

      if (normalizedName !== template.name) {
        const updated = await window.automation.updateImageTemplate(template.id, { name: normalizedName });
        if (!updated) {
          throw new Error('Template não encontrado.');
        }
      }

      setShowEditor(false);
      onUpdated();
    } catch (error: any) {
      setEditError(error?.message || 'Falha ao salvar template.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1 }}>
          {loading ? (
            <div style={{ width: '60px', height: '40px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#666' }}>
              ...
            </div>
          ) : imageUrl ? (
            <div
              style={{
                width: '60px',
                height: '40px',
                borderRadius: '4px',
                overflow: 'hidden',
                cursor: 'pointer',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(0, 0, 0, 0.2)',
              }}
              onClick={() => setShowModal(true)}
              title="Clique para visualizar em tamanho maior"
            >
              <img
                src={imageUrl}
                alt={template.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          ) : (
            <div style={{ width: '60px', height: '40px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#ef4444' }}>
              ❌
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{template.name}</div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              {template.region ? `Região: ${template.region.width}x${template.region.height}px` : 'Tela inteira'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {imageUrl && (
            <button
              className="btn-get-key-premium"
              onClick={() => setShowModal(true)}
              style={{ padding: '6px 12px', fontSize: '12px' }}
              title="Visualizar imagem"
            >
              👁️
            </button>
          )}
          <button
            className="btn-get-key-premium"
            onClick={handleOpenEditor}
            style={{ padding: '6px 12px', fontSize: '12px' }}
            title="Editar template"
            disabled={!imageUrl}
          >
            ✏️
          </button>
          <button
            className="btn-get-key-premium"
            onClick={onDelete}
            style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '6px 12px', fontSize: '12px' }}
            title="Deletar template"
          >
            🗑️
          </button>
        </div>
      </div>

      {showModal && imageUrl && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              background: '#111',
              borderRadius: '8px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#fff' }}>{template.name}</h3>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                ✕ Fechar
              </button>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#888' }}>
              {template.region && (
                <>
                  <span>Posição: ({template.region.x}, {template.region.y})</span>
                  <span>Tamanho: {template.region.width}x{template.region.height}px</span>
                </>
              )}
            </div>
            <div style={{ overflow: 'auto', maxHeight: 'calc(90vh - 100px)' }}>
              <img
                src={imageUrl}
                alt={template.name}
                style={{
                  maxWidth: '100%',
                  height: 'auto',
                  borderRadius: '4px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {showEditor && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
          }}
          onClick={() => setShowEditor(false)}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '520px',
              width: '100%',
              background: '#111',
              borderRadius: '8px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#fff' }}>Editar Template</h3>
              <button
                onClick={() => setShowEditor(false)}
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                ✕ Fechar
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: '#cfcfcf' }}>Nome do template</label>
                <input
                  className="premium-api-input"
                  value={editName}
                  onChange={(event) => {
                    setEditName(event.target.value);
                    if (editError) {
                      setEditError(null);
                    }
                  }}
                  placeholder="Nome do template"
                />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <button
                  className="btn-get-key-premium"
                  onClick={handleCaptureReplacement}
                  disabled={isCapturing}
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  {isCapturing ? '📸 Capturando...' : '📸 Capturar imagem'}
                </button>
                {replaceFileName ? (
                  <>
                    <span style={{ fontSize: '11px', color: '#888' }}>Nova captura: {replaceFileName}</span>
                    <button
                      className="btn-get-key-premium"
                      onClick={handleClearReplacement}
                      style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(255, 255, 255, 0.05)' }}
                    >
                      Desfazer
                    </button>
                  </>
                ) : (
                  <span style={{ fontSize: '11px', color: '#666' }}>Clique para capturar uma nova área</span>
                )}
              </div>

              {previewUrl ? (
                <>
                  <div style={{ fontSize: '12px', color: '#888' }}>
                    Arraste para selecionar a area que deseja manter no template.
                  </div>
                  <div
                    ref={cropAreaRef}
                    style={{
                      position: 'relative',
                      alignSelf: 'center',
                      display: 'inline-block',
                      maxWidth: '100%',
                      lineHeight: 0,
                      borderRadius: '6px',
                      overflow: 'hidden',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      cursor: 'crosshair',
                      userSelect: 'none',
                      background: '#0b0b0b',
                    }}
                    onMouseDown={handleCropMouseDown}
                    onMouseMove={handleCropMouseMove}
                    onMouseUp={handleCropMouseUp}
                  >
                    <img
                      ref={cropImageRef}
                      src={previewUrl}
                      alt={editName || template.name}
                      onLoad={updateDisplaySize}
                      draggable={false}
                      style={{
                        display: 'block',
                        maxWidth: '100%',
                        height: 'auto',
                      }}
                    />
                    {cropRect && (
                      <div
                        style={{
                          position: 'absolute',
                          left: cropRect.x,
                          top: cropRect.y,
                          width: cropRect.width,
                          height: cropRect.height,
                          border: '2px solid #6366f1',
                          background: 'rgba(99, 102, 241, 0.2)',
                          boxSizing: 'border-box',
                          pointerEvents: 'none',
                        }}
                      />
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888' }}>
                    {(() => {
                      const { width, height } = getCurrentSize();
                      return width && height ? <span>Tamanho atual: {width}x{height}px</span> : <span />;
                    })()}
                    {(() => {
                      const selection = getSelectionSize();
                      return selection ? <span>Selecao: {selection.width}x{selection.height}px</span> : <span />;
                    })()}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: '12px', color: '#888' }}>Prévia indisponível.</div>
              )}
            </div>

            {editError && (
              <div style={{ fontSize: '12px', color: '#ef4444' }}>⚠️ {editError}</div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                className="btn-get-key-premium"
                onClick={handleResetCrop}
                disabled={!displaySize}
                style={{ padding: '8px 14px', fontSize: '12px', background: 'rgba(255, 255, 255, 0.05)' }}
              >
                Resetar
              </button>
              <button
                className="btn-get-key-premium"
                onClick={handleSaveChanges}
                disabled={saving}
                style={{ padding: '8px 14px', fontSize: '12px' }}
              >
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
              <button
                className="btn-get-key-premium"
                onClick={() => setShowEditor(false)}
                style={{ padding: '8px 14px', fontSize: '12px', background: 'rgba(255, 255, 255, 0.05)' }}
              >
                Cancelar
              </button>
            </div>

            <div style={{ fontSize: '11px', color: '#888' }}>
              As alterações substituem o arquivo do template no disco.
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function AutomationSettings(): JSX.Element {
  const [config, setConfig] = useState<AutomationConfig | null>(null);
  const [mappings, setMappings] = useState<{ points: MappingPoint[]; templates: ImageTemplate[] }>({
    points: [],
    templates: [],
  });
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus | null>(null);
  const [isMappingMode, setIsMappingMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showWorkflowEditor, setShowWorkflowEditor] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'mappings' | 'workflows' | 'execution' | 'flow'>('config');
  const [showImportTemplate, setShowImportTemplate] = useState(false);
  const [importName, setImportName] = useState('');
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importDataUrl, setImportDataUrl] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSaving, setImportSaving] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadData();
    const cleanup = setupEventListeners();
    return () => {
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (executionStatus?.status === 'running' || executionStatus?.status === 'paused') {
        const status = await window.automation.getExecutionStatus();
        setExecutionStatus(status);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [executionStatus?.status]);

  const setupEventListeners = () => {
    const unsubscribers: (() => void)[] = [];

    unsubscribers.push(
      window.automation.onExecutionStatus((status) => {
        setExecutionStatus(status);
      })
    );

    unsubscribers.push(
      window.automation.onMappingModeChanged((data: any) => {
        setIsMappingMode(data.active);
      })
    );

    unsubscribers.push(
      window.automation.onMappingPointAdded(() => {
        loadMappings();
      })
    );

    unsubscribers.push(
      window.automation.onTemplateAdded(() => {
        loadMappings();
      })
    );

    unsubscribers.push(
      window.automation.onTemplateUpdated(() => {
        loadMappings();
      })
    );

    unsubscribers.push(
      window.automation.onTemplateDeleted(() => {
        loadMappings();
      })
    );

    unsubscribers.push(
      window.automation.onWorkflowCreated(() => {
        loadWorkflows();
      })
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  };

  const loadData = async () => {
    try {
      const [configValue, mappingsValue, workflowsValue] = await Promise.all([
        window.automation.getConfig(),
        window.automation.listMappings(),
        window.automation.listWorkflows(),
      ]);
      setConfig(configValue);
      setMappings(mappingsValue);
      setWorkflows(workflowsValue || []);
      const mappingMode = await window.automation.isMappingMode();
      setIsMappingMode(mappingMode);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar dados');
    }
  };

  const loadMappings = async () => {
    try {
      const mappingsValue = await window.automation.listMappings();
      setMappings(mappingsValue);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar mapeamentos');
    }
  };

  const loadWorkflows = async () => {
    try {
      const workflowsValue = await window.automation.listWorkflows();
      setWorkflows(workflowsValue || []);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar workflows');
    }
  };

  const handleConfigChange = async (patch: Partial<AutomationConfig>) => {
    if (!config) return;
    try {
      setError(null);
      const updated = await window.automation.saveConfig(patch);
      setConfig(updated);
      setSuccess('Configuração salva');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Falha ao salvar configuração');
    }
  };

  const handleStartMappingMode = async () => {
    try {
      await window.automation.startMappingMode();
      setIsMappingMode(true);
      setSuccess('Modo de mapeamento iniciado');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Falha ao iniciar modo de mapeamento');
    }
  };

  const handleStopMappingMode = async () => {
    try {
      await window.automation.stopMappingMode();
      setIsMappingMode(false);
      setSuccess('Modo de mapeamento parado');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Falha ao parar modo de mapeamento');
    }
  };

  const handleDeleteMapping = async (id: string, type: 'point' | 'template') => {
    if (!confirm(`Tem certeza que deseja deletar este ${type === 'point' ? 'ponto' : 'template'}?`)) return;
    try {
      await window.automation.deleteMapping(id, type);
      await loadMappings();
      setSuccess(`${type === 'point' ? 'Ponto' : 'Template'} deletado`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Falha ao deletar');
    }
  };

  const handleCreateWorkflow = () => {
    setEditingWorkflow(null);
    setShowWorkflowEditor(true);
  };

  const handleEditWorkflow = (workflow: Workflow) => {
    setEditingWorkflow(workflow);
    setShowWorkflowEditor(true);
  };

  const handleDeleteWorkflow = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar este workflow?')) return;
    try {
      await window.automation.deleteWorkflow(id);
      await loadWorkflows();
      setSuccess('Workflow deletado');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Falha ao deletar workflow');
    }
  };

  const handleExecuteWorkflow = async (workflowId: string) => {
    if (config?.safetyMode) {
      if (!confirm('Tem certeza que deseja executar este workflow?')) return;
    }
    try {
      setError(null);
      await window.automation.executeWorkflow(workflowId);
      setActiveTab('execution');
      setSuccess('Workflow iniciado');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Falha ao executar workflow');
    }
  };

  const handlePauseExecution = async () => {
    try {
      await window.automation.pauseExecution();
    } catch (err: any) {
      setError(err?.message || 'Falha ao pausar execução');
    }
  };

  const handleResumeExecution = async () => {
    try {
      await window.automation.resumeExecution();
    } catch (err: any) {
      setError(err?.message || 'Falha ao retomar execução');
    }
  };

  const handleStopExecution = async () => {
    try {
      await window.automation.stopExecution();
    } catch (err: any) {
      setError(err?.message || 'Falha ao parar execução');
    }
  };

  if (!config) {
    return <div className="settings-content-inner">Carregando configurações...</div>;
  }

  if (showWorkflowEditor) {
    return (
      <WorkflowEditor
        workflow={editingWorkflow}
        mappings={mappings}
        onSave={async () => {
          setShowWorkflowEditor(false);
          setEditingWorkflow(null);
          await loadWorkflows();
        }}
        onCancel={() => {
          setShowWorkflowEditor(false);
          setEditingWorkflow(null);
        }}
      />
    );
  }

  const handlePointCaptured = (x: number, y: number) => {
    // Ponto capturado via hotkey, o diálogo será mostrado pelo MappingOverlay
  };

  const handleTemplateCaptured = (region: { x: number; y: number; width: number; height: number }, screenshotPath?: string) => {
    // Template capturado via hotkey, o diálogo será mostrado pelo MappingOverlay
  };

  const handleOpenImportTemplate = () => {
    setImportName('');
    setImportFileName(null);
    setImportDataUrl(null);
    setImportError(null);
    setShowImportTemplate(true);
  };

  const handleImportFileClick = () => {
    importFileInputRef.current?.click();
  };

  const handleImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      setImportDataUrl(reader.result);
      setImportFileName(file.name);
      setImportError(null);
      if (!importName.trim()) {
        setImportName(file.name.replace(/\.[^/.]+$/, ''));
      }
    };
    reader.onerror = () => {
      setImportError('Falha ao carregar imagem selecionada.');
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleImportTemplate = async () => {
    const normalizedName = importName.trim();
    if (!normalizedName) {
      setImportError('Nome do template é obrigatório.');
      return;
    }
    if (!importDataUrl) {
      setImportError('Selecione uma imagem para importar.');
      return;
    }

    setImportSaving(true);
    setImportError(null);
    try {
      await window.automation.importImageTemplate(normalizedName, importDataUrl);
      setShowImportTemplate(false);
      setImportName('');
      setImportFileName(null);
      setImportDataUrl(null);
      await loadMappings();
    } catch (error: any) {
      setImportError(error?.message || 'Falha ao importar template.');
    } finally {
      setImportSaving(false);
    }
  };

  return (
    <div className="settings-content-inner">
      {isMappingMode && (
        <MappingOverlay
          onStop={handleStopMappingMode}
          onPointCaptured={handlePointCaptured}
          onTemplateCaptured={handleTemplateCaptured}
        />
      )}

      {error && (
        <div className="settings-toast" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444' }}>
          <span>⚠️</span> {error}
        </div>
      )}

      {success && (
        <div className="settings-toast" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981' }}>
          <span>✅</span> {success}
        </div>
      )}

      {showImportTemplate && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
          }}
          onClick={() => {
            if (!importSaving) setShowImportTemplate(false);
          }}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '520px',
              width: '100%',
              background: '#111',
              borderRadius: '8px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#fff' }}>Importar Template</h3>
              <button
                onClick={() => setShowImportTemplate(false)}
                disabled={importSaving}
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                ✕ Fechar
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: '#cfcfcf' }}>Nome do template</label>
              <input
                className="premium-api-input"
                value={importName}
                onChange={(event) => {
                  setImportName(event.target.value);
                  if (importError) setImportError(null);
                }}
                placeholder="Nome do template"
              />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <input
                ref={importFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImportFileChange}
                style={{ display: 'none' }}
              />
              <button
                className="btn-get-key-premium"
                onClick={handleImportFileClick}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                📁 Selecionar imagem
              </button>
              {importFileName ? (
                <span style={{ fontSize: '11px', color: '#888' }}>{importFileName}</span>
              ) : (
                <span style={{ fontSize: '11px', color: '#666' }}>Nenhuma imagem selecionada</span>
              )}
            </div>

            {importDataUrl ? (
              <div style={{ maxHeight: '240px', overflow: 'auto', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <img
                  src={importDataUrl}
                  alt={importName || 'Template importado'}
                  style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
                />
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: '#666' }}>Prévia indisponível.</div>
            )}

            {importError && (
              <div style={{ fontSize: '12px', color: '#ef4444' }}>⚠️ {importError}</div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                className="btn-get-key-premium"
                onClick={() => setShowImportTemplate(false)}
                disabled={importSaving}
                style={{ padding: '8px 14px', fontSize: '12px', background: 'rgba(255, 255, 255, 0.05)' }}
              >
                Cancelar
              </button>
              <button
                className="btn-get-key-premium"
                onClick={handleImportTemplate}
                disabled={importSaving || !importDataUrl || !importName.trim()}
                style={{ padding: '8px 14px', fontSize: '12px' }}
              >
                {importSaving ? 'Importando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="content-header">
        <h3>Automação</h3>
        <p className="header-desc">Configure automações para controlar seu computador automaticamente</p>
      </div>

      <div className="settings-body">
        {/* Tabs */}
        <div className="provider-tabs" style={{ marginBottom: '24px' }}>
          <button
            className={`provider-tab ${activeTab === 'config' ? 'active' : ''}`}
            onClick={() => setActiveTab('config')}
          >
            Configurações
          </button>
          <button
            className={`provider-tab ${activeTab === 'mappings' ? 'active' : ''}`}
            onClick={() => setActiveTab('mappings')}
          >
            Mapeamentos
          </button>
          <button
            className={`provider-tab ${activeTab === 'flow' ? 'active' : ''}`}
            onClick={() => setActiveTab('flow')}
          >
            Workflow Editor
          </button>
          {executionStatus && executionStatus.status !== 'idle' && (
            <button
              className={`provider-tab ${activeTab === 'execution' ? 'active' : ''}`}
              onClick={() => setActiveTab('execution')}
            >
              Execução
            </button>
          )}
        </div>

        {/* Config Tab */}
        {activeTab === 'config' && (
          <div className="api-key-card-premium">
            <div className="api-key-card-header">
              <div className="provider-info-main">
                <div className="provider-icon-circle" style={{ background: 'rgba(79, 70, 229, 0.2)', color: '#6366f1' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                </div>
                <div className="provider-text-details">
                  <h4>Configurações Gerais</h4>
                  <p>Defina os parâmetros padrão para automações</p>
                </div>
              </div>
            </div>

            <div className="provider-details">
              <div className="input-group">
                <label>Delay Padrão (ms)</label>
                <input
                  type="number"
                  className="premium-api-input"
                  value={config.defaultDelayMs}
                  onChange={(e) => handleConfigChange({ defaultDelayMs: parseInt(e.target.value) || 500 })}
                  min="0"
                  max="10000"
                  step="100"
                />
                <p className="card-description">Tempo de espera entre ações</p>
              </div>

              <div className="input-group">
                <label>Máximo de Tentativas</label>
                <input
                  type="number"
                  className="premium-api-input"
                  value={config.maxRetries}
                  onChange={(e) => handleConfigChange({ maxRetries: parseInt(e.target.value) || 3 })}
                  min="0"
                  max="10"
                />
                <p className="card-description">Número de tentativas em caso de falha</p>
              </div>

              <div className="input-group">
                <label>Timeout para Encontrar Imagens (ms)</label>
                <input
                  type="number"
                  className="premium-api-input"
                  value={config.imageFindTimeout}
                  onChange={(e) => handleConfigChange({ imageFindTimeout: parseInt(e.target.value) || 5000 })}
                  min="1000"
                  max="60000"
                  step="1000"
                />
                <p className="card-description">Tempo máximo para encontrar template na tela</p>
              </div>

              <div className="input-group">
                <label>Confiança de Reconhecimento (0.0 - 1.0)</label>
                <input
                  type="number"
                  className="premium-api-input"
                  value={config.imageFindConfidence}
                  onChange={(e) => handleConfigChange({ imageFindConfidence: parseFloat(e.target.value) || 0.8 })}
                  min="0.1"
                  max="1.0"
                  step="0.1"
                />
                <p className="card-description">Maior valor = mais preciso (pode ser mais lento)</p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px' }}>
                <input
                  type="checkbox"
                  id="safety-mode"
                  checked={config.safetyMode}
                  onChange={(e) => handleConfigChange({ safetyMode: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="safety-mode" style={{ margin: 0, cursor: 'pointer', fontSize: '14px', color: '#fff' }}>
                  Modo de Segurança (pede confirmação antes de executar)
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Mappings Tab */}
        {activeTab === 'mappings' && (
          <div>
            <div className="api-key-card-premium" style={{ marginBottom: '24px' }}>
              <div className="api-key-card-header">
                <div className="provider-info-main">
                  <div className="provider-icon-circle" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <div className="provider-text-details">
                    <h4>Mapeamentos</h4>
                    <p>Pontos e templates de imagem para usar em workflows</p>
                  </div>
                </div>
                {!isMappingMode ? (
                  <button className="btn-get-key-premium" onClick={handleStartMappingMode}>
                    🗺️ Iniciar Mapeamento
                  </button>
                ) : (
                  <button className="btn-get-key-premium" onClick={handleStopMappingMode} style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}>
                    ⏹️ Parar
                  </button>
                )}
              </div>

              {isMappingMode && (
                <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '8px' }}>
                  <h5 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#fff' }}>Instruções de Mapeamento</h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#cfcfcf' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <kbd style={{ padding: '4px 8px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px' }}>Ctrl+Shift+M</kbd>
                      <span>Mapear ponto de clique na posição atual do mouse</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <kbd style={{ padding: '4px 8px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px' }}>Ctrl+Shift+T</kbd>
                      <span>Capturar região para template de imagem (abre seletor de área)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <kbd style={{ padding: '4px 8px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px' }}>Ctrl+Shift+Esc</kbd>
                      <span>Parar modo de mapeamento</span>
                    </div>
                  </div>
                  <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: '#888', fontStyle: 'italic' }}>
                    💡 Posicione o mouse onde deseja mapear e pressione o atalho correspondente
                  </p>
                </div>
              )}
            </div>

            <div className="api-key-card-premium" style={{ marginBottom: '24px' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, color: '#fff' }}>Pontos Mapeados</h4>
              {mappings.points.length === 0 ? (
                <p style={{ color: '#666', fontSize: '13px', margin: 0 }}>Nenhum ponto mapeado. Inicie o modo de mapeamento para adicionar.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {mappings.points.map((point) => (
                    <div key={point.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{point.name}</div>
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                          ({point.x}, {point.y}) - {point.type}
                        </div>
                      </div>
                      <button
                        className="btn-get-key-premium"
                        onClick={() => handleDeleteMapping(point.id, 'point')}
                        style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '6px 12px', fontSize: '12px' }}
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="api-key-card-premium">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#fff' }}>Templates de Imagem</h4>
                <button
                  className="btn-get-key-premium"
                  onClick={handleOpenImportTemplate}
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  📁 Importar
                </button>
              </div>
              {mappings.templates.length === 0 ? (
                <p style={{ color: '#666', fontSize: '13px', margin: 0 }}>Nenhum template. Use o modo de mapeamento para capturar.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {mappings.templates.map((template) => (
                    <TemplateItem
                      key={template.id}
                      template={template}
                      onDelete={() => handleDeleteMapping(template.id, 'template')}
                      onUpdated={loadMappings}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Workflows Tab */}
        {activeTab === 'workflows' && (
          <div>
            <div className="api-key-card-premium" style={{ marginBottom: '24px' }}>
              <div className="api-key-card-header">
                <div className="provider-info-main">
                  <div className="provider-icon-circle" style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#8b5cf6' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                  </div>
                  <div className="provider-text-details">
                    <h4>Workflows</h4>
                    <p>Crie e gerencie sequências de automação</p>
                  </div>
                </div>
                <button className="btn-get-key-premium" onClick={handleCreateWorkflow}>
                  ➕ Criar Workflow
                </button>
              </div>
            </div>

            {workflows.length === 0 ? (
              <div className="api-key-card-premium">
                <p style={{ color: '#666', fontSize: '13px', textAlign: 'center', padding: '40px' }}>
                  Nenhum workflow criado. Crie um workflow para automatizar tarefas.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {workflows.map((workflow) => (
                  <div key={workflow.id} className="api-key-card-premium">
                    <div className="api-key-card-header">
                      <div className="provider-info-main">
                        <div className="provider-text-details">
                          <div className="provider-title-row">
                            <h4 style={{ margin: 0 }}>{workflow.name}</h4>
                            <span className={`status-badge-premium ${workflow.enabled ? 'active' : ''}`}>
                              {workflow.enabled ? 'Habilitado' : 'Desabilitado'}
                            </span>
                          </div>
                          {workflow.description && (
                            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>{workflow.description}</p>
                          )}
                          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#666' }}>
                            {workflow.steps.length} passo{workflow.steps.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-get-key-premium" onClick={() => handleEditWorkflow(workflow)}>
                          ✏️ Editar
                        </button>
                        <button
                          className="btn-get-key-premium"
                          onClick={() => handleExecuteWorkflow(workflow.id)}
                          disabled={!workflow.enabled || executionStatus?.status === 'running'}
                          style={{ background: workflow.enabled && executionStatus?.status !== 'running' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.05)', borderColor: workflow.enabled && executionStatus?.status !== 'running' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.1)', color: workflow.enabled && executionStatus?.status !== 'running' ? '#10b981' : '#666' }}
                        >
                          ▶️ Executar
                        </button>
                        <button
                          className="btn-get-key-premium"
                          onClick={() => handleDeleteWorkflow(workflow.id)}
                          style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Workflow Editor Tab */}
        {activeTab === 'flow' && <WorkflowSettings />}

        {/* Execution Tab */}
        {activeTab === 'execution' && executionStatus && executionStatus.status !== 'idle' && (
          <div className="api-key-card-premium">
            <div className="api-key-card-header">
              <div className="provider-info-main">
                <div className="provider-icon-circle" style={{ background: executionStatus.status === 'running' ? 'rgba(16, 185, 129, 0.2)' : executionStatus.status === 'paused' ? 'rgba(255, 152, 0, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: executionStatus.status === 'running' ? '#10b981' : executionStatus.status === 'paused' ? '#ff9800' : '#ef4444' }}>
                  {executionStatus.status === 'running' && '▶️'}
                  {executionStatus.status === 'paused' && '⏸️'}
                  {executionStatus.status === 'error' && '❌'}
                </div>
                <div className="provider-text-details">
                  <div className="provider-title-row">
                    <h4>
                      {executionStatus.status === 'running' && 'Executando'}
                      {executionStatus.status === 'paused' && 'Pausado'}
                      {executionStatus.status === 'stopped' && 'Parado'}
                      {executionStatus.status === 'error' && 'Erro'}
                    </h4>
                    {executionStatus.progress > 0 && (
                      <div style={{ width: '200px', height: '8px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${executionStatus.progress}%`, height: '100%', background: '#6366f1', transition: 'width 0.3s' }} />
                      </div>
                    )}
                  </div>
                  {executionStatus.currentStep && (
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>
                      Passo: {executionStatus.currentStep.action.type}
                      {executionStatus.currentStepIndex !== undefined && (
                        <span> ({executionStatus.currentStepIndex + 1}/{executionStatus.currentWorkflowId ? workflows.find(w => w.id === executionStatus.currentWorkflowId)?.steps.length : '?'})</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {executionStatus.error && (
              <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>
                ❌ {executionStatus.error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              {executionStatus.status === 'running' && (
                <>
                  <button className="btn-get-key-premium" onClick={handlePauseExecution}>
                    ⏸️ Pausar
                  </button>
                  <button className="btn-get-key-premium" onClick={handleStopExecution} style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}>
                    ⏹️ Parar
                  </button>
                </>
              )}
              {executionStatus.status === 'paused' && (
                <>
                  <button className="btn-get-key-premium" onClick={handleResumeExecution} style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#10b981' }}>
                    ▶️ Retomar
                  </button>
                  <button className="btn-get-key-premium" onClick={handleStopExecution} style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}>
                    ⏹️ Parar
                  </button>
                </>
              )}
            </div>

            {executionStatus.logs.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#fff' }}>Log de Execução</h4>
                  <span style={{ fontSize: '11px', color: '#666' }}>
                    {executionStatus.logs.length} entr{executionStatus.logs.length !== 1 ? 'ies' : 'y'}
                  </span>
                </div>
                <div style={{ maxHeight: '400px', overflowY: 'auto', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', padding: '12px', fontFamily: 'monospace', fontSize: '11px' }}>
                  {executionStatus.logs.slice(-50).map((log, idx) => {
                    const isLast = idx === executionStatus.logs.slice(-50).length - 1;
                    const bgColor = log.level === 'error' ? 'rgba(239, 68, 68, 0.1)' :
                      log.level === 'success' ? 'rgba(16, 185, 129, 0.1)' :
                        log.level === 'warning' ? 'rgba(255, 152, 0, 0.1)' :
                          'transparent';
                    const textColor = log.level === 'error' ? '#ef4444' :
                      log.level === 'success' ? '#10b981' :
                        log.level === 'warning' ? '#ff9800' :
                          '#ccc';
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          gap: '12px',
                          padding: '8px',
                          marginBottom: '4px',
                          borderRadius: '4px',
                          background: bgColor,
                          border: isLast ? '1px solid rgba(99, 102, 241, 0.3)' : 'none',
                          color: textColor,
                        }}
                      >
                        <span style={{ color: '#666', minWidth: '70px', flexShrink: 0 }}>
                          {new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span style={{ flex: 1, wordBreak: 'break-word' }}>{log.message}</span>
                        {log.level && (
                          <span style={{
                            fontSize: '9px',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            background: bgColor,
                            border: `1px solid ${textColor}40`,
                            textTransform: 'uppercase',
                            fontWeight: 600,
                          }}>
                            {log.level}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
