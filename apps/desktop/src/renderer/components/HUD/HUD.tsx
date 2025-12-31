import React, { useState, useEffect, useRef } from 'react';
import './HUD.css';

interface HUDProps {
    onOpenSettings: () => void;
    onOpenHistory: () => void;
    onOpenSessionPanel: () => void;
    onStartListening: () => void;
    isListening: boolean;
    activeAssistant?: string;
    sessionId?: number | null;
    onSessionSelect?: (sessionId: number) => void;
}

interface Session {
    id: number;
    createdAt: number;
    modelName: string;
    providerId: string;
}

export const HUD: React.FC<HUDProps> = ({
    onOpenSettings,
    onOpenHistory,
    onOpenSessionPanel,
    onStartListening,
    isListening,
    activeAssistant = 'My IA',
    sessionId,
    onSessionSelect
}) => {
    const [inputValue, setInputValue] = useState('');
    const [showSessionDropdown, setShowSessionDropdown] = useState(false);
    const [sessions, setSessions] = useState<Session[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowSessionDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchSessions = async () => {
        try {
            const result = await window.electron.ipcRenderer.invoke('session:list', { date: Date.now() });
            setSessions(result || []);
        } catch (error) {
            console.error('Failed to fetch sessions:', error);
        }
    };

    const toggleDropdown = () => {
        if (!showSessionDropdown) {
            fetchSessions();
        }
        setShowSessionDropdown(!showSessionDropdown);
    };

    const handleSessionClick = (id: number) => {
        window.electron.ipcRenderer.send('session:activate', id);
        window.electron.ipcRenderer.send('window:open-session');
        setShowSessionDropdown(false);
    };

    const createNewSession = async () => {
        try {
            // Get current config for provider/model
            const config = await window.ai.getConfig();
            const result = await window.electron.ipcRenderer.invoke('session:create', {
                providerId: config.providerId,
                modelName: config.modelName
            });
            if (result && result.sessionId) {
                window.electron.ipcRenderer.send('session:activate', result.sessionId);
                window.electron.ipcRenderer.send('window:open-session');
            }
            setShowSessionDropdown(false);
        } catch (error) {
            console.error('Failed to create session:', error);
        }
    };

    return (
        <div className="hud-container">
            <div className="hud-bar">
                {/* Assistant Selector / Session Dropdown */}
                <div className="hud-section assistant-selector" ref={dropdownRef}>
                    <div
                        className="assistant-trigger"
                        onClick={toggleDropdown}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        <span className="assistant-name">{activeAssistant}</span>
                        {sessionId && <span className="session-badge">#{sessionId}</span>}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 9l6 6 6-6" />
                        </svg>
                    </div>

                    {showSessionDropdown && (
                        <div className="session-dropdown">
                            <div className="dropdown-header">
                                <span>Sessões de Hoje</span>
                                <button onClick={createNewSession} className="new-session-btn" title="Nova Sessão">+</button>
                            </div>
                            <div className="dropdown-list">
                                {sessions.length === 0 ? (
                                    <div className="empty-sessions">Nenhuma sessão hoje</div>
                                ) : (
                                    sessions.map(session => (
                                        <div
                                            key={session.id}
                                            className={`session-item ${sessionId === session.id ? 'active' : ''}`}
                                            onClick={() => handleSessionClick(session.id)}
                                        >
                                            <span className="session-id">#{session.id}</span>
                                            <span className="session-time">
                                                {new Date(session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            <span className="session-model">{session.modelName}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="hud-divider" />

                {/* Quick Actions */}
                <div className="hud-section quick-actions">
                    <button onClick={onOpenSettings} title="Configurações" className="icon-btn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
                        </svg>
                    </button>
                    <button onClick={onOpenHistory} title="Histórico" className="icon-btn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                        </svg>
                    </button>
                    <button onClick={onOpenSessionPanel} title="Painel da Sessão" className="icon-btn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                        </svg>
                    </button>
                </div>

                {/* Input */}
                <div className="hud-section input-wrapper">
                    <input
                        type="text"
                        placeholder="Perguntar..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        className="hud-input"
                    />
                </div>

                {/* CTA */}
                <button
                    className={`hud-cta ${isListening ? 'active' : ''}`}
                    onClick={onStartListening}
                >
                    {isListening ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="6" y="4" width="4" height="16" />
                            <rect x="14" y="4" width="4" height="16" />
                        </svg>
                    ) : (
                        <>
                            <span className="cta-text">Começar a Ouvir</span>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                <line x1="12" y1="19" x2="12" y2="23" />
                                <line x1="8" y1="23" x2="16" y2="23" />
                            </svg>
                        </>
                    )}
                </button>

                <div className="hud-divider" />

                {/* Close App */}
                <div className="hud-section">
                    <button
                        onClick={() => (globalThis as any).window.electron.ipcRenderer.send('app:quit')}
                        title="Fechar Aplicativo"
                        className="icon-btn close-app-btn"
                        style={{ color: 'var(--status-error)' }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};
