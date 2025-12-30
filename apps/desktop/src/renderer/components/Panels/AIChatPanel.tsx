import { useState, useEffect, useRef } from 'react';
import { Screenshot } from '@ricky/shared';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  recognizedText?: string;
  screenshotId?: number;
  screenshotUrl?: string;
  createdAt: number;
}

export function AIChatPanel(): JSX.Element {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [attachedScreenshot, setAttachedScreenshot] = useState<{ id: number; url: string } | null>(null);
  const [activeScreenshot, setActiveScreenshot] = useState<{ id: number; url: string } | null>(null);
  const [showConfig, setShowConfig] = useState(false);
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

  return (
    <div 
      className="ai-chat-panel" 
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%',
        WebkitAppRegion: 'no-drag',
        position: 'relative',
        margin: '-12px', // Remove padding do overlay-content
        padding: '0',
      }}
      onMouseDown={(e) => {
        // Permite interação dentro do painel
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      {/* Header */}
      <div className="panel-header" style={{ padding: '12px', borderBottom: '1px solid #444', display: 'flex', justifyContent: 'space-between', alignItems: 'center', WebkitAppRegion: 'no-drag' }}>
        <h3 style={{ margin: 0 }}>My AI</h3>
        <button
          onClick={() => setShowConfig(true)}
          style={{
            padding: '4px 8px',
            backgroundColor: 'transparent',
            border: '1px solid #444',
            borderRadius: '4px',
            color: '#e0e0e0',
            cursor: 'pointer',
            fontSize: '14px',
          }}
          title="Configurações"
        >
          ⚙️
        </button>
      </div>

      {/* Mensagens */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          WebkitAppRegion: 'no-drag',
        }}
      >
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', marginTop: '40px' }}>
            <p>Olá! Sou seu assistente de IA.</p>
            <p style={{ fontSize: '12px', marginTop: '10px' }}>
              Anexe uma screenshot ou digite uma mensagem para começar.
            </p>
          </div>
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
              {message.screenshotUrl && (
                <img
                  src={message.screenshotUrl}
                  alt="Screenshot"
                  style={{
                    width: '100%',
                    maxWidth: '300px',
                    borderRadius: '4px',
                    marginBottom: '8px',
                  }}
                />
              )}
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
                  <div style={{ fontSize: '11px', color: '#9aa0a6', marginBottom: '4px' }}>
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
            <div>Pensando...</div>
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
            margin: '0 10px',
            borderRadius: '4px',
            fontSize: '12px',
          }}
        >
          {error}
        </div>
      )}

      {(isAnalyzing || lastUsage) && (
        <div
          style={{
            padding: '8px 12px',
            borderTop: '1px solid #444',
            borderBottom: '1px solid #444',
            backgroundColor: '#1a1a1a',
            fontSize: '12px',
            color: '#cfcfcf',
          }}
        >
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '6px' }}>
            {isAnalyzing && analysisMeta && (
              <span>
                Tempo: {(elapsedMs / 1000).toFixed(1)}s / {(analysisMeta.timeoutMs / 1000).toFixed(0)}s
              </span>
            )}
            {lastUsage && (
              <>
                <span>Tokens: {lastUsage.tokensIn ?? '-'} / {lastUsage.tokensOut ?? '-'}</span>
                {lastUsage.model && <span>Modelo: {lastUsage.model}</span>}
                {lastUsage.provider && <span>Provider: {lastUsage.provider}</span>}
                {lastUsage.durationMs && <span>Duração: {(lastUsage.durationMs / 1000).toFixed(1)}s</span>}
              </>
            )}
          </div>
          {isAnalyzing && analysisMeta && (
            <div style={{ height: '6px', backgroundColor: '#2d2d2d', borderRadius: '999px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(96, Math.max(4, (elapsedMs / analysisMeta.timeoutMs) * 100))}%`,
                  backgroundColor: '#1976d2',
                  transition: 'width 0.2s ease',
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Screenshot anexado */}
      {(attachedScreenshot || activeScreenshot) && (
        <div
          style={{
            padding: '10px',
            borderTop: '1px solid #444',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <img
            src={(attachedScreenshot || activeScreenshot)?.url}
            alt="Screenshot anexado"
            style={{
              width: '60px',
              height: '60px',
              objectFit: 'cover',
              borderRadius: '4px',
            }}
          />
          <div style={{ flex: 1, fontSize: '12px', color: '#999' }}>
            {attachedScreenshot ? 'Screenshot anexado' : 'Screenshot ativo'}
          </div>
          <button
            onClick={() => {
              if (attachedScreenshot?.url) {
                URL.revokeObjectURL(attachedScreenshot.url);
              }
              if (activeScreenshot?.url) {
                URL.revokeObjectURL(activeScreenshot.url);
              }
              setAttachedScreenshot(null);
              setActiveScreenshot(null);
              screenshotSessionIdRef.current = null;
            }}
            style={{
              padding: '4px 8px',
              backgroundColor: '#d32f2f',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Remover
          </button>
        </div>
      )}

      {/* Input */}
      <div 
        style={{ 
          padding: '12px', 
          borderTop: '1px solid #444',
          WebkitAppRegion: 'no-drag',
          position: 'relative',
          zIndex: 100,
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
          <button
            onClick={handleScreenshot}
            style={{
              padding: '8px 12px',
              backgroundColor: '#2e7d32',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
            title="Anexar Screenshot"
            type="button"
          >
            📷 Screenshot
          </button>
          <button
            onClick={handleFullscreenScreenshot}
            style={{
              padding: '8px 12px',
              backgroundColor: '#455a64',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
            title="Capturar tela inteira"
            type="button"
          >
            🖥️ Tela inteira
          </button>
          {templates.length > 0 && (
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {templates.slice(0, 4).map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setInput(template.promptText)}
                  style={{
                    padding: '6px 8px',
                    backgroundColor: '#2d2d2d',
                    color: '#fff',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px',
                  }}
                  title={template.name}
                >
                  {template.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '5px', WebkitAppRegion: 'no-drag' }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              const newValue = e.target.value;
              console.log('onChange triggered, new value:', newValue);
              setInput(newValue);
            }}
            onFocus={(e) => {
              console.log('Textarea focused');
              e.stopPropagation();
            }}
            onBlur={(e) => {
              console.log('Textarea blurred');
              e.stopPropagation();
            }}
            onClick={(e) => {
              console.log('Textarea clicked');
              e.stopPropagation();
              e.currentTarget.focus();
            }}
            onMouseDown={(e) => {
              console.log('Textarea mouseDown');
              e.stopPropagation();
            }}
            onKeyDown={(e) => {
              console.log('KeyDown pressed:', e.key, 'value:', e.currentTarget.value);
              e.stopPropagation();
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            onKeyUp={(e) => {
              console.log('KeyUp pressed:', e.key);
              e.stopPropagation();
            }}
            onInput={(e) => {
              console.log('onInput triggered');
              const target = e.target as HTMLTextAreaElement;
              setInput(target.value);
            }}
            placeholder="Digite sua mensagem..."
            disabled={isAnalyzing}
            autoFocus={false}
            spellCheck={true}
            style={{
              flex: 1,
              minHeight: '60px',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #444',
              backgroundColor: '#1e1e1e',
              color: '#e0e0e0',
              fontSize: '14px',
              fontFamily: 'inherit',
              resize: 'vertical',
              outline: 'none',
              WebkitAppRegion: 'no-drag',
              cursor: 'text',
              pointerEvents: 'auto',
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={handleSend}
            disabled={(!input.trim() && !attachedScreenshot && !activeScreenshot) || isAnalyzing}
            style={{
              padding: '8px 16px',
              backgroundColor: '#1976d2',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: (!input.trim() && !attachedScreenshot && !activeScreenshot) || isAnalyzing ? 'not-allowed' : 'pointer',
            opacity: (!input.trim() && !attachedScreenshot && !activeScreenshot) || isAnalyzing ? 0.5 : 1,
            alignSelf: 'flex-end',
          }}
          >
            Enviar
          </button>
        </div>
      </div>

      {/* Modal de Configurações */}
      {showConfig && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowConfig(false)}
        >
          <div
            style={{
              backgroundColor: '#1e1e1e',
              padding: '20px',
              borderRadius: '8px',
              maxWidth: '500px',
              width: '90%',
              border: '1px solid #444',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Configurações do Chat</h3>
            
            {config && (
              <>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Provedor</label>
                  <select
                    value={config.providerId}
                    onChange={async (e) => {
                      const newProviderId = e.target.value;
                      setConfig({ ...config, providerId: newProviderId });
                      await loadModels(newProviderId);
                      // Reseta o modelo para o primeiro disponível do novo provider
                      const newModels = await window.ai.listModels(newProviderId);
                      if (newModels.length > 0) {
                        setConfig({ ...config, providerId: newProviderId, modelName: newModels[0].id });
                      }
                    }}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2d2d2d', color: '#e0e0e0' }}
                  >
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Modelo</label>
                  <select
                    value={config.modelName}
                    onChange={(e) => setConfig({ ...config, modelName: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2d2d2d', color: '#e0e0e0' }}
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Otimização de imagem</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#e0e0e0' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(config.enableImageOptimization)}
                      onChange={(e) => setConfig({ ...config, enableImageOptimization: e.target.checked })}
                    />
                    Ativar otimização automática
                  </label>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '140px' }}>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Largura máx (px)</label>
                      <input
                        type="number"
                        value={config.maxImageDimension ?? 1280}
                        onChange={(e) => setConfig({ ...config, maxImageDimension: Number(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2d2d2d', color: '#e0e0e0' }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: '140px' }}>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Tamanho máx (MB)</label>
                      <input
                        type="number"
                        value={((config.maxImageBytes ?? 2500000) / 1_000_000).toFixed(1)}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            maxImageBytes: Math.max(0, Math.round(Number(e.target.value) * 1_000_000)),
                          })
                        }
                        style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2d2d2d', color: '#e0e0e0' }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: '140px' }}>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Qualidade (0-100)</label>
                      <input
                        type="number"
                        value={config.imageQuality ?? 80}
                        onChange={(e) =>
                          setConfig({ ...config, imageQuality: Number(e.target.value) || 80 })
                        }
                        style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2d2d2d', color: '#e0e0e0' }}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={() => setShowConfig(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#666',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfigSave}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#1976d2',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
