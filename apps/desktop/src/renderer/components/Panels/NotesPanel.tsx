import { useState, useEffect } from 'react';

export function NotesPanel(): JSX.Element {
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Carrega notas iniciais (via WebSocket ou IPC)
  useEffect(() => {
    // TODO: Carregar notas do database via WebSocket
  }, []);

  // Auto-save com debounce
  useEffect(() => {
    if (!content.trim()) return;

    const timer = setTimeout(() => {
      setIsSaving(true);
      // TODO: Salvar via WebSocket
      setTimeout(() => setIsSaving(false), 500);
    }, 1000);

    return () => clearTimeout(timer);
  }, [content]);

  return (
    <div className="notes-panel">
      <div className="panel-header">
        <h3>Notas</h3>
        {isSaving && <span className="saving-indicator">Salvando...</span>}
      </div>
      <textarea
        className="notes-editor"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Digite suas notas aqui..."
        style={{
          width: '100%',
          height: '100%',
          minHeight: '300px',
          background: 'transparent',
          border: 'none',
          color: '#e0e0e0',
          fontSize: '14px',
          fontFamily: 'inherit',
          resize: 'none',
          outline: 'none',
          padding: '8px',
        }}
      />
    </div>
  );
}

