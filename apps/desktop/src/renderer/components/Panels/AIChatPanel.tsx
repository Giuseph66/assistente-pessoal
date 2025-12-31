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
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load initial messages or mock data
  useEffect(() => {
    if (sessionId) {
      // Load real messages (mock for now)
      setMessages([
        { id: '1', role: 'assistant', content: 'Olá! Como posso ajudar você hoje?', timestamp: Date.now() }
      ]);
    }
  }, [sessionId]);

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

  // STT Microphone listeners
  useEffect(() => {
    if (!window.stt) return;
    window.stt.getStatus().then((status) => setMicSttStatus(status || defaultStatus));
    const offStatus = window.stt.onStatus((status) => setMicSttStatus(status));
    const offPartial = window.stt.onPartial((event: STTPartialEvent) => {
      setMicSttPartial(event.text);
      setSttError(null);
    });
    const offFinal = window.stt.onFinal((event: STTFinalEvent) => {
      if (event.text.trim()) {
        const currentText = inputValue.trim();
        const newText = currentText ? `${currentText} ${event.text}` : event.text;
        setInputValue(newText);
        setMicSttPartial(null);
        // Focus input and move cursor to end
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.setSelectionRange(newText.length, newText.length);
          }
        }, 0);
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
      setSystemSttPartial(event.text);
      setSttError(null);
    });
    const offFinal = window.systemStt.onFinal((event: STTFinalEvent) => {
      if (event.text.trim()) {
        const currentText = inputValue.trim();
        const newText = currentText ? `${currentText} ${event.text}` : event.text;
        setInputValue(newText);
        setSystemSttPartial(null);
        // Focus input and move cursor to end
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.setSelectionRange(newText.length, newText.length);
          }
        }, 0);
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

  const handleSendMessage = async () => {
    // Clear any preview before sending
    const textToSend = inputValue.trim();
    if (!textToSend) return;
    
    // Clear previews
    setSystemSttPartial(null);
    setMicSttPartial(null);

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, newMessage]);
    setInputValue('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Entendi. Estou processando sua solicitação...',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1500);
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
              <div className="message-content">{msg.content}</div>
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
          <button className="action-pill" title="Anexar Imagem">📷 Imagem</button>
          <button className="action-pill" title="Capturar Tela">🖥️ Capturar</button>
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
        {sttError && (
          <div className="stt-error-message">{sttError}</div>
        )}
      </div>
    </div>
  );
};
