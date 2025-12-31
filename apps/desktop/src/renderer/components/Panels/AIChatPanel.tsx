import React, { useState, useEffect, useRef } from 'react';
import './AIChatPanel.css';
import {
  STTStatus,
  STTPartialEvent,
  STTFinalEvent,
  SystemAudioSourceInfo,
} from '@ricky/shared';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  imagePath?: string;
  imageBase64?: string;
  screenshotId?: number;
}

interface AIChatPanelProps {
  sessionId?: number | null;
}

const defaultStatus: STTStatus = { state: 'idle' };

export const AIChatPanel: React.FC<AIChatPanelProps> = ({ sessionId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // STT States
  const [systemSttStatus, setSystemSttStatus] = useState<STTStatus>(defaultStatus);
  const [micSttStatus, setMicSttStatus] = useState<STTStatus>(defaultStatus);
  const [systemSttPartial, setSystemSttPartial] = useState<string | null>(null);
  const [micSttPartial, setMicSttPartial] = useState<string | null>(null);
  const [systemSources, setSystemSources] = useState<SystemAudioSourceInfo[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [sttError, setSttError] = useState<string | null>(null);
  const [attachedImage, setAttachedImage] = useState<{ path: string; base64: string; screenshotId?: number } | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // AI Chat States
  const [activePersonality, setActivePersonality] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(sessionId || null);
  const currentSessionIdRef = useRef<number | null>(sessionId || null);
  const suppressStartedRef = useRef<{ prompt: string; sessionId: number | null } | null>(null);

  const mapMessages = (rows: any[]): Message[] =>
    rows
      .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
      .map((msg) => ({
        id: String(msg.id ?? `${msg.role}-${msg.createdAt}`),
        role: msg.role,
        content: msg.content || '',
        timestamp: msg.createdAt || Date.now(),
      }));

  const loadSessionMessages = async (targetSessionId: number, attempt: number = 0) => {
    if (!window.ai?.getMessages) return;
    try {
      const rows = await window.ai.getMessages(targetSessionId);
      const mapped = mapMessages(Array.isArray(rows) ? rows : []);
      setMessages(mapped);
      if (mapped.length === 0 && attempt < 3) {
        setTimeout(() => loadSessionMessages(targetSessionId, attempt + 1), 200);
      }
    } catch (error) {
      console.error('Failed to load session messages:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load initial messages or mock data
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  useEffect(() => {
    if (sessionId) {
      setCurrentSessionId(sessionId);
      loadSessionMessages(sessionId);
      return;
    }
    setCurrentSessionId(null);
    setMessages([
      { id: '1', role: 'assistant', content: 'Olá! Como posso ajudar você hoje?', timestamp: Date.now() }
    ]);
  }, [sessionId]);

  // Load configurations (personality and API config)
  useEffect(() => {
    loadConfigurations();
  }, []);

  const loadConfigurations = async () => {
    try {
      // Load active personality
      if (window.ai) {
        const personalityResult = await window.ai.getActivePersonality();
        if (personalityResult?.promptId) {
          const templates = await window.ai.getPromptTemplates('personality');
          const active = templates.find((t: any) => t.id === personalityResult.promptId);
          setActivePersonality(active || null);
        }
      }
    } catch (error) {
      console.error('Failed to load configurations:', error);
    }
  };

  // AI Analysis Event Listeners for Progress
  useEffect(() => {
    if (!window.ai) return;

    const offStarted = window.ai.onAnalysisStarted((event: any) => {
      setIsLoading(true);
      setProgress(20);
      if (event?.mode !== 'chat') return;

      const eventSessionId = typeof event.sessionId === 'number' ? event.sessionId : null;
      if (eventSessionId && !currentSessionIdRef.current) {
        setCurrentSessionId(eventSessionId);
      }

      const suppress = suppressStartedRef.current;
      if (suppress && suppress.prompt === event.prompt && suppress.sessionId === eventSessionId) {
        suppressStartedRef.current = null;
        return;
      }

      if (typeof event.prompt === 'string' && event.prompt.trim()) {
        const pendingMessage: Message = {
          id: `pending-${Date.now()}`,
          role: 'user',
          content: event.prompt,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, pendingMessage]);
      }

      setIsTyping(true);
    });

    const offCompleted = window.ai.onAnalysisCompleted((event: any) => {
      setProgress(100);
      setTimeout(() => {
        setIsLoading(false);
        setProgress(0);
      }, 300);
      setIsTyping(false);
      if (event?.mode === 'chat' && event.sessionId) {
        if (!currentSessionIdRef.current) {
          setCurrentSessionId(event.sessionId);
        }
        if (!currentSessionIdRef.current || event.sessionId === currentSessionIdRef.current) {
          loadSessionMessages(event.sessionId);
        }
      }
    });

    const offError = window.ai.onAnalysisError((event: any) => {
      setIsLoading(false);
      setProgress(0);
      setIsTyping(false);
      setSttError(event.error || 'Erro ao processar mensagem');
    });

    return () => {
      offStarted();
      offCompleted();
      offError();
    };
  }, []);

  // Load system audio sources
  const loadSystemSources = async () => {
    if (!window.systemAudio) return;
    try {
      const sources = await window.systemAudio.listSources();
      const nextSources = Array.isArray(sources) ? sources : [];
      setSystemSources(nextSources);
      const defaultSource = nextSources.find((source) => source.isDefaultCandidate)?.id;
      if (defaultSource && defaultSource !== selectedSourceId) {
        setSelectedSourceId(defaultSource);
      } else if (!selectedSourceId && nextSources.length > 0) {
        setSelectedSourceId(nextSources[0]?.id || '');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao listar dispositivos de audio';
      setSttError(message);
    }
  };

  const detectDefaultSource = async (): Promise<string | null> => {
    if (!window.systemAudio) return null;
    try {
      const sourceId = await window.systemAudio.detectDefaultMonitor();
      if (sourceId) {
        setSelectedSourceId(sourceId);
      }
      return sourceId || null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao detectar monitor padrao';
      setSttError(message);
    }
    return null;
  };

  // Initialize system audio sources
  useEffect(() => {
    loadSystemSources();
  }, []);

  // Clean STT text - remove UNK tokens and normalize
  const cleanSttText = (text: string): string => {
    if (!text) return '';
    // Remove <UNK>, <unk>, <UNK>, etc. (case insensitive) and surrounding spaces
    let cleaned = text.replace(/<UNK>/gi, '');
    // Remove multiple spaces and trim
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
  };

  // STT Microphone listeners
  useEffect(() => {
    if (!window.stt) return;
    window.stt.getStatus().then((status) => setMicSttStatus(status || defaultStatus));
    const offStatus = window.stt.onStatus((status) => setMicSttStatus(status));
    const offPartial = window.stt.onPartial((event: STTPartialEvent) => {
      const cleanedText = cleanSttText(event.text);
      if (cleanedText) {
        setMicSttPartial(cleanedText);
      } else {
        setMicSttPartial(null);
      }
      setSttError(null);
    });
    const offFinal = window.stt.onFinal((event: STTFinalEvent) => {
      const cleanedText = cleanSttText(event.text);
      if (cleanedText.trim()) {
        const currentText = inputValue.trim();
        const newText = currentText ? `${currentText} ${cleanedText}` : cleanedText;
        setInputValue(newText);
        setMicSttPartial(null);
        // Focus input and move cursor to end
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.setSelectionRange(newText.length, newText.length);
          }
        }, 0);
      } else {
        setMicSttPartial(null);
      }
      setSttError(null);
    });
    const offError = window.stt.onError((payload) => {
      setSttError(payload.message);
      setMicSttPartial(null);
    });
    return () => {
      offStatus();
      offPartial();
      offFinal();
      offError();
    };
  }, [inputValue]);

  // STT System listeners
  useEffect(() => {
    if (!window.systemStt) return;
    window.systemStt.getStatus().then((status) => setSystemSttStatus(status || defaultStatus));
    const offStatus = window.systemStt.onStatus((status) => {
      setSystemSttStatus(status);
      if (status.state === 'idle') {
        setSystemSttPartial(null);
      }
      if (status.state === 'error') {
        setSystemSttPartial(null);
      }
    });
    const offPartial = window.systemStt.onPartial((event: STTPartialEvent) => {
      const cleanedText = cleanSttText(event.text);
      if (cleanedText) {
        setSystemSttPartial(cleanedText);
      } else {
        setSystemSttPartial(null);
      }
      setSttError(null);
    });
    const offFinal = window.systemStt.onFinal((event: STTFinalEvent) => {
      const cleanedText = cleanSttText(event.text);
      if (cleanedText.trim()) {
        const currentText = inputValue.trim();
        const newText = currentText ? `${currentText} ${cleanedText}` : cleanedText;
        setInputValue(newText);
        setSystemSttPartial(null);
        // Focus input and move cursor to end
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.setSelectionRange(newText.length, newText.length);
          }
        }, 0);
      } else {
        setSystemSttPartial(null);
      }
      setSttError(null);
    });
    const offError = window.systemStt.onError((payload) => {
      setSttError(payload.message);
      setSystemSttPartial(null);
    });
    return () => {
      offStatus();
      offPartial();
      offFinal();
      offError();
    };
  }, [inputValue]);

  // Update cursor position when preview changes
  useEffect(() => {
    const hasPreview = !!(systemSttPartial || micSttPartial);
    if (!inputRef.current || !hasPreview) return;
    const activePartial = systemSttPartial || micSttPartial;
    const displayValue = inputValue + (inputValue && !inputValue.endsWith(' ') ? ' ' : '') + (activePartial || '');
    // Move cursor to end of preview
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.setSelectionRange(displayValue.length, displayValue.length);
      }
    }, 0);
  }, [systemSttPartial, micSttPartial, inputValue]);

  // STT Control Functions
  const toggleSystemStt = async () => {
    if (!window.systemStt) return;
    setSttError(null);

    const isRunning = systemSttStatus.state === 'running' || systemSttStatus.state === 'starting';
    if (isRunning) {
      await window.systemStt.stop();
      setSystemSttPartial(null);
      return;
    }

    const resolvedSourceId = selectedSourceId || (await detectDefaultSource());
    if (!resolvedSourceId) {
      setSttError('Selecione um dispositivo de audio do sistema');
      return;
    }

    try {
      await window.systemStt.start({ sourceId: resolvedSourceId });
      setSystemSttPartial(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao iniciar STT do sistema';
      setSttError(message);
    }
  };

  const toggleMicStt = async () => {
    if (!window.stt) return;
    setSttError(null);

    const isRunning = micSttStatus.state === 'running' || micSttStatus.state === 'starting';
    if (isRunning) {
      await window.stt.stop();
      setMicSttPartial(null);
      return;
    }

    try {
      await window.stt.start();
      setMicSttPartial(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao iniciar STT do microfone';
      setSttError(message);
    }
  };

  const isSystemSttActive = systemSttStatus.state === 'running' || systemSttStatus.state === 'starting';
  const isMicSttActive = micSttStatus.state === 'running' || micSttStatus.state === 'starting';

  // Get display value for input (show preview if available)
  const getInputDisplayValue = () => {
    const activePartial = systemSttPartial || micSttPartial;
    if (activePartial) {
      // Show committed text + preview
      return inputValue + (inputValue && !inputValue.endsWith(' ') ? ' ' : '') + activePartial;
    }
    return inputValue;
  };

  const hasPreview = !!(systemSttPartial || micSttPartial);

  // Minimize all windows
  const minimizeAllWindows = async () => {
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.send('window:minimize-all');
    }
  };

  // Convert image to base64
  const imageToBase64 = async (filePath: string): Promise<string> => {
    try {
      if (window.electron?.ipcRenderer) {
        const result = await window.electron.ipcRenderer.invoke('screenshot:read', { filePath });
        if (result.base64) {
          const mimeType = result.mimeType || 'image/png';
          return `data:${mimeType};base64,${result.base64}`;
        }
      }
      throw new Error('Failed to read image');
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw error;
    }
  };

  // Handle area screenshot (Imagem button)
  const handleAreaScreenshot = async () => {
    setIsCapturing(true);
    try {
      // Minimize all windows
      await minimizeAllWindows();

      // Wait a bit for windows to minimize
      await new Promise(resolve => setTimeout(resolve, 300));

      // Capture area interactively
      if (window.electron?.ipcRenderer) {
        const result = await window.electron.ipcRenderer.invoke('screenshot:capture-area-interactive');

        if (result.success && result.path) {
          const base64 = await imageToBase64(result.path);
          setAttachedImage({
            path: result.path,
            base64,
            screenshotId: result.screenshotId
          });
        } else if (result.error && result.error !== 'Selecao cancelada') {
          setSttError(result.error || 'Falha ao capturar screenshot');
        }
      }
    } catch (error: any) {
      setSttError(error.message || 'Falha ao capturar screenshot');
    } finally {
      setIsCapturing(false);
    }
  };

  // Handle fullscreen screenshot (Captura button)
  const handleFullscreenScreenshot = async () => {
    setIsCapturing(true);
    try {
      // Minimize all windows
      await minimizeAllWindows();

      // Wait a bit for windows to minimize
      await new Promise(resolve => setTimeout(resolve, 500));

      // Capture fullscreen
      if (window.electron?.ipcRenderer) {
        const result = await window.electron.ipcRenderer.invoke('screenshot:captureFullscreen');

        if (result.success && result.path) {
          const base64 = await imageToBase64(result.path);
          setAttachedImage({
            path: result.path,
            base64,
            screenshotId: result.screenshotId
          });
        } else {
          setSttError(result.error || 'Falha ao capturar screenshot');
        }
      }
    } catch (error: any) {
      setSttError(error.message || 'Falha ao capturar screenshot');
    } finally {
      setIsCapturing(false);
    }
  };

  const compressImage = async (base64DataUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const img = new Image();
        img.onload = () => {
          // Create canvas
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          // Calculate new dimensions (max 1280px)
          const maxDimension = 1280;
          let width = img.width;
          let height = img.height;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension;
              width = maxDimension;
            } else {
              width = (width / height) * maxDimension;
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;

          // Draw and compress
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.8);
          resolve(compressed);
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = base64DataUrl;
      } catch (error) {
        reject(error);
      }
    });
  };

  const handleSendMessage = async () => {
    // Clear any preview before sending
    const textToSend = inputValue.trim();
    if (!textToSend && !attachedImage) return;

    // Clear previews
    setSystemSttPartial(null);
    setMicSttPartial(null);

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend || '',
      timestamp: Date.now(),
      ...(attachedImage && {
        imagePath: attachedImage.path,
        imageBase64: attachedImage.base64,
        screenshotId: attachedImage.screenshotId
      })
    };

    setMessages(prev => [...prev, newMessage]);
    setInputValue('');
    const imageToSend = attachedImage;
    setAttachedImage(null);
    setIsTyping(true);
    setProgress(10);

    try {
      // Get personality context
      const context = activePersonality?.promptText || undefined;

      let result;
      if (imageToSend && imageToSend.screenshotId) {
        // Chat with screenshot
        setProgress(30);

        result = await window.ai.analyzeScreenshot({
          screenshotId: imageToSend.screenshotId,
          prompt: textToSend || 'Analise esta imagem',
          sessionId: currentSessionId || undefined,
          context
        });
      } else {
        // Text-only chat
        setProgress(30);

        suppressStartedRef.current = { prompt: textToSend, sessionId: currentSessionId || null };
        result = await window.ai.analyzeText({
          prompt: textToSend,
          sessionId: currentSessionId || undefined,
          context
        });
      }

      if (result.success && result.response) {
        // Update session ID if new
        if (result.sessionId && !currentSessionId) {
          setCurrentSessionId(result.sessionId);
        }

        const responseText = result.response.answerText || 'Processado com sucesso.';
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: responseText,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, aiResponse]);
      } else {
        throw new Error(result.error || 'Falha ao processar mensagem');
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ Erro: ${error.message || 'Erro desconhecido ao processar mensagem'}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorResponse]);
      setSttError(error.message || 'Erro ao enviar mensagem');
    } finally {
      setIsTyping(false);
      setProgress(100);
      setTimeout(() => setProgress(0), 300);
      suppressStartedRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="ai-chat-panel">
      <div className="messages-container">
        {messages.map((msg) => (
          <div key={msg.id} className={`message-row ${msg.role}`}>
            <div className="message-bubble">
              {msg.role === 'assistant' && <div className="avatar">✨</div>}
              <div className="message-content">
                {msg.imageBase64 && (
                  <div className="message-image">
                    <img src={msg.imageBase64} alt="Screenshot" />
                  </div>
                )}
                {msg.content && <div>{msg.content}</div>}
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="message-row assistant">
            <div className="message-bubble typing">
              <div className="avatar">✨</div>
              <div className="typing-dots">
                <span>.</span><span>.</span><span>.</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area-wrapper">
        <div className="input-island">
          <textarea
            ref={inputRef}
            value={getInputDisplayValue()}
            onChange={(e) => {
              const newValue = e.target.value;
              const activePartial = systemSttPartial || micSttPartial;

              if (activePartial) {
                // User is editing - clear preview and commit their changes
                setSystemSttPartial(null);
                setMicSttPartial(null);
                setInputValue(newValue);
              } else {
                // No preview, normal editing
                setInputValue(newValue);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            rows={1}
            className={`chat-input ${hasPreview ? 'has-preview' : ''}`}
          />
          <button
            className="send-btn"
            onClick={handleSendMessage}
            disabled={!inputValue.trim()}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          </button>
        </div>
        <div className="input-actions">
          <button
            className={`action-pill ${isCapturing ? 'capturing' : ''}`}
            onClick={handleAreaScreenshot}
            disabled={isCapturing}
            title="Capturar área da tela"
          >
            {isCapturing ? '⏳ Capturando...' : '📷 Imagem'}
          </button>
          <button
            className={`action-pill ${isCapturing ? 'capturing' : ''}`}
            onClick={handleFullscreenScreenshot}
            disabled={isCapturing}
            title="Capturar tela inteira"
          >
            {isCapturing ? '⏳ Capturando...' : '🖥️ Capturar'}
          </button>
          <button
            className={`action-pill stt-button ${isSystemSttActive ? 'active' : ''}`}
            onClick={toggleSystemStt}
            title={isSystemSttActive ? 'Parar STT do Sistema' : 'Iniciar STT do Sistema'}
          >
            {isSystemSttActive ? '⏹️ Parar STT Sistema' : '🎤 STT Sistema'}
          </button>
          <button
            className={`action-pill stt-button ${isMicSttActive ? 'active' : ''}`}
            onClick={toggleMicStt}
            title={isMicSttActive ? 'Parar STT do Microfone' : 'Iniciar STT do Microfone'}
          >
            {isMicSttActive ? '⏹️ Parar STT Mic' : '🎙️ STT Microfone'}
          </button>
        </div>
        {attachedImage && (
          <div className="attached-image-preview">
            <img src={attachedImage.base64} alt="Screenshot anexado" />
            <button
              className="remove-image-btn"
              onClick={() => setAttachedImage(null)}
              title="Remover imagem"
            >
              ✕
            </button>
          </div>
        )}
        {sttError && (
          <div className="stt-error-message">{sttError}</div>
        )}
      </div>

      {/* Progress Bar */}
      {isLoading && (
        <div className="progress-bar-container">
          <div
            className={`progress-bar ${progress < 30 ? 'indeterminate' : ''}`}
            style={{ width: progress >= 30 ? `${progress}%` : undefined }}
          />
        </div>
      )}
    </div>
  );
};
