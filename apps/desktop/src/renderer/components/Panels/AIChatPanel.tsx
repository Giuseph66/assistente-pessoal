import React, { useState, useEffect, useRef } from 'react';
import './AIChatPanel.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface AIChatPanelProps {
  sessionId?: number | null;
}

export const AIChatPanel: React.FC<AIChatPanelProps> = ({ sessionId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
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
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            rows={1}
            className="chat-input"
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
        </div>
      </div>
    </div>
  );
};
