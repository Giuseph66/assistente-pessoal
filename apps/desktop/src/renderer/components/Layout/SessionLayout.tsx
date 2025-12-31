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
    const [isSessionActive, setIsSessionActive] = useState(true); // Always active for now
    const [showSessionPanel, setShowSessionPanel] = useState(true);
    const [activeView, setActiveView] = useState<'session' | 'summary'>('session');

    useEffect(() => {
        if (activeSessionId) {
            setIsSessionActive(true);
            setShowSessionPanel(true);
        }
    }, [activeSessionId]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: any) => {
            // Shortcuts now handled by global accelerator or specific windows
        };

        (globalThis as any).window.addEventListener('keydown', handleKeyDown);
        return () => (globalThis as any).window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="session-layout">
            {/* Main Content Area */}
            <main className="session-main" style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
                {activeView === 'session' ? (
                    <SessionSidebar
                        isOpen={showSessionPanel}
                        onClose={() => setShowSessionPanel(false)}
                        sessionId={activeSessionId}
                    />
                ) : (
                    activeSessionId ? <SessionSummary sessionId={activeSessionId} /> : null
                )}
            </main>
        </div>
    );
};
