import { useEffect, useMemo, useRef, useState } from 'react';
import { SubtitleSegment } from '@ricky/shared';

type Props = {
  wavPath: string;
  audioUrl: string;
  segments: SubtitleSegment[];
  onSave: (segments: SubtitleSegment[]) => Promise<void>;
  onClose: () => void;
};

const formatMs = (value: number) => (value / 1000).toFixed(2);

export function SubtitleEditor({ wavPath, audioUrl, segments, onSave, onClose }: Props): JSX.Element {
  const [draft, setDraft] = useState<SubtitleSegment[]>(segments);
  const [isSaving, setIsSaving] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setDraft(segments);
  }, [segments]);

  const handleChange = (index: number, patch: Partial<SubtitleSegment>) => {
    setDraft((prev) =>
      prev.map((segment, idx) => (idx === index ? { ...segment, ...patch } : segment))
    );
  };

  const handleSeek = (startMs: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = startMs / 1000;
    audioRef.current.play().catch(() => undefined);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(draft);
    } finally {
      setIsSaving(false);
    }
  };

  const duration = useMemo(() => {
    if (draft.length === 0) return 0;
    return Math.max(...draft.map((item) => item.endMs));
  }, [draft]);

  return (
    <div className="subtitle-editor">
      <div className="subtitle-header">
        <div>
          <div className="section-title">Legendas estilo Amara.org</div>
          <div className="section-subtitle">Arquivo: {wavPath.split('/').pop()}</div>
        </div>
        <div className="subtitle-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Fechar
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Salvando...' : 'Salvar ajustes'}
          </button>
        </div>
      </div>
      <audio ref={audioRef} controls src={audioUrl} className="recording-audio" />
      <div className="subtitle-summary">Duracao aproximada: {formatMs(duration)}s</div>
      <div className="subtitle-list">
        {draft.length === 0 && <p className="panel-hint">Sem segmentos.</p>}
        {draft.map((segment, index) => (
          <div key={`${segment.startMs}-${index}`} className="subtitle-card">
            <div className="subtitle-row">
              <label className="settings-label">
                Inicio (s)
                <input
                  className="settings-input"
                  value={formatMs(segment.startMs)}
                  onChange={(event) =>
                    handleChange(index, { startMs: Number(event.target.value) * 1000 })
                  }
                />
              </label>
              <label className="settings-label">
                Fim (s)
                <input
                  className="settings-input"
                  value={formatMs(segment.endMs)}
                  onChange={(event) =>
                    handleChange(index, { endMs: Number(event.target.value) * 1000 })
                  }
                />
              </label>
              <button
                type="button"
                className="secondary-button"
                onClick={() => handleSeek(segment.startMs)}
              >
                Ouvir
              </button>
            </div>
            <textarea
              className="settings-input subtitle-text"
              value={segment.text}
              onChange={(event) => handleChange(index, { text: event.target.value })}
              rows={2}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
