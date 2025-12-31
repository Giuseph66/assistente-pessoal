import { useMemo, useState } from 'react';
import { StatusBadge } from '../../components/StatusBadge';
import { ModelInstaller } from './ModelInstaller';
import { useVoskSettings } from './useVoskSettings';

export function SttSettings(): JSX.Element {
  const [importPath, setImportPath] = useState('');
  const [importLanguage, setImportLanguage] = useState('pt-BR');
  const [importLabel, setImportLabel] = useState('');
  const [languageFilter, setLanguageFilter] = useState('all');

  const {
    status,
    config,
    installed,
    catalog,
    activeModelId,
    progress,
    error,
    setError,
    handleConfigChange,
    handleInstall,
    handleRemove,
    handleSetActive,
    handleImport,
  } = useVoskSettings();

  const hasActiveModel = Boolean(activeModelId);

  const languageOptions = useMemo(() => {
    const languages = new Set(catalog.map((model) => model.language));
    return Array.from(languages);
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    if (languageFilter === 'all') return catalog;
    return catalog.filter((model) => model.language === languageFilter);
  }, [catalog, languageFilter]);

  const handleStart = async () => {
    try {
      await window.stt.start();
    } catch (err: any) {
      setError(err?.message || 'Falha ao iniciar STT');
    }
  };
  const handleStop = () => window.stt.stop();

  const handleImportClick = async () => {
    if (!importPath.trim()) return;
    await handleImport(importPath, {
      language: importLanguage,
      label: importLabel.trim() || undefined,
    });
    setImportPath('');
    setImportLabel('');
  };

  return (
    <div className="settings-panel">
      <div className="settings-section">
        <div className="section-header">
          <h3>Transcricao (Vosk)</h3>
          <StatusBadge status={status} />
        </div>
        {status.state === 'error' && <div className="error-banner">{status.message}</div>}
        {error && <div className="error-banner">{error}</div>}
        <div className="settings-row">
          <button
            className="primary-button"
            onClick={handleStart}
            disabled={status.state === 'running' || !hasActiveModel}
          >
            Iniciar
          </button>
          <button className="secondary-button" onClick={handleStop} disabled={status.state !== 'running'}>
            Parar
          </button>
        </div>
        {!hasActiveModel && (
          <div className="settings-hint">Selecione um modelo instalado para iniciar.</div>
        )}
      </div>

      <div className="settings-section">
        <h4>Modelo ativo</h4>
        <div className="settings-row">
          <select
            className="settings-select"
            value={activeModelId}
            onChange={(event) => handleSetActive(event.target.value)}
          >
            <option value="">Selecione um modelo</option>
            {installed.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
        </div>
        <div className="settings-row">
          <input
            className="settings-input"
            value={importPath}
            placeholder="Importar modelo (pasta local)"
            onChange={(event) => setImportPath(event.target.value)}
          />
          <input
            className="settings-input"
            value={importLabel}
            placeholder="Label (opcional)"
            onChange={(event) => setImportLabel(event.target.value)}
          />
          <select
            className="settings-select"
            value={importLanguage}
            onChange={(event) => setImportLanguage(event.target.value)}
          >
            <option value="pt-BR">pt-BR</option>
            <option value="en-US">en-US</option>
          </select>
          <button className="secondary-button" onClick={handleImportClick}>
            Importar
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h4>Catalogo</h4>
        <div className="settings-row">
          <label className="settings-label">
            <span>Idioma</span>
            <select
              className="settings-select"
              value={languageFilter}
              onChange={(event) => setLanguageFilter(event.target.value)}
            >
              <option value="all">Todos</option>
              {languageOptions.map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </select>
          </label>
        </div>
        <ModelInstaller
          catalog={filteredCatalog}
          installed={installed}
          activeModelId={activeModelId}
          progress={progress}
          onInstall={handleInstall}
          onRemove={handleRemove}
          onSetActive={handleSetActive}
        />
      </div>

      <div className="settings-section">
        <h4>Configuracoes avancadas</h4>
        <div className="settings-grid">
          <label className="settings-label">
            <span>Partial (parcial)</span>
            <input
              type="checkbox"
              checked={config?.enablePartial ?? true}
              onChange={(event) => handleConfigChange({ enablePartial: event.target.checked })}
            />
          </label>
          <label className="settings-label">
            <span>Debounce parcial (ms)</span>
            <input
              type="number"
              className="settings-input"
              value={config?.partialDebounceMs ?? 200}
              onChange={(event) =>
                handleConfigChange({ partialDebounceMs: Number(event.target.value || 0) })
              }
            />
          </label>
          <label className="settings-label">
            <span>Segmento max (s)</span>
            <input
              type="number"
              className="settings-input"
              value={config?.maxSegmentSeconds ?? 15}
              onChange={(event) =>
                handleConfigChange({ maxSegmentSeconds: Number(event.target.value || 1) })
              }
            />
          </label>
          <label className="settings-label">
            <span>Sample rate</span>
            <input
              type="number"
              className="settings-input"
              value={config?.sampleRate ?? 16000}
              onChange={(event) =>
                handleConfigChange({ sampleRate: Number(event.target.value || 16000) })
              }
            />
          </label>
        </div>
        <div className="settings-hint">
          Modelos recomendados: {languageOptions.join(' / ')}
        </div>
      </div>
    </div>
  );
}
