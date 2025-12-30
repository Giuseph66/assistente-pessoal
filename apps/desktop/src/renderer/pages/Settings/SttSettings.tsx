import { useEffect, useMemo, useState } from 'react';
import { InstalledModel, ModelDescriptor, STTConfig, STTStatus } from '@ricky/shared';
import { StatusBadge } from '../../components/StatusBadge';
import { ModelInstaller } from './ModelInstaller';

const defaultStatus: STTStatus = { state: 'idle' };

export function SttSettings(): JSX.Element {
  const [status, setStatus] = useState<STTStatus>(defaultStatus);
  const [config, setConfig] = useState<STTConfig | null>(null);
  const [installed, setInstalled] = useState<InstalledModel[]>([]);
  const [catalog, setCatalog] = useState<ModelDescriptor[]>([]);
  const [activeModelId, setActiveModelId] = useState('');
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [importPath, setImportPath] = useState('');
  const [importLanguage, setImportLanguage] = useState('pt-BR');
  const [importLabel, setImportLabel] = useState('');
  const [languageFilter, setLanguageFilter] = useState('all');
  const hasActiveModel = Boolean(activeModelId);

  useEffect(() => {
    const loadData = async () => {
      const [statusValue, configValue, installedValue, catalogValue, activeValue] = await Promise.all([
        window.stt.getStatus(),
        window.stt.getConfig(),
        window.models.listInstalled(),
        window.models.listCatalog(),
        window.models.getActive(),
      ]);
      setStatus(statusValue || defaultStatus);
      setConfig(configValue);
      setInstalled(installedValue || []);
      setCatalog(catalogValue || []);
      setActiveModelId(activeValue || '');
    };

    loadData();

    const offStatus = window.stt.onStatus((nextStatus) => setStatus(nextStatus));
    const offError = window.stt.onError((payload) => setError(payload.message));
    const offProgress = window.models.onInstallProgress((payload) =>
      setProgress((prev) => ({ ...prev, [payload.modelId]: payload.progress }))
    );
    const offDone = window.models.onInstallDone(() => refreshModels());
    const offInstallError = window.models.onInstallError((payload) => setError(payload.message));

    return () => {
      offStatus();
      offError();
      offProgress();
      offDone();
      offInstallError();
    };
  }, []);

  const refreshModels = async () => {
    const [installedValue, activeValue] = await Promise.all([
      window.models.listInstalled(),
      window.models.getActive(),
    ]);
    setInstalled(installedValue || []);
    setActiveModelId(activeValue || '');
  };

  const languageOptions = useMemo(() => {
    const languages = new Set(catalog.map((model) => model.language));
    return Array.from(languages);
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    if (languageFilter === 'all') return catalog;
    return catalog.filter((model) => model.language === languageFilter);
  }, [catalog, languageFilter]);

  const handleConfigChange = async (patch: Partial<STTConfig>) => {
    if (!config) return;
    const updated = await window.stt.updateConfig(patch);
    setConfig(updated);
  };

  const handleStart = async () => {
    try {
      await window.stt.start();
    } catch (err: any) {
      setError(err?.message || 'Falha ao iniciar STT');
    }
  };
  const handleStop = () => window.stt.stop();

  const handleInstall = async (modelId: string) => {
    setError(null);
    await window.models.install(modelId);
    await refreshModels();
  };

  const handleRemove = async (modelId: string) => {
    setError(null);
    await window.models.remove(modelId);
    await refreshModels();
  };

  const handleSetActive = async (modelId: string) => {
    setError(null);
    await window.models.setActive(modelId);
    setActiveModelId(modelId);
    await window.stt.updateConfig({ modelId });
  };

  const handleImport = async () => {
    if (!importPath.trim()) return;
    setError(null);
    await window.models.import(importPath.trim(), {
      language: importLanguage,
      label: importLabel.trim() || undefined,
    });
    setImportPath('');
    setImportLabel('');
    await refreshModels();
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
          <button className="secondary-button" onClick={handleImport}>
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
