import { useMemo, useState } from 'react';
import { SystemAudioSourceInfo } from '@ricky/shared';

type Props = {
  sources: SystemAudioSourceInfo[];
  selectedSourceId: string;
  onSelectSourceId: (value: string) => void;
  onDetectDefault: () => void;
  isRecording: boolean;
  isSttRunning: boolean;
  onRecordToggle: () => void;
  onSttToggle: () => void;
  onOpenFolder: () => void;
  onRefreshSources?: () => void;
};

export function SystemAudioControls({
  sources,
  selectedSourceId,
  onSelectSourceId,
  onDetectDefault,
  isRecording,
  isSttRunning,
  onRecordToggle,
  onSttToggle,
  onOpenFolder,
  onRefreshSources,
}: Props): JSX.Element {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const monitorSources = useMemo(
    () => sources.filter((source) => source.isMonitor),
    [sources]
  );

  const activeSource = monitorSources.find((source) => source.id === selectedSourceId);

  return (
    <div className="system-audio-block">
      <div className="system-audio-header">
        <div>
          <div className="section-title">Sistema</div>
          <div className="section-subtitle">
            Fonte: {activeSource?.name || selectedSourceId || 'monitor padrao'}
          </div>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setShowAdvanced((prev) => !prev)}
        >
          {showAdvanced ? 'Ocultar fonte' : 'Trocar fonte'}
        </button>
      </div>

      {showAdvanced && (
        <div className="system-audio-config">
          <label className="settings-label">
            Dispositivo
            <select
              className="settings-select"
              value={selectedSourceId}
              onChange={(event) => onSelectSourceId(event.target.value)}
            >
              <option value="">Selecione...</option>
              {monitorSources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name} ({source.id})
                </option>
              ))}
            </select>
          </label>
          <div className="system-audio-actions">
            <button type="button" className="secondary-button" onClick={onDetectDefault}>
              Detectar automaticamente
            </button>
            {onRefreshSources && (
              <button type="button" className="secondary-button" onClick={onRefreshSources}>
                Atualizar
              </button>
            )}
          </div>
        </div>
      )}

      <div className="system-audio-controls">
        <button
          className="primary-button"
          type="button"
          onClick={onRecordToggle}
        >
          {isRecording ? 'Parar gravacao' : 'Gravar audio do sistema'}
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={onSttToggle}
        >
          {isSttRunning ? 'Parar STT do sistema' : 'Iniciar STT do sistema'}
        </button>
        <button type="button" className="secondary-button" onClick={onOpenFolder}>
          Abrir gravacoes
        </button>
      </div>
    </div>
  );
}
