import React, { useState, useEffect } from 'react';
import { SessionSidebar } from '../Panels/SessionSidebar';
import { SessionSummary } from '../Panels/SessionSummary';
import './SessionLayout.css';

export interface SessionLayoutProps {
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
    const [activeView, setActiveView] = useState<'session' | 'summary'>('session');

    // Ensure we default to session view when a session is active
    useEffect(() => {
        if (activeSessionId) {
            setActiveView('session');
        }
    }, [activeSessionId]);

    const handleMinimize = () => {
        (window as any).electron.ipcRenderer.send('window:minimize');
    };

    const handleClose = () => {
        (window as any).electron.ipcRenderer.send('window:close');
    };

    return (
        <div className="session-layout">
            {/* Minimal Window Header */}
            <header className="window-header">
                {/* Left: View Switcher */}
                <div className="header-left">
                    <div className="view-switcher">
                        <button
                            className={`view-tab ${activeView === 'session' ? 'active' : ''}`}
                            onClick={() => setActiveView('session')}
                        >
                            Sessão
                        </button>
                        <button
                            className={`view-tab ${activeView === 'summary' ? 'active' : ''}`}
                            onClick={() => setActiveView('summary')}
                        >
                            Resumo
                        </button>
                    </div>
                </div>

                {/* Center: Session Badge */}
                <div className="header-center">
                    {activeSessionId && <span className="session-badge">#{activeSessionId}</span>}
                </div>

                {/* Right: Window Actions */}
                <div className="header-right">
                    <div className="window-actions">
                        <button className="icon-btn minimize-btn" onClick={handleMinimize} title="Minimizar">
                            ─
                        </button>
                        <button className="icon-btn close-btn" onClick={handleClose} title="Fechar">
                            ✕
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="main-content">
                {activeView === 'session' ? (
                    <SessionSidebar
                        isOpen={true}
                        onClose={() => { }}
                        sessionId={activeSessionId}
                    />
                ) : (
                    <div className="summary-container-wrapper">
                        {activeSessionId ? (
                            <SessionSummary sessionId={activeSessionId} />
                        ) : (
                            <div className="empty-state">Nenhuma sessão ativa</div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};
