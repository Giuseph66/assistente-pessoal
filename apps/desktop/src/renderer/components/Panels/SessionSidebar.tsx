import React, { useState } from 'react';
import './SessionSidebar.css';

// Import existing panels
import { NotesPanel } from './NotesPanel';
import { TranscriptionPanel } from './TranscriptionPanel';
import { AIChatPanel } from './AIChatPanel';
import { ScreenshotPanel } from './ScreenshotPanel';
import { RecordingsPanel } from './RecordingsPanel';

interface SessionSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    activeTab?: string;
    sessionId?: number | null;
}

type SidebarTab = 'chat' | 'transcription' | 'notes' | 'media';

export const SessionSidebar: React.FC<SessionSidebarProps> = ({ isOpen, onClose, sessionId }) => {
    const [activeTab, setActiveTab] = useState<SidebarTab>('chat');

    if (!isOpen) return null;

    return (
        <div className="session-sidebar glass-panel">
            {/* Header removed to avoid duplication with SessionLayout */}

            <div className="sidebar-nav">
                <button
                    className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
                    onClick={() => setActiveTab('chat')}
                >
                    <span className="nav-icon">💬</span>
                    <span className="nav-label">Chat</span>
                    {activeTab === 'chat' && <div className="active-indicator" />}
                </button>
                <button
                    className={`nav-item ${activeTab === 'transcription' ? 'active' : ''}`}
                    onClick={() => setActiveTab('transcription')}
                >
                    <span className="nav-icon">📝</span>
                    <span className="nav-label">Transcrição</span>
                    {activeTab === 'transcription' && <div className="active-indicator" />}
                </button>
                <button
                    className={`nav-item ${activeTab === 'notes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('notes')}
                >
                    <span className="nav-icon">📒</span>
                    <span className="nav-label">Notas</span>
                    {activeTab === 'notes' && <div className="active-indicator" />}
                </button>
                <button
                    className={`nav-item ${activeTab === 'media' ? 'active' : ''}`}
                    onClick={() => setActiveTab('media')}
                >
                    <span className="nav-icon">🖼️</span>
                    <span className="nav-label">Mídia</span>
                    {activeTab === 'media' && <div className="active-indicator" />}
                </button>
            </div>

            <div className="sidebar-content custom-scrollbar">
                {activeTab === 'chat' && (
                    <div className="panel-container fade-in">
                        <AIChatPanel sessionId={sessionId} />
                    </div>
                )}
                {activeTab === 'transcription' && (
                    <div className="panel-container fade-in">
                        <TranscriptionPanel />
                    </div>
                )}
                {activeTab === 'notes' && (
                    <div className="panel-container fade-in">
                        <NotesPanel />
                    </div>
                )}
                {activeTab === 'media' && (
                    <div className="panel-container fade-in media-container">
                        <div className="section-header">
                            <h3>Capturas de Tela</h3>
                            <span className="badge">Recent</span>
                        </div>
                        <ScreenshotPanel />

                        <div className="divider-gradient" />

                        <div className="section-header">
                            <h3>Gravações de Áudio</h3>
                            <span className="badge">History</span>
                        </div>
                        <RecordingsPanel />
                    </div>
                )}
            </div>
        </div>
    );
};
