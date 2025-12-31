import React, { useState, useEffect } from 'react';
import { SessionPanel } from '../Panels/SessionPanel';
import { SessionSummary } from '../Panels/SessionSummary';
import { WindowControls } from './WindowControls';
import './SessionLayout.css';

interface SessionLayoutProps {
    children?: React.ReactNode;
    activePanel?: string;
    onPanelChange?: (panel: string) => void;
    activeSessionId?: number | null;
}

export const SessionLayout: React.FC<SessionLayoutProps> = ({
    children,
    activePanel,
    onPanelChange,
    activeSessionId
}) => {
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [showSessionPanel, setShowSessionPanel] = useState(false);
    const [activeView, setActiveView] = useState<'session' | 'summary'>('session');

    useEffect(() => {
        if (activeSessionId) {
            setIsSessionActive(true);
        }
    }, [activeSessionId]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: any) => {
            // Shortcuts now handled by global accelerator or specific windows
            // But we might want some here too
        };

        (globalThis as any).window.addEventListener('keydown', handleKeyDown);
        return () => (globalThis as any).window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="session-layout">
            {/* Header */}
            <header className="session-header">
                <div className="header-left">
                    <button className="icon-btn grid-btn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="7" height="7" />
                            <rect x="14" y="3" width="7" height="7" />
                            <rect x="14" y="14" width="7" height="7" />
                            <rect x="3" y="14" width="7" height="7" />
                        </svg>
                    </button>
                    <div className="header-tabs-pill">
                        <button
                            className={`header-tab ${activeView === 'session' ? 'active' : ''}`}
                            onClick={() => setActiveView('session')}
                        >
                            Sessão {activeSessionId ? `#${activeSessionId}` : ''}
                        </button>
                        <button
                            className={`header-tab ${activeView === 'summary' ? 'active' : ''}`}
                            onClick={() => setActiveView('summary')}
                        >
                            Resumo
                        </button>
                    </div>
                </div>

                <div className="header-actions">
                    <button
                        className="end-session-btn-text"
                        disabled={!isSessionActive}
                        onClick={() => {
                            setIsSessionActive(false);
                            setShowSessionPanel(false);
                        }}
                    >
                        Encerrar Sessão
                    </button>
                    <button className="icon-btn settings-btn" onClick={() => (globalThis as any).window.electron.ipcRenderer.send('window:open-settings')}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
                        </svg>
                    </button>
                    <button className="icon-btn minimize-btn" onClick={() => (globalThis as any).window.electron.ipcRenderer.send('window:minimize')}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                    </button>
                    <button className="icon-btn close-btn" onClick={() => (globalThis as any).window.electron.ipcRenderer.send('window:close')}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="session-main">
                {!isSessionActive ? (
                    <div className="empty-session-view">
                        <div className="empty-hero">
                            <div className="hero-icon-wrapper">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                            </div>
                            <h1 className="greeting-title">Iniciar uma Conversa</h1>
                            <h3 className="greeting-subtitle">Use qualquer uma das ações abaixo para começar</h3>
                        </div>

                        <div className="action-list">
                            <button className="action-item" onClick={() => console.log('Analyze')}>
                                <div className="action-item-left">
                                    <div className="action-item-icon">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                        </svg>
                                    </div>
                                    <div className="action-item-info">
                                        <span className="action-item-title">Analisar Conversa</span>
                                        <span className="action-item-desc">Solicite análise completa de tudo que foi dito</span>
                                    </div>
                                </div>
                                <div className="action-item-shortcut">
                                    <span className="key">Ctrl</span>
                                    <span className="key">D</span>
                                </div>
                            </button>

                            <button className="action-item" onClick={() => console.log('Capture')}>
                                <div className="action-item-left">
                                    <div className="action-item-icon">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                                            <line x1="8" y1="21" x2="16" y2="21" />
                                            <line x1="12" y1="17" x2="12" y2="21" />
                                        </svg>
                                    </div>
                                    <div className="action-item-info">
                                        <span className="action-item-title">Capturar Tela</span>
                                        <span className="action-item-desc">Tire uma captura de tela para análise visual</span>
                                    </div>
                                </div>
                                <div className="action-item-shortcut">
                                    <span className="key">Ctrl</span>
                                    <span className="key">E</span>
                                </div>
                            </button>

                            <button className="action-item" onClick={() => (globalThis as any).window.electron.ipcRenderer.send('window:open-command-bar')}>
                                <div className="action-item-left">
                                    <div className="action-item-icon">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                            <path d="M8 9h8M8 13h6" />
                                        </svg>
                                    </div>
                                    <div className="action-item-info">
                                        <span className="action-item-title">Perguntar Algo</span>
                                        <span className="action-item-desc">Digite uma pergunta ou prompt para a IA</span>
                                    </div>
                                </div>
                                <div className="action-item-shortcut">
                                    <span className="key">Ctrl</span>
                                    <span className="key">Enter</span>
                                </div>
                            </button>
                        </div>
                    </div>
                ) : (
                    activeView === 'session' ? (
                        <SessionPanel sessionId={activeSessionId} />
                    ) : (
                        activeSessionId ? <SessionSummary sessionId={activeSessionId} /> : null
                    )
                )}
            </main>
        </div>
    );
};
