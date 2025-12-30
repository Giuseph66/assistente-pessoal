import { useEffect, useState } from 'react';

interface RecordingItem {
  filePath: string;
  fileUrl: string;
  fileName: string;
  size: number;
  createdAt: number;
}

export function RecordingsPanel(): JSX.Element {
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const loadRecordings = async () => {
    setIsLoading(true);
    try {
      const result = await window.electron?.ipcRenderer.invoke('audio:list');
      setRecordings(Array.isArray(result) ? result : []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRecordings();
  }, []);

  useEffect(() => {
    recordings.forEach((recording) => {
      if (audioUrls[recording.filePath]) return;
      (async () => {
        try {
          const result = await window.electron?.ipcRenderer.invoke('audio:read', {
            filePath: recording.filePath,
          });
          if (!result?.buffer) return;
          const blob = new Blob([result.buffer], { type: result.mimeType || 'audio/webm' });
          const url = URL.createObjectURL(blob);
          setAudioUrls((prev) => ({ ...prev, [recording.filePath]: url }));
        } catch {
          // ignore and fallback to fileUrl
        }
      })();
    });
  }, [recordings, audioUrls]);

  useEffect(() => {
    return () => {
      Object.values(audioUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [audioUrls]);

  useEffect(() => {
    recordings.forEach((recording) => {
      if (durations[recording.filePath]) return;
      const src = audioUrls[recording.filePath] || recording.fileUrl;
      if (!src) return;
      const audio = new Audio(src);
      audio.preload = 'metadata';
      audio.load();
      audio.addEventListener('loadedmetadata', () => {
        setDurations((prev) => ({
          ...prev,
          [recording.filePath]: audio.duration,
        }));
      });
    });
  }, [recordings, durations, audioUrls]);

  return (
    <div className="recordings-panel">
      <div className="panel-header">
        <h3>Audios gravados</h3>
        <button className="refresh-button" type="button" onClick={loadRecordings}>
          Atualizar
        </button>
      </div>
      <div className="recordings-content">
        {isLoading && <p className="panel-hint">Carregando...</p>}
        {!isLoading && recordings.length === 0 && (
          <p className="panel-hint">Nenhum audio gravado ainda.</p>
        )}
        {recordings.map((recording) => (
          <div key={recording.filePath} className="recording-card">
            <div className="recording-header">
              <div className="recording-title">{recording.fileName}</div>
              <div className="recording-meta">
                {durations[recording.filePath]
                  ? `${durations[recording.filePath].toFixed(2)}s`
                  : '...'}
              </div>
            </div>
            <audio
              controls
              preload="metadata"
              src={audioUrls[recording.filePath] || recording.fileUrl}
              className="recording-audio"
            >
              Seu navegador nao suporta o player de audio.
            </audio>
          </div>
        ))}
      </div>
    </div>
  );
}
