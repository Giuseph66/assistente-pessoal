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

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-window history-modal" onClick={e => e.stopPropagation()}>
                {/* Sidebar - Session List */}
                <div className="modal-sidebar history-sidebar">
                    <div className="sidebar-title">Histórico</div>

                    <div className="session-list">
                        <div
                            className={`session-item ${activeSessionId === '1' ? 'active' : ''}`}
                            onClick={() => setActiveSessionId('1')}
                        >
                            <div className="session-title">Redesign UI/UX</div>
                            <div className="session-meta">Gemini 2.5 • 2h atrás</div>
                            <div className="session-badge">EM ANDAMENTO</div>
                        </div>

                        <div
                            className={`session-item ${activeSessionId === '2' ? 'active' : ''}`}
                            onClick={() => setActiveSessionId('2')}
                        >
                            <div className="session-title">Debug Application</div>
                            <div className="session-meta">Gemini 2.5 • Ontem</div>
                        </div>

                        <div
                            className={`session-item ${activeSessionId === '3' ? 'active' : ''}`}
                            onClick={() => setActiveSessionId('3')}
                        >
                            <div className="session-title">Setup Inicial</div>
                            <div className="session-meta">Gemini 2.5 • 3 dias atrás</div>
                        </div>
                    </div>

                    <div className="premium-card">
                        <div className="premium-icon">🔒</div>
                        <div className="premium-text">
                            <strong>Histórico Ilimitado</strong>
                            <span>Desbloqueie com Premium</span>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="modal-content">
                    <div className="history-header">
                        <div className="history-tabs">
                            <button
                                className={`history-tab ${activeTab === 'overview' ? 'active' : ''}`}
                                onClick={() => setActiveTab('overview')}
                            >
                                Visão Geral
                            </button>
                            <button
                                className={`history-tab ${activeTab === 'chat' ? 'active' : ''}`}
                                onClick={() => setActiveTab('chat')}
                            >
                                Chat
                            </button>
                            <button
                                className={`history-tab ${activeTab === 'transcription' ? 'active' : ''}`}
                                onClick={() => setActiveTab('transcription')}
                            >
                                Transcrição
                            </button>
                            <button
                                className={`history-tab ${activeTab === 'screenshots' ? 'active' : ''}`}
                                onClick={() => setActiveTab('screenshots')}
                            >
                                Screenshots
                            </button>
                            <button
                                className={`history-tab ${activeTab === 'notes' ? 'active' : ''}`}
                                onClick={() => setActiveTab('notes')}
                            >
                                Notas
                            </button>
                        </div>
                        <button className="close-btn" onClick={onClose}>×</button>
                    </div>

                    <div className="history-body">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </div>
    );
};
