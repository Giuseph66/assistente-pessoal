import React, { useState, useEffect, useCallback } from 'react';
import './HistoryModal.css';

interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface Message {
    id: number;
    role: 'user' | 'assistant' | 'system';
    content: string;
    recognizedText?: string;
    createdAt: number;
}

interface Session {
    id: number;
    createdAt: number;
    modelName: string;
    providerId: string;
    screenshotId?: number;
    summary?: string;
    messages?: Message[];
}

type HistoryTab = 'overview' | 'chat' | 'screenshots' | 'notes';

export const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<HistoryTab>('chat');
    const [sessions, setSessions] = useState<Session[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isDetailsLoading, setIsDetailsLoading] = useState(false);

    const formatTime = (timestamp: number) => {
        if (!timestamp) return '--:--';
        try {
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) return '--:--';
            
            const now = new Date();
            const isToday = date.toDateString() === now.toDateString();
            
            if (isToday) {
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else {
                return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' }) + ' ' + 
                       date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
        } catch (e) {
            return '--:--';
        }
    };

    const isRecentSession = (createdAt: number) => {
        const oneDay = 24 * 60 * 60 * 1000;
        return (Date.now() - createdAt) < oneDay;
    };

    const loadSessions = useCallback(async (searchQuery?: string) => {
        if (!isOpen) return;
        setIsLoading(true);
        try {
            const result = await window.electron.ipcRenderer.invoke('session:list', { 
                date: Date.now(),
                search: searchQuery 
            });
            setSessions(result || []);
            
            if (result && result.length > 0 && !selectedSession) {
                handleSessionSelect(result[0]);
            } else if (!result || result.length === 0) {
                setSelectedSession(null);
            }
        } catch (error) {
            console.error('Failed to load sessions:', error);
        } finally {
            setIsLoading(false);
        }
    }, [isOpen, selectedSession]);

    const handleSessionSelect = async (session: Session) => {
        setSelectedSession(session);
        setIsDetailsLoading(true);
        try {
            const details = await window.electron.ipcRenderer.invoke('session:get', session.id);
            if (details) {
                setSelectedSession(details);
            }
        } catch (error) {
            console.error('Failed to load session details:', error);
        } finally {
            setIsDetailsLoading(false);
        }
    };

    const handleDeleteSession = async (e: React.MouseEvent, sessionId: number) => {
        e.stopPropagation();
        if (!confirm('Tem certeza que deseja apagar esta sessão?')) return;

        try {
            const result = await window.electron.ipcRenderer.invoke('session:delete', sessionId);
            if (result.success) {
                setSessions(prev => prev.filter(s => s.id !== sessionId));
                if (selectedSession?.id === sessionId) {
                    setSelectedSession(null);
                }
            } else {
                alert('Erro ao apagar sessão: ' + result.error);
            }
        } catch (error) {
            console.error('Failed to delete session:', error);
            alert('Erro ao apagar sessão.');
        }
    };

    // Efeito para busca com debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            if (isOpen) {
                loadSessions(searchTerm);
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [searchTerm, isOpen, loadSessions]);

    // Carregamento inicial ao abrir
    useEffect(() => {
        if (isOpen && !searchTerm) {
            loadSessions();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const renderMessageIcon = (role: string) => {
        if (role === 'user') {
            return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
        }
        return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></svg>;
    };

    const renderContent = () => {
        if (!selectedSession) {
            return (
                <div className="history-tab-content">
                    <div className="empty-state">
                        <p>Selecione uma sessão para ver os detalhes.</p>
                    </div>
                </div>
            );
        }

        if (isDetailsLoading) {
            return (
                <div className="history-tab-content">
                    <div className="loading-state">
                        <p>Carregando detalhes da sessão...</p>
                    </div>
                </div>
            );
        }

        switch (activeTab) {
            case 'overview':
                return (
                    <div className="history-tab-content">
                        <div className="overview-stats">
                            <div className="stat-card">
                                <span className="stat-value">{selectedSession.messages?.length || 0}</span>
                                <span className="stat-label">Mensagens</span>
                            </div>
                            <div className="stat-card">
                                <span className="stat-value">{selectedSession.providerId}</span>
                                <span className="stat-label">Provider</span>
                            </div>
                            <div className="stat-card">
                                <span className="stat-value">{selectedSession.modelName}</span>
                                <span className="stat-label">Modelo</span>
                            </div>
                        </div>

                        <div className="summary-card">
                            <h3>Resumo da Sessão</h3>
                            <p>
                                {selectedSession.summary || 'Nenhum resumo disponível para esta sessão.'}
                            </p>
                            <div style={{ marginTop: '20px', fontSize: '12px', color: '#64748b' }}>
                                ID da Sessão: #{selectedSession.id}<br/>
                                Criada em: {new Date(selectedSession.createdAt).toLocaleString()}
                            </div>
                        </div>
                    </div>
                );
            case 'chat':
                return (
                    <div className="history-tab-content">
                        <div className="chat-history-list">
                            {selectedSession.messages && selectedSession.messages.length > 0 ? (
                                selectedSession.messages.map((msg) => (
                                    <div key={msg.id} className={`chat-message-card ${msg.role === 'user' ? 'user' : 'assistant'}`}>
                                        <div className="message-header">
                                            <div className="user-info">
                                                {renderMessageIcon(msg.role)}
                                                <span className="user-name">{msg.role === 'user' ? 'VOCÊ' : 'ASSISTENTE'}</span>
                                            </div>
                                        </div>
                                        <div className="message-body">
                                            <p>{msg.content}</p>
                                        </div>
                                        <div className="message-footer">
                                            <span className="message-time">{new Date(msg.createdAt).toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="empty-state">
                                    <p>Nenhuma mensagem nesta sessão.</p>
                                </div>
                            )}
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
                        <div className="sidebar-search">
                            <div className="search-input-wrapper">
                                <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                <input 
                                    type="text" 
                                    placeholder="Pesquisar sessões..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="session-list">
                            {isLoading ? (
                                <div className="loading-state">Carregando...</div>
                            ) : sessions.length > 0 ? (
                                sessions.map((session) => (
                                    <div 
                                        key={session.id} 
                                        className={`session-item ${selectedSession?.id === session.id ? 'active' : ''}`} 
                                        onClick={() => handleSessionSelect(session)}
                                    >
                                        <div className="session-item-header">
                                            <span className="provider-name">{session.providerId}</span>
                                            <div className="header-actions">
                                                {isRecentSession(session.createdAt) && (
                                                    <span className="status-badge">RECENTE</span>
                                                )}
                                                <button 
                                                    className="delete-session-btn" 
                                                    onClick={(e) => handleDeleteSession(e, session.id)}
                                                    title="Apagar sessão"
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                                </button>
                                            </div>
                                        </div>
                                        <div className="session-item-footer">
                                            <span className="relative-time">{formatTime(session.createdAt)}</span>
                                            <span className="model-name">{session.modelName}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="empty-state">
                                    {searchTerm ? 'Nenhuma sessão encontrada.' : 'Nenhuma sessão encontrada.'}
                                </div>
                            )}
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
                        </div>

                        <div className="history-scroll-area">
                            {renderContent()}
                        </div>
                    </div>
                </div>
            </div>
    );
};

