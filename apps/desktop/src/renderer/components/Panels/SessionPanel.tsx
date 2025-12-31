import React, { useState, useEffect } from 'react';
import './SessionSidebar.css'; // Reuse existing styles for now

import { NotesPanel } from './NotesPanel';
import { TranscriptionPanel } from './TranscriptionPanel';
import { AIChatPanel } from './AIChatPanel';
import { ScreenshotPanel } from './ScreenshotPanel';
import { RecordingsPanel } from './RecordingsPanel';

interface SessionPanelProps {
    sessionId?: number | null;
    className?: string;
}

type PanelTab = 'chat' | 'transcription' | 'notes' | 'media';

export const SessionPanel: React.FC<SessionPanelProps> = ({ sessionId, className }) => {
    const [activeTab, setActiveTab] = useState<PanelTab>('chat');

    return (
        <div className={`session-sidebar ${className || ''}`} style={{ width: '100%', borderLeft: 'none', position: 'relative', right: 'auto', top: 'auto', height: '100%' }}>
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
            </div>

            <div className="sidebar-content">
                {activeTab === 'chat' && (
                    <div className="panel-wrapper">
                        <AIChatPanel sessionId={sessionId} />
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
