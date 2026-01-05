import React, { useState, useEffect } from 'react';
import './WindowControls.css';

interface WindowControlsProps {
    children?: React.ReactNode;
    title?: string;
    onClose?: () => void;
    onMinimize?: () => void;
    onMaximize?: () => void;
}

export const WindowControls: React.FC<WindowControlsProps> = ({ children, title, onClose, onMinimize, onMaximize }) => {
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        const onMaximizedChanged = (_: any, maximized: boolean) => {
            setIsMaximized(maximized);
        };

        // Check initial state? Electron doesn't easily expose this sync without IPC call, 
        // but we can assume false initially or wait for event.
        // Ideally we'd ask main process, but for now let's rely on events.

        window.electron.ipcRenderer.on('window:maximized-changed', onMaximizedChanged);
        return () => {
            window.electron.ipcRenderer.removeListener('window:maximized-changed', onMaximizedChanged);
        };
    }, []);

    const handleMinimize = () => {
        if (onMinimize) onMinimize();
        else window.electron.ipcRenderer.send('window:minimize');
    };

    const handleMaximize = () => {
        if (onMaximize) onMaximize();
        else window.electron.ipcRenderer.send('window:maximize');
    };

    const handleClose = () => {
        if (onClose) onClose();
        else window.electron.ipcRenderer.send('window:close');
    };

    const radius = isMaximized ? '0' : '16px';

    return (
        <div className="window-layout" style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            width: '100vw',
            overflow: 'hidden',
            background: 'transparent',
            borderRadius: radius,
        }}>
            <div className="window-controls-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0 12px',
                height: '40px',
                background: 'transparent',
                WebkitAppRegion: 'drag',
                borderTopLeftRadius: radius,
                borderTopRightRadius: radius,
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 9999,
                // Subtle shadow when dragging to see the boundary if needed
                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            } as any}>
                <div className="window-title" style={{
                    color: 'rgba(255, 255, 255, 0.4)',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    userSelect: 'none',
                    paddingLeft: '4px'
                } as any}>
                    <span style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        width: '20px',
                        height: '20px',
                        borderRadius: '6px',
                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1))',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        fontSize: '12px'
                    }}>✨</span>
                    {title || 'Ricky Assistant'}
                </div>
                <div className="window-controls-group" style={{ WebkitAppRegion: 'no-drag', display: 'flex', gap: '6px', paddingRight: '4px' } as any}>
                    <button className="control-btn minimize" onClick={handleMinimize} title="Minimizar">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                    </button>
                    <button className="control-btn maximize" onClick={handleMaximize} title="Maximizar">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="4" y="4" width="16" height="16" rx="2" />
                        </svg>
                    </button>
                    <button className="control-btn close" onClick={handleClose} title="Fechar">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            </div>
            <div className="window-content" style={{
                flex: 1,
                overflow: 'hidden',
                position: 'relative',
                background: 'rgba(13, 13, 15, 0.98)',
                borderBottomLeftRadius: radius,
                borderBottomRightRadius: radius,
                // O conteúdo não precisa de padding top se quisermos que o header flutue
                // Mas para o Workflow Editor, provavelmente queremos que ele comece abaixo
                // Vou deixar o padding mas tornar o header flutuante.
                paddingTop: '40px',
            }}>
                {children}
            </div>
        </div>
    );
};
