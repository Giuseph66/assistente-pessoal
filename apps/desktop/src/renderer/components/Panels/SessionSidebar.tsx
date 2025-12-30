import React, { useState } from 'react';
import './SessionSidebar.css';

// Import existing panels (assuming they can be reused or adapted)
// For now, we'll use placeholders or simple wrappers
import { NotesPanel } from './NotesPanel';
import { TranscriptionPanel } from './TranscriptionPanel';
import { AIChatPanel } from './AIChatPanel';
import { ScreenshotPanel } from './ScreenshotPanel';
import { RecordingsPanel } from './RecordingsPanel';

interface SessionSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    activeTab?: string;
}

type SidebarTab = 'chat' | 'transcription' | 'notes' | 'media';

export const SessionSidebar: React.FC<SessionSidebarProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<SidebarTab>('chat');

    if (!isOpen) return null;

    return (
        <div className="session-sidebar">
            <div className="sidebar-header">
                <div className="sidebar-tabs">
                    <button
                        className={`sidebar-tab ${activeTab === 'chat' ? 'active' : ''}`}
                        onClick={() => setActiveTab('chat')}
                        title="Chat (My AI)"
                    >
                        💬
                    </button>
                    <button
                        className={`sidebar-tab ${activeTab === 'transcription' ? 'active' : ''}`}
                        onClick={() => setActiveTab('transcription')}
                        title="Transcrição"
                    >
                        📝
                    </button>
                    <button
                        className={`sidebar-tab ${activeTab === 'notes' ? 'active' : ''}`}
                        onClick={() => setActiveTab('notes')}
                        title="Notas"
                    >
                        📒
                    </button>
                    <button
                        className={`sidebar-tab ${activeTab === 'media' ? 'active' : ''}`}
                        onClick={() => setActiveTab('media')}
                        title="Mídia (Screenshots/Áudio)"
                    >
                        🖼️
                    </button>
                </div>
                <button className="close-sidebar-btn" onClick={onClose}>→</button>
            </div>

            <div className="sidebar-content">
                {activeTab === 'chat' && (
                    <div className="panel-wrapper">
                        {/* Wrapper for existing AIChatPanel */}
                        <AIChatPanel />
                    </div>
                )}
                {activeTab === 'transcription' && (
                    <div className="panel-wrapper">
                        <TranscriptionPanel />
                    </div>
                )}
                {activeTab === 'notes' && (
                    <div className="panel-wrapper">
                        <NotesPanel />
                    </div>
                )}
                {activeTab === 'media' && (
                    <div className="panel-wrapper media-wrapper">
                        <h3>Screenshots</h3>
                        <ScreenshotPanel />
                        <div className="divider" />
                        <h3>Áudios</h3>
                        <RecordingsPanel />
                    </div>
                )}
            </div>
        </div>
    );
};
