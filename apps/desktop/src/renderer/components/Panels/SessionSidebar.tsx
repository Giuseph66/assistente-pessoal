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

export const SessionSidebar: React.FC<SessionSidebarProps> = ({ isOpen, sessionId }) => {
    const [activeTab, setActiveTab] = useState<SidebarTab>('chat');

    if (!isOpen) return null;

    return (
        <div className="session-container">
            {/* Navigation Strip */}
            <div className="nav-strip">
                <button
                    className={`nav-pill ${activeTab === 'chat' ? 'active' : ''}`}
                    onClick={() => setActiveTab('chat')}
                >
                    💬 Chat
                </button>
                <button
                    className={`nav-pill ${activeTab === 'transcription' ? 'active' : ''}`}
                    onClick={() => setActiveTab('transcription')}
                >
                    📝 Transcrição
                </button>
            </div>

            {/* Content Area */}
            <div className="content-area">
                {activeTab === 'chat' && (
                    <div className="panel-view">
                        <AIChatPanel sessionId={sessionId} />
                    </div>
                )}
                {activeTab === 'transcription' && (
                    <div className="panel-view">
                        <TranscriptionPanel />
                    </div>
                )}
            </div>
        </div>
    );
};
