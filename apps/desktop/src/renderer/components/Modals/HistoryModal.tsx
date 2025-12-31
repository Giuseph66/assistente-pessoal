import React, { useState } from 'react';
import './HistoryModal.css';

interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type HistoryTab = 'overview' | 'chat' | 'transcription' | 'screenshots' | 'notes';

export const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<HistoryTab>('overview');
    const [activeSessionId, setActiveSessionId] = useState<string>('1');

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
                            <div className="chat-bubble user">
                                <p>Analise o atual projeto!</p>
                            </div>
                            <div className="chat-bubble ai">
                                <p>Analisei o projeto e criei um relatório detalhado...</p>
                            </div>
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

    const [selectedSession, setSelectedSession] = useState<any>(null);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-window history-modal" onClick={e => e.stopPropagation()}>
                {/* Sidebar - Session List */}
                <div className="modal-sidebar history-sidebar">
                    <div className="sidebar-header">
                        <div className="sidebar-title">Histórico</div>
                        <button className="icon-btn close-btn-mobile" onClick={onClose}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                    </div>

                    <div className="search-container">
                        <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                        <input type="text" placeholder="Pesquisar sessões..." className="search-input" />
                    </div>

                    <div className="session-list">
                        <div className="session-group">
                            <div className="group-label">HOJE</div>
                            <div className={`session-item ${selectedSession?.id === 1 ? 'active' : ''}`} onClick={() => setSelectedSession({ id: 1, title: 'Reunião de Planejamento', date: 'Hoje, 14:20' })}>
                                <div className="session-icon">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                                </div>
                                <div className="session-info">
                                    <span className="session-name">Reunião de Planejamento</span>
                                    <span className="session-time">14:20</span>
                                </div>
                            </div>
                            <div className={`session-item ${selectedSession?.id === 2 ? 'active' : ''}`} onClick={() => setSelectedSession({ id: 2, title: 'Daily Scrum', date: 'Hoje, 09:15' })}>
                                <div className="session-icon">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                                </div>
                                <div className="session-info">
                                    <span className="session-name">Daily Scrum</span>
                                    <span className="session-time">09:15</span>
                                </div>
                            </div>
                        </div>

                        <div className="session-group">
                            <div className="group-label">ONTEM</div>
                            <div className={`session-item ${selectedSession?.id === 3 ? 'active' : ''}`} onClick={() => setSelectedSession({ id: 3, title: 'Brainstorming de Design', date: 'Ontem, 16:45' })}>
                                <div className="session-icon">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                                </div>
                                <div className="session-info">
                                    <span className="session-name">Brainstorming de Design</span>
                                    <span className="session-time">16:45</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="modal-content history-content">
                    <div className="content-header-actions">
                        <button className="icon-btn" onClick={onClose}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                    </div>

                    <div className="history-scroll-area">
                        {selectedSession ? (
                            <div className="session-detail-view">
                                <div className="detail-header">
                                    <div className="detail-title-group">
                                        <span className="detail-date">{selectedSession.date}</span>
                                        <h2>{selectedSession.title}</h2>
                                    </div>
                                    <div className="detail-actions">
                                        <button className="icon-btn-outline"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg></button>
                                        <button className="icon-btn-outline"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg></button>
                                        <button className="btn-delete-session"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg></button>
                                    </div>
                                </div>

                                <div className="detail-tabs">
                                    <button className="detail-tab active">Transcrição</button>
                                    <button className="detail-tab">Resumo IA</button>
                                    <button className="detail-tab">Capturas</button>
                                </div>

                                <div className="detail-content-body">
                                    <div className="transcript-segment">
                                        <div className="segment-speaker">VOCÊ</div>
                                        <div className="segment-text">Então, pessoal, vamos começar a discutir o novo layout do histórico. O que vocês acham da ideia de mover as estatísticas para o perfil?</div>
                                    </div>
                                    <div className="transcript-segment">
                                        <div className="segment-speaker">OUTROS</div>
                                        <div className="segment-text">Acho excelente! Isso limpa a tela de histórico e foca no que realmente importa: as sessões passadas.</div>
                                    </div>
                                    <div className="transcript-segment">
                                        <div className="segment-speaker">VOCÊ</div>
                                        <div className="segment-text">Perfeito. Vou implementar essa mudança agora mesmo.</div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="history-empty-state">
                                <div className="empty-icon-wrapper">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 8v4l3 3" /><circle cx="12" cy="12" r="9" /></svg>
                                </div>
                                <h3>Selecione uma sessão</h3>
                                <p>Escolha uma sessão na lista ao lado para ver os detalhes, transcrições e resumos gerados pela IA.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
