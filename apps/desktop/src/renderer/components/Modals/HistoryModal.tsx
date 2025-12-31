import React, { useState } from 'react';
import './HistoryModal.css';

interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type HistoryTab = 'overview' | 'chat' | 'transcription' | 'screenshots' | 'notes';

export const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<HistoryTab>('chat');
    const [selectedSession, setSelectedSession] = useState<any>({
        id: '1',
        provider: 'Openai',
        status: 'ATIVO',
        time: '1d atrás',
        model: 'gpt-4o'
    });

    if (!isOpen) return null;

    const renderContent = () => {
        switch (activeTab) {
            case 'overview':
                return (
                    <div className="history-tab-content">
                        <div className="overview-stats">
                            <div className="stat-card">
                                <span className="stat-value">14</span>
                                <span className="stat-label">Mensagens</span>
                            </div>
                            <div className="stat-card">
                                <span className="stat-value">5m</span>
                                <span className="stat-label">Áudio</span>
                            </div>
                            <div className="stat-card">
                                <span className="stat-value">2</span>
                                <span className="stat-label">Screenshots</span>
                            </div>
                        </div>

                        <div className="summary-card">
                            <h3>Resumo da Sessão</h3>
                            <p>
                                Nesta sessão, você discutiu sobre a arquitetura do projeto Ricky Assistant.
                                Foram analisados os arquivos de configuração e a estrutura de pastas.
                                Você também solicitou um redesign da interface seguindo o estilo "Persua".
                            </p>
                        </div>
                    </div>
                );
            case 'chat':
                return (
                    <div className="history-tab-content">
                        <div className="chat-history-list">
                            <div className="chat-message-card user">
                                <div className="message-header">
                                    <div className="user-info">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                        <span className="user-name">VOCÊ</span>
                                    </div>
                                </div>
                                <div className="message-body">
                                    <p>oi</p>
                                </div>
                                <div className="message-footer">
                                    <span className="message-time">30/12/2025, 12:36:03</span>
                                </div>
                            </div>

                            <div className="chat-message-card assistant">
                                <div className="message-header">
                                    <div className="user-info">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></svg>
                                        <span className="user-name">ASSISTENTE</span>
                                    </div>
                                </div>
                                <div className="message-body">
                                    <p>Hey there! How can I help you today?</p>
                                </div>
                                <div className="message-footer">
                                    <span className="message-time">30/12/2025, 12:36:03</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'transcription':
                return (
                    <div className="history-tab-content">
                        <div className="transcript-segment">
                            <div className="segment-speaker">VOCÊ</div>
                            <div className="segment-text">Então, pessoal, vamos começar a discutir o novo layout do histórico.</div>
                        </div>
                    </div>
                );
            default:
                return (
                    <div className="history-tab-content">
                        <div className="empty-state">
                            <p>Conteúdo de {activeTab} indisponível.</p>
                        </div>
                    </div>
                );
        }
    };

    return (
            <div className="modal-window history-modal" onClick={e => e.stopPropagation()}>
                <div className="history-header">
                    <div className="header-title">Histórico de Sessões</div>
                    <button className="close-btn" onClick={onClose}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                </div>

                <div className="history-main-container">
                    {/* Sidebar - Session List */}
                    <div className="history-sidebar">
                        <div className="session-list">
                            <div className={`session-item ${selectedSession?.id === '1' ? 'active' : ''}`} onClick={() => setSelectedSession({ id: '1', provider: 'Openai', status: 'ATIVO', time: '1d atrás', model: 'gpt-4o' })}>
                                <div className="session-item-header">
                                    <span className="provider-name">{selectedSession?.provider || 'Openai'}</span>
                                    <span className="status-badge">ATIVO</span>
                                </div>
                                <div className="session-item-footer">
                                    <span className="relative-time">1d atrás</span>
                                    <span className="model-name">gpt-4o</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="history-content">
                        <div className="content-tabs">
                            <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                                Visão Geral
                            </button>
                            <button className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                                Histórico do Chat
                            </button>
                            <button className={`tab-btn ${activeTab === 'transcription' ? 'active' : ''}`} onClick={() => setActiveTab('transcription')}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
                                Transcrição
                            </button>
                        </div>

                        <div className="history-scroll-area">
                            {renderContent()}
                        </div>
                    </div>
                </div>
            </div>
    );
};

