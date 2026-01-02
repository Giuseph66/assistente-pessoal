import { useEffect, useState } from 'react';
import './TextHighlightOutput.css';

type TextHighlightTranscription = {
  text: string;
  mode: 'local' | 'ai';
  createdAt: number;
};

const formatDate = (timestamp: number): string => {
  try {
    return new Date(timestamp).toLocaleString('pt-BR');
  } catch {
    return '';
  }
};

export function TextHighlightOutput(): JSX.Element {
  const [payload, setPayload] = useState<TextHighlightTranscription | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let timeout: number | null = null;
    const offTranscription = window.textHighlightAPI?.onTranscription((next) => {
      setPayload(next);
      setCopied(false);
    });

    window.textHighlightAPI?.getLastTranscription?.().then((last) => {
      if (last) {
        setPayload(last);
      }
    }).catch(() => undefined);

    return () => {
      offTranscription?.();
      if (timeout) {
        window.clearTimeout(timeout);
      }
    };
  }, []);

  const handleCopy = async () => {
    if (!payload?.text) return;
    try {
      await navigator.clipboard.writeText(payload.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  return (
    <div className="text-highlight-output">
      <header className="text-highlight-output__header">
        <div className="text-highlight-output__title">
          <h2>Transcrição da Tela</h2>
          <span className="text-highlight-output__meta">
            {payload ? `${payload.mode === 'ai' ? 'IA' : 'Local'} • ${formatDate(payload.createdAt)}` : 'Sem resultados'}
          </span>
        </div>
        <div className="text-highlight-output__actions">
          <button className="text-highlight-output__btn" onClick={handleCopy} disabled={!payload?.text}>
            {copied ? 'Copiado' : 'Copiar'}
          </button>
          <button
            className="text-highlight-output__btn ghost"
            onClick={() => window.electron.ipcRenderer.send('window:close')}
          >
            Fechar
          </button>
        </div>
      </header>

      <main className="text-highlight-output__body">
        {payload?.text ? (
          <pre className="text-highlight-output__text">{payload.text}</pre>
        ) : (
          <div className="text-highlight-output__empty">
            Nenhuma transcrição disponível ainda.
          </div>
        )}
      </main>
    </div>
  );
}
