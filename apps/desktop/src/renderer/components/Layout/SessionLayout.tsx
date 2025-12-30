import React, { useState, useEffect } from 'react';
import { HUD } from '../HUD/HUD';
import { CommandBar } from '../CommandBar/CommandBar';
import { SettingsModal } from '../Modals/SettingsModal';
import { HistoryModal } from '../Modals/HistoryModal';
import { SessionSidebar } from '../Panels/SessionSidebar';
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
    const [isCommandBarOpen, setIsCommandBarOpen] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showSessionPanel, setShowSessionPanel] = useState(false);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: any) => {
            // Ctrl+K or Ctrl+Space to open Command Bar
            if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === ' ')) {
                e.preventDefault();
                setIsCommandBarOpen(true);
            }
            // Ctrl+D to Analyze
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                console.log('Analyze shortcut triggered');
            }
            // Ctrl+E to Capture
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                console.log('Capture shortcut triggered');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleStartListening = () => {
        setIsListening(!isListening);
        if (!isListening) {
            setIsSessionActive(true);
            setShowSessionPanel(true); // Auto-open panel when starting
        }
    };

    const handleCommand = (command: string) => {
        console.log('Command received:', command);
        setIsSessionActive(true);
    };

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
                <button
                    className="end-session-btn"
                    disabled={!isSessionActive}
                    onClick={() => {
                        setIsSessionActive(false);
                        setIsListening(false);
                        setShowSessionPanel(false);
                    }}
                >
                    Encerrar Sessão
                </button>
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

                            <button className="action-card" onClick={() => setIsCommandBarOpen(true)}>
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

            {/* HUD */}
            <HUD
                onOpenSettings={() => setShowSettings(true)}
                onOpenHistory={() => setShowHistory(true)}
                onOpenSessionPanel={() => setShowSessionPanel(true)}
                onStartListening={handleStartListening}
                isListening={isListening}
            />

            {/* Command Bar Overlay */}
            <CommandBar
                isOpen={isCommandBarOpen}
                onClose={() => setIsCommandBarOpen(false)}
                onCommand={handleCommand}
            />

            {/* Modals */}
            <SettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
            />

            <HistoryModal
                isOpen={showHistory}
                onClose={() => setShowHistory(false)}
            />
        </div>
    );
};
