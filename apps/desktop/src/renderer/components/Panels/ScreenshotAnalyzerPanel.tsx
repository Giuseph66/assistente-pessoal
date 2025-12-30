import { useState, useEffect, useRef } from 'react';
import { Screenshot } from '@ricky/shared';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  recognizedText?: string;
  createdAt: number;
}

interface Template {
  id: number;
  name: string;
  promptText: string;
  category?: string;
}

export function ScreenshotAnalyzerPanel(): JSX.Element {
  const [screenshot, setScreenshot] = useState<Screenshot | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<number | null>(null);

  useEffect(() => {
    loadTemplates();
    loadLatestScreenshot();
  }, []);

  useEffect(() => {
    if (screenshot) {
      loadImage();
      loadSession();
    }
  }, [screenshot]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const offStarted = window.ai.onAnalysisStarted((event) => {
      if (event.mode && event.mode !== 'screenshot') return;
      if (event.screenshotId === screenshot?.id) {
        setIsAnalyzing(true);
        setError(null);
      }
    });

    const offCompleted = window.ai.onAnalysisCompleted((event) => {
      if (event.mode && event.mode !== 'screenshot') return;
      if (event.screenshotId === screenshot?.id) {
        setIsAnalyzing(false);
        if (event.sessionId) {
          sessionIdRef.current = event.sessionId;
          loadMessages(event.sessionId);
        }
      }
    });

    const offError = window.ai.onAnalysisError((event) => {
      if (event.mode && event.mode !== 'screenshot') return;
      if (event.screenshotId === screenshot?.id) {
        setIsAnalyzing(false);
        setError(event.error);
      }
    });

    return () => {
      offStarted();
      offCompleted();
      offError();
    };
  }, [screenshot]);

  const loadLatestScreenshot = async () => {
    try {
      // Tenta obter o último screenshot via IPC
      const result = await window.electron?.ipcRenderer.invoke('screenshot:read', {
        filePath: '', // Será implementado para obter o último
      });
      // Por enquanto, vamos precisar de uma forma de obter o último screenshot
      // Isso pode ser feito via WebSocket ou IPC adicional
    } catch (err) {
      console.error('Failed to load latest screenshot:', err);
    }
  };

  const loadImage = async () => {
    if (!screenshot) return;

    try {
      const result = await window.electron?.ipcRenderer.invoke('screenshot:read', {
        filePath: screenshot.file_path,
      });

      if (result?.error === 'not_found') {
        setScreenshot(null);
        setImageUrl(null);
        return;
      }

      if (!result?.buffer) return;

      const blob = new Blob([result.buffer], { type: result.mimeType || 'image/png' });
      const url = URL.createObjectURL(blob);
      setImageUrl(url);
    } catch (err) {
      console.error('Failed to load screenshot image:', err);
    }
  };

  const loadTemplates = async () => {
    try {
      const templatesValue = await window.ai.getPromptTemplates();
      setTemplates(templatesValue || []);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const loadSession = async () => {
    if (!screenshot) return;

    try {
      const sessions = await window.ai.getSessions(screenshot.id);
      if (sessions.length > 0) {
        sessionIdRef.current = sessions[0].id;
        await loadMessages(sessions[0].id);
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  };

  const loadMessages = async (sessionId: number) => {
    try {
      const messagesValue = await window.ai.getMessages(sessionId);
      setMessages(
        messagesValue.map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          recognizedText: m.recognizedText,
          createdAt: m.createdAt,
        }))
      );
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const handleAnalyze = async () => {
    if (!screenshot || !prompt.trim() || isAnalyzing) return;

    setError(null);
    setIsAnalyzing(true);

    // Adiciona mensagem do usuário imediatamente
    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: prompt,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setPrompt('');

    try {
      const result = await window.ai.analyzeScreenshot({
        screenshotId: screenshot.id,
        prompt: prompt,
        sessionId: sessionIdRef.current || undefined,
      });

      if (!result.success) {
        setError(result.error || 'Falha na análise');
        setIsAnalyzing(false);
        return;
      }

      if (result.sessionId) {
        sessionIdRef.current = result.sessionId;
        await loadMessages(result.sessionId);
      }
    } catch (err: any) {
      setError(err?.message || 'Erro desconhecido');
      setIsAnalyzing(false);
    }
  };

  const handleExtractText = async () => {
    if (!screenshot || isAnalyzing) return;

    setError(null);
    setIsAnalyzing(true);
    setPrompt('Extraindo texto...');

    try {
      const result = await window.ai.extractText(screenshot.id);
      if (result.success && result.text) {
        setPrompt(result.text);
        // Também adiciona como mensagem
        const assistantMessage: Message = {
          id: Date.now(),
          role: 'assistant',
          content: result.text,
          createdAt: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        setError(result.error || 'Falha ao extrair texto');
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao extrair texto');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopyResponse = () => {
    const lastAssistantMessage = [...messages].reverse().find((m) => m.role === 'assistant');
    if (lastAssistantMessage) {
      navigator.clipboard.writeText(lastAssistantMessage.content);
      // TODO: Mostrar feedback visual
    }
  };

  const handleSaveAsNote = async () => {
    const lastAssistantMessage = [...messages].reverse().find((m) => m.role === 'assistant');
    if (lastAssistantMessage) {
      // TODO: Integrar com NotesPanel
      console.log('Saving as note:', lastAssistantMessage.content);
    }
  };

  const handleTemplateSelect = (template: Template) => {
    setPrompt(template.promptText);
    setSelectedTemplate(template.id.toString());
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (!screenshot) {
    return (
      <div className="screenshot-analyzer-panel" style={{ padding: '20px' }}>
        <p style={{ color: '#999', fontStyle: 'italic' }}>
          Nenhum screenshot selecionado. Tire um screenshot ou selecione um do histórico.
        </p>
      </div>
    );
  }

  return (
    <div className="screenshot-analyzer-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header" style={{ padding: '10px', borderBottom: '1px solid #444' }}>
        <h3>Análise de Screenshot</h3>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Preview da imagem */}
        <div style={{ width: '300px', padding: '10px', borderRight: '1px solid #444', overflow: 'auto' }}>
          {imageUrl && (
            <img
              src={imageUrl}
              alt="Screenshot"
              style={{
                width: '100%',
                maxHeight: '400px',
                objectFit: 'contain',
                borderRadius: '4px',
                marginBottom: '10px',
              }}
            />
          )}
          <div style={{ fontSize: '12px', color: '#999' }}>
            {screenshot.width} × {screenshot.height}
          </div>
        </div>

        {/* Área de chat */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Templates */}
          {templates.length > 0 && (
            <div style={{ padding: '10px', borderBottom: '1px solid #444', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    backgroundColor: selectedTemplate === template.id.toString() ? '#1976d2' : '#2d2d2d',
                    color: '#fff',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  {template.name}
                </button>
              ))}
            </div>
          )}

          {/* Mensagens */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            {messages.length === 0 ? (
              <p style={{ color: '#999', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>
                Nenhuma mensagem ainda. Digite um prompt e clique em "Analisar".
              </p>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  style={{
                    padding: '10px',
                    backgroundColor: message.role === 'user' ? '#1976d2' : '#2d2d2d',
                    borderRadius: '8px',
                    alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '80%',
                  }}
                >
                  <div style={{ fontSize: '12px', color: '#999', marginBottom: '5px' }}>
                    {message.role === 'user' ? 'Você' : 'Assistente'}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
                  {message.recognizedText && message.role === 'assistant' && (
                    <div
                      style={{
                        marginTop: '8px',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        fontSize: '12px',
                        color: '#d6d6d6',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#9aa0a6',
                          marginBottom: '4px',
                        }}
                      >
                        Texto reconhecido
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{message.recognizedText}</div>
                    </div>
                  )}
                </div>
              ))
            )}
            {isAnalyzing && (
              <div
                style={{
                  padding: '10px',
                  backgroundColor: '#2d2d2d',
                  borderRadius: '8px',
                  alignSelf: 'flex-start',
                }}
              >
                <div style={{ fontSize: '12px', color: '#999', marginBottom: '5px' }}>Assistente</div>
                <div>Analisando...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Erro */}
          {error && (
            <div
              style={{
                padding: '10px',
                backgroundColor: '#d32f2f',
                color: '#fff',
                margin: '10px',
                borderRadius: '4px',
              }}
            >
              {error}
            </div>
          )}

          {/* Input e botões */}
          <div style={{ padding: '10px', borderTop: '1px solid #444' }}>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="O que você quer saber dessa imagem?"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  handleAnalyze();
                }
              }}
              style={{
                width: '100%',
                minHeight: '60px',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #444',
                backgroundColor: '#1e1e1e',
                color: '#e0e0e0',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical',
                marginBottom: '10px',
              }}
            />
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              <button
                onClick={handleAnalyze}
                disabled={!prompt.trim() || isAnalyzing}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#1976d2',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: prompt.trim() && !isAnalyzing ? 'pointer' : 'not-allowed',
                  opacity: prompt.trim() && !isAnalyzing ? 1 : 0.5,
                }}
              >
                {isAnalyzing ? 'Analisando...' : 'Analisar'}
              </button>
              <button
                onClick={handleExtractText}
                disabled={isAnalyzing}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#2e7d32',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                  opacity: isAnalyzing ? 0.5 : 1,
                }}
              >
                Extrair Texto
              </button>
              <button
                onClick={handleCopyResponse}
                disabled={messages.filter((m) => m.role === 'assistant').length === 0}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#666',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Copiar Resposta
              </button>
              <button
                onClick={handleSaveAsNote}
                disabled={messages.filter((m) => m.role === 'assistant').length === 0}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#666',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Salvar como Nota
              </button>
            </div>
            <div style={{ fontSize: '11px', color: '#999', marginTop: '5px' }}>
              Pressione Ctrl+Enter para analisar
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
