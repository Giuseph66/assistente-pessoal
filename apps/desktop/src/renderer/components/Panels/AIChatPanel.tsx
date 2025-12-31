import { useState, useEffect, useRef } from 'react';
import { Screenshot } from '@ricky/shared';
import './AIChatPanel.css';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  recognizedText?: string;
  screenshotId?: number;
  screenshotUrl?: string;
  createdAt: number;
}

export interface AIChatPanelProps {
  sessionId?: number | null;
}

export const AIChatPanel: React.FC<AIChatPanelProps> = ({ sessionId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [attachedScreenshot, setAttachedScreenshot] = useState<{ id: number; url: string } | null>(null);
  const [activeScreenshot, setActiveScreenshot] = useState<{ id: number; url: string } | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [providers, setProviders] = useState<Array<{ id: string; name: string }>>([]);
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([]);
  const [templates, setTemplates] = useState<Array<{ id: number; name: string; promptText: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [analysisMeta, setAnalysisMeta] = useState<{ startedAt: number; timeoutMs: number } | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [lastUsage, setLastUsage] = useState<{ tokensIn?: number; tokensOut?: number; model?: string; provider?: string; durationMs?: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatSessionIdRef = useRef<number | null>(null);
  const screenshotSessionIdRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachedUrlRef = useRef<string | null>(null);
  const activeUrlRef = useRef<string | null>(null);
  const analysisMetaRef = useRef<{ startedAt: number; timeoutMs: number } | null>(null);
  const configRef = useRef<any>(null);

  useEffect(() => {
    if (sessionId) {
      chatSessionIdRef.current = sessionId;
      loadMessages(sessionId);
    } else {
      setMessages([]);
      chatSessionIdRef.current = null;
    }
  }, [sessionId]);

  useEffect(() => {
    loadConfig();
    loadProviders();
    loadTemplates();
  }, []);

  useEffect(() => {
    if (config?.providerId) {
      loadModels(config.providerId);
    }
  }, [config?.providerId]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    attachedUrlRef.current = attachedScreenshot?.url || null;
  }, [attachedScreenshot]);

  useEffect(() => {
    activeUrlRef.current = activeScreenshot?.url || null;
  }, [activeScreenshot]);

  useEffect(() => {
    analysisMetaRef.current = analysisMeta;
  }, [analysisMeta]);

  useEffect(() => {
    return () => {
      if (attachedUrlRef.current) {
        URL.revokeObjectURL(attachedUrlRef.current);
      }
      if (activeUrlRef.current) {
        URL.revokeObjectURL(activeUrlRef.current);
      }
    };
  }, []);

  // Foca o textarea quando o painel é montado (apenas uma vez)
  useEffect(() => {
    // Pequeno delay para garantir que o DOM está pronto
    const timer = setTimeout(() => {
      if (textareaRef.current) {
        console.log('Attempting to focus textarea');
        textareaRef.current.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // STT Listeners
  useEffect(() => {
    if (!window.stt) return;

    const offPartial = window.stt.onPartial((event) => {
      if (event.text) {
        // We could show partial text somewhere, but for now let's just wait for final
      }
    });

    const offFinal = window.stt.onFinal((event) => {
      if (event.text) {
        setInput(prev => {
          const space = prev && !prev.endsWith(' ') ? ' ' : '';
          return prev + space + event.text;
        });
      }
    });

    const offStatus = window.stt.onStatus((status) => {
      setIsListening(status.state === 'running');
    });

    return () => {
      offPartial();
      offFinal();
      offStatus();
    };
  }, []);

  const toggleVoiceMode = async () => {
    if (!window.stt) return;
    try {
      if (isListening) {
        await window.stt.stop();
      } else {
        await window.stt.start();
      }
    } catch (err) {
      console.error('Failed to toggle voice mode:', err);
    }
  };

  useEffect(() => {
    const offStarted = window.ai.onAnalysisStarted((event) => {
      setIsAnalyzing(true);
      setError(null);
      setLastUsage(null);
      setElapsedMs(0);
      const fallbackTimeout = configRef.current?.timeoutMs || 30000;
      setAnalysisMeta({
        startedAt: event.startedAt || Date.now(),
        timeoutMs: event.timeoutMs || fallbackTimeout,
      });
    });

    const offCompleted = window.ai.onAnalysisCompleted((event) => {
      setIsAnalyzing(false);
      const meta = analysisMetaRef.current;
      if (meta?.startedAt) {
        const durationMs = Date.now() - meta.startedAt;
        setLastUsage({
          tokensIn: event.usage?.tokensIn,
          tokensOut: event.usage?.tokensOut,
          model: event.model,
          provider: event.provider,
          durationMs,
        });
      }
      setAnalysisMeta(null);
      if (event.mode === 'chat' && event.sessionId) {
        chatSessionIdRef.current = event.sessionId;
        loadMessages(event.sessionId);
      }
      if (event.mode === 'screenshot' && event.sessionId) {
        screenshotSessionIdRef.current = event.sessionId;
        loadMessages(event.sessionId);
      }
    });

    const offError = window.ai.onAnalysisError((event) => {
      setIsAnalyzing(false);
      setError(event.error);
      setAnalysisMeta(null);
    });

    return () => {
      offStarted();
      offCompleted();
      offError();
    };
  }, []);

  useEffect(() => {
    if (!isAnalyzing || !analysisMeta?.startedAt) {
      return;
    }

    const interval = setInterval(() => {
      setElapsedMs(Date.now() - analysisMeta.startedAt);
    }, 200);

    return () => clearInterval(interval);
  }, [isAnalyzing, analysisMeta]);

  const loadConfig = async () => {
    try {
      const configValue = await window.ai.getConfig();
      setConfig(configValue);
    } catch (err) {
      console.error('Failed to load config:', err);
    }
  };

  const loadProviders = async () => {
    try {
      const providersValue = await window.ai.listProviders();
      setProviders(providersValue || []);
    } catch (err) {
      console.error('Failed to load providers:', err);
    }
  };

  const loadModels = async (providerId: string) => {
    try {
      const modelsValue = await window.ai.listModels(providerId);
      setModels(modelsValue || []);
    } catch (err) {
      console.error('Failed to load models:', err);
    }
  };

  const loadMessages = async (sessionId: number) => {
    try {
      const messagesValue = await window.ai.getMessages(sessionId);
      const loadedMessages: Message[] = [];

      for (const msg of messagesValue) {
        const message: Message = {
          id: msg.id,
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          recognizedText: msg.recognizedText,
          createdAt: msg.createdAt,
        };

        // Se for mensagem do usuário, verifica se tem screenshot associado
        if (msg.role === 'user') {
          // Tenta encontrar screenshot na sessão
          // Por enquanto, vamos apenas carregar a mensagem
        }

        loadedMessages.push(message);
      }

      setMessages(loadedMessages);
    } catch (err) {
      console.error('Failed to load messages:', err);
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

  const handleSend = async () => {
    if (!input.trim() && !attachedScreenshot && !activeScreenshot) return;
    if (isAnalyzing) return;

    setError(null);

    const targetScreenshot = attachedScreenshot || activeScreenshot;
    const promptText = input.trim() || (targetScreenshot ? 'O que você vê nesta imagem?' : '');
    if (!promptText) {
      setError('Digite uma mensagem para continuar.');
      return;
    }

    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: promptText,
      screenshotId: targetScreenshot?.id,
      screenshotUrl: targetScreenshot?.url,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);

    setIsAnalyzing(true);
    try {
      if (targetScreenshot) {
        const result = await window.ai.analyzeScreenshot({
          screenshotId: targetScreenshot.id,
          prompt: promptText,
          sessionId: screenshotSessionIdRef.current || undefined,
        });

        if (result.success && result.sessionId) {
          screenshotSessionIdRef.current = result.sessionId;
          if (attachedScreenshot) {
            setActiveScreenshot((prev) => {
              if (prev?.url && prev.url !== attachedScreenshot.url) {
                URL.revokeObjectURL(prev.url);
              }
              return attachedScreenshot;
            });
            setAttachedScreenshot(null);
          }
          await loadMessages(result.sessionId);
        } else {
          setError(result.error || 'Falha na análise');
        }
      } else {
        const result = await window.ai.analyzeText({
          prompt: promptText,
          sessionId: chatSessionIdRef.current || undefined,
        });

        if (result.success && result.sessionId) {
          chatSessionIdRef.current = result.sessionId;
          await loadMessages(result.sessionId);
        } else {
          setError(result.error || 'Falha na análise');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Erro desconhecido');
    } finally {
      setIsAnalyzing(false);
    }

    setInput('');
  };

  const handleScreenshot = async () => {
    try {
      // Inicia captura de screenshot
      if (window.electron?.ipcRenderer) {
        window.electron.ipcRenderer.send('screenshot:startCapture');

        // Aguarda o screenshot ser capturado (via WebSocket ou polling)
        // Por enquanto, vamos usar um timeout e tentar obter o último screenshot
        setTimeout(async () => {
          try {
            // Tenta obter o último screenshot via IPC (precisa implementar endpoint)
            // Por enquanto, vamos usar uma abordagem diferente
            // O screenshot será capturado e podemos ouvir o evento
          } catch (err) {
            console.error('Failed to get screenshot:', err);
          }
        }, 1000);
      }
    } catch (err) {
      console.error('Failed to capture screenshot:', err);
    }
  };

  const handleFullscreenScreenshot = async () => {
    try {
      if (window.electron?.ipcRenderer) {
        await window.electron.ipcRenderer.invoke('screenshot:captureFullscreen');
      }
    } catch (err) {
      console.error('Failed to capture fullscreen screenshot:', err);
    }
  };

  const handleConfigSave = async () => {
    if (!config) return;
    try {
      const updated = await window.ai.saveConfig(config);
      setConfig(updated);
      setShowConfig(false);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Falha ao salvar configuração');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Listener para screenshots capturados (via WebSocket)
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      try {
        ws = new WebSocket('ws://127.0.0.1:8788');

        ws.onopen = () => {
          console.log('WebSocket connected for AI Chat');
        };

        ws.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'screenshot.captured' && data.payload?.screenshot) {
              const screenshot: Screenshot = data.payload.screenshot;

              // Carrega a imagem
              try {
                const result = await window.electron?.ipcRenderer.invoke('screenshot:read', {
                  filePath: screenshot.file_path,
                });

                if (result?.buffer) {
                  const blob = new Blob([result.buffer], { type: result.mimeType || 'image/png' });
                  const url = URL.createObjectURL(blob);

                  setAttachedScreenshot((prev) => {
                    if (prev?.url) {
                      URL.revokeObjectURL(prev.url);
                    }
                    return { id: screenshot.id, url };
                  });
                }
              } catch (err) {
                console.error('Failed to load screenshot:', err);
              }
            }
          } catch (err) {
            console.error('Failed to parse WebSocket message:', err);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
          console.log('WebSocket closed, reconnecting...');
          reconnectTimeout = setTimeout(connect, 3000);
        };
      } catch (err) {
        console.error('Failed to connect WebSocket:', err);
        reconnectTimeout = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="ai-chat-panel">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-title">
          <span className="logo-icon">✨</span>
          <span>My AI</span>
          <span className="model-badge">Gemini Pro</span>
        </div>
        <div className="header-actions">
          <button onClick={() => setShowConfig(true)} title="Configurações">
            ⚙️
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✨</div>
            <h3>Como posso ajudar hoje?</h3>
            <p>Faça uma pergunta ou anexe um screenshot para começar.</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`message ${message.role}`}>
              <div className={`avatar ${message.role}`}>
                {message.role === 'user' ? '👤' : '✨'}
              </div>
              <div className="message-content">
                {message.screenshotUrl && (
                  <div className="screenshot-attachment">
                    <img src={message.screenshotUrl} alt="Screenshot" />
                  </div>
                )}
                <div className="bubble">{message.content}</div>
                {message.recognizedText && message.role === 'assistant' && (
                  <div className="recognized-text">
                    <small>Texto reconhecido:</small>
                    <p>{message.recognizedText}</p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {isAnalyzing && (
          <div className="message ai">
            <div className="avatar ai">✨</div>
            <div className="message-content">
              <div className="bubble typing-indicator">Pensando...</div>
            </div>
          </div>
        )}

        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="input-area">
        <div className="input-container">
          {(attachedScreenshot || activeScreenshot) && (
            <div className="active-attachment">
              <img
                src={(attachedScreenshot || activeScreenshot)?.url}
                alt="Attachment"
              />
              <button
                className="remove-attachment"
                onClick={() => {
                  setAttachedScreenshot(null);
                  setActiveScreenshot(null);
                }}
              >
                ✕
              </button>
            </div>
          )}

          <div className="input-row">
            <div className="input-actions">
              <button
                className="action-btn"
                onClick={handleScreenshot}
                title="Capturar área"
              >
                📷
              </button>
              <button
                className="action-btn"
                onClick={handleFullscreenScreenshot}
                title="Capturar tela inteira"
              >
                🖥️
              </button>
            </div>

            <textarea
              ref={textareaRef}
              className="chat-input"
              placeholder="Envie uma mensagem..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />

            <button
              className={`action-btn send-btn ${input.trim() ? 'active' : ''}`}
              onClick={handleSend}
              disabled={!input.trim() && !attachedScreenshot && !activeScreenshot}
            >
              ➤
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
