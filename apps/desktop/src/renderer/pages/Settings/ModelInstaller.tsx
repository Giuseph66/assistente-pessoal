import { useMemo } from 'react';
import { InstalledModel, ModelDescriptor } from '@neo/shared';

type Props = {
  catalog: ModelDescriptor[];
  installed: InstalledModel[];
  activeModelId: string;
  progress: Record<string, number>;
  onInstall: (modelId: string) => void;
  onRemove: (modelId: string) => void;
  onSetActive: (modelId: string) => void;
};

export function ModelInstaller({
  catalog,
  installed,
  activeModelId,
  progress,
  onInstall,
  onRemove,
  onSetActive,
}: Props): JSX.Element {
  const installedIds = useMemo(() => new Set(installed.map((model) => model.id)), [installed]);

  return (
    <div className="model-installer">
      {catalog.map((model) => {
        const isInstalled = installedIds.has(model.id);
        const progressValue = progress[model.id];
        return (
          <div key={model.id} className="model-card">
            <div className="model-info">
              <div className="model-title">{model.label}</div>
              <div className="model-meta">
                <span>{model.language}</span>
                {model.sizeMB ? <span>{model.sizeMB}MB</span> : null}
                {model.accuracyHint ? <span>{model.accuracyHint}</span> : null}
              </div>
            </div>
            <div className="model-actions">
              {isInstalled ? (
                <>
                  <button
                    className={`model-button ${activeModelId === model.id ? 'active' : ''}`}
                    onClick={() => onSetActive(model.id)}
                  >
                    {activeModelId === model.id ? 'Ativo' : 'Selecionar'}
                  </button>
                  <button className="model-button secondary" onClick={() => onRemove(model.id)}>
                    Remover
                  </button>
                </>
              ) : (
                <button className="model-button" onClick={() => onInstall(model.id)}>
                  Instalar
                </button>
              )}
              {typeof progressValue === 'number' && (
                <div className="model-progress">{progressValue}%</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
