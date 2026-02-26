import { useEffect, useMemo, useRef, useState } from 'react';
import { RecordingEntry, TranscribeProgress } from '@neo/shared';

type Props = {
  recordings: RecordingEntry[];
  onRefresh: () => void;
  onDelete: (recording: RecordingEntry) => void;
  onOpen: (recording: RecordingEntry) => void;
  onTranscribe: (recording: RecordingEntry) => void;
  transcribeProgress: (TranscribeProgress & { wavPath?: string }) | null;
};

const formatDuration = (durationMs?: number | null) => {
  if (!durationMs) return '--:--';
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export function RecordingsList({
  recordings,
  onRefresh,
  onDelete,
  onOpen,
  onTranscribe,
  transcribeProgress,
}: Props): JSX.Element {
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  useEffect(() => {
    if (!window.recorder) return;
    recordings.forEach((recording) => {
      if (audioUrls[recording.path]) return;
      window.recorder
        .getFileUrl(recording.path)
        .then((url) => {
          setAudioUrls((prev) => ({ ...prev, [recording.path]: url }));
        })
        .catch(() => undefined);
    });
  }, [recordings, audioUrls]);

  useEffect(() => {
    return () => {
      Object.values(audioUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [audioUrls]);

  const activeProgress = useMemo(() => {
    if (!transcribeProgress?.wavPath) return null;
    return transcribeProgress;
  }, [transcribeProgress]);

  const togglePlay = (path: string) => {
    const audio = audioRefs.current[path];
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => undefined);
    } else {
      audio.pause();
    }
  };

  return (
    <div className="recordings-panel">
      <div className="panel-header">
        <h3>Gravacoes do sistema</h3>
        <button className="refresh-button" type="button" onClick={onRefresh}>
          Atualizar
        </button>
      </div>
      <div className="recordings-content">
        {recordings.length === 0 && (
          <p className="panel-hint">Nenhuma gravacao do sistema ainda.</p>
        )}
        {recordings.map((recording) => {
          const progress =
            activeProgress && activeProgress.wavPath === recording.path
              ? activeProgress
              : null;
          return (
            <div key={recording.path} className="recording-card">
              <div className="recording-header">
                <div className="recording-title">{recording.path.split('/').pop()}</div>
                <div className="recording-meta">
                  {formatDuration(recording.durationMs)}
                </div>
              </div>
              <audio
                ref={(node) => {
                  audioRefs.current[recording.path] = node;
                }}
                src={audioUrls[recording.path]}
                preload="metadata"
                className="recording-audio"
                controls
              />
              <div className="recording-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => togglePlay(recording.path)}
                >
                  Play/Pause
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => onOpen(recording)}
                >
                  Abrir
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => onDelete(recording)}
                >
                  Excluir
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => onTranscribe(recording)}
                >
                  Transcrever
                </button>
              </div>
              {progress && (
                <div className="recording-progress">
                  Transcrevendo: {progress.percent}%
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
