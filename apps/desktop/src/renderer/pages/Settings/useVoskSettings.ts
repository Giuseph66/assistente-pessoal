import { useEffect, useState, useCallback } from 'react';
import { InstalledModel, ModelDescriptor, STTConfig, STTStatus } from '@ricky/shared';

const defaultStatus: STTStatus = { state: 'idle' };

export function useVoskSettings() {
  const [status, setStatus] = useState<STTStatus>(defaultStatus);
  const [config, setConfig] = useState<STTConfig | null>(null);
  const [installed, setInstalled] = useState<InstalledModel[]>([]);
  const [catalog, setCatalog] = useState<ModelDescriptor[]>([]);
  const [activeModelId, setActiveModelId] = useState('');
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const refreshModels = useCallback(async () => {
    const [installedValue, activeValue] = await Promise.all([
      window.models.listInstalled(),
      window.models.getActive(),
    ]);
    setInstalled(installedValue || []);
    setActiveModelId(activeValue || '');
  }, []);

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
  }, [refreshModels]);

  const handleConfigChange = useCallback(async (patch: Partial<STTConfig>) => {
    if (!config) return;
    const updated = await window.stt.updateConfig(patch);
    setConfig(updated);
  }, [config]);

  const handleInstall = useCallback(async (modelId: string) => {
    setError(null);
    await window.models.install(modelId);
    await refreshModels();
  }, [refreshModels]);

  const handleRemove = useCallback(async (modelId: string) => {
    setError(null);
    await window.models.remove(modelId);
    await refreshModels();
  }, [refreshModels]);

  const handleSetActive = useCallback(async (modelId: string) => {
    setError(null);
    await window.models.setActive(modelId);
    setActiveModelId(modelId);
    await window.stt.updateConfig({ modelId });
  }, []);

  const handleImport = useCallback(async (path: string, options?: { language?: string; label?: string }) => {
    if (!path.trim()) return;
    setError(null);
    await window.models.import(path.trim(), options);
    await refreshModels();
  }, [refreshModels]);

  return {
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
    refreshModels,
  };
}

