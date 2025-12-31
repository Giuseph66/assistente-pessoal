import React, { useState, useEffect } from 'react';
import { SessionSidebar } from '../Panels/SessionSidebar';
import { WindowControls } from './WindowControls';
import './SessionLayout.css';

interface SessionLayoutProps {
    children?: React.ReactNode;
    activePanel?: string;
    onPanelChange?: (panel: string) => void;
}

export const SessionLayout: React.FC<SessionLayoutProps> = ({
    children,
    activePanel,
    onPanelChange
}) => {
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [showSessionPanel, setShowSessionPanel] = useState(false);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: any) => {
            // Shortcuts now handled by global accelerator or specific windows
            // But we might want some here too
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="session-layout">
            {/* Header */}
            <header className="session-header">
                <div className="header-tabs">
                    <button className={`header-tab ${isSessionActive ? 'active' : ''}`}>
                        Sessão
                    </button>
                    <button className="header-tab">
                        Resumo
                    </button>
                </div>

                <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button
                        className="end-session-btn"
                        disabled={!isSessionActive}
                        onClick={() => {
                            setIsSessionActive(false);
                            setShowSessionPanel(false);
                        }}
                    >
                        Encerrar Sessão
                    </button>
                    <WindowControls />
                </div>
            </header>

            {/* Main Content Area */}
            <main className="session-main">
                {!isSessionActive ? (
                    <div className="empty-session-view">
                        <h1 className="greeting-title">Bom dia, Jesus</h1>
                        <h3 className="greeting-subtitle">O que vamos fazer agora?</h3>

                        <div className="quick-actions-grid">
                            <button className="action-card" onClick={() => console.log('Analyze')}>
                                <div className="action-icon">⚡</div>
                                <div className="action-info">
                                    <span className="action-title">Analisar Conversa</span>
                                    <span className="action-shortcut">Ctrl+D</span>
                                </div>
                            </button>

                            <button className="action-card" onClick={() => console.log('Capture')}>
                                <div className="action-icon">📸</div>
                                <div className="action-info">
                                    <span className="action-title">Capturar Tela</span>
                                    <span className="action-shortcut">Ctrl+E</span>
                                </div>
                            </button>

                            <button className="action-card" onClick={() => window.electron.ipcRenderer.send('window:open-command-bar')}>
                                <div className="action-icon">💬</div>
                                <div className="action-info">
                                    <span className="action-title">Perguntar Algo</span>
                                    <span className="action-shortcut">Ctrl+Enter</span>
                                </div>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="active-session-view">
                        {/* Session Sidebar */}
                        <SessionSidebar
                            isOpen={showSessionPanel}
                            onClose={() => setShowSessionPanel(false)}
                        />

                        <div className="placeholder-content">
                            <div className="empty-state">
                                <p>Sessão Ativa</p>
                                <p className="sub">Use o HUD ou o Painel Lateral para interagir</p>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};
