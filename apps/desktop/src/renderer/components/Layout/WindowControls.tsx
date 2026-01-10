import React from 'react';
import './WindowControls.css';

export const WindowControls: React.FC = () => {
    const handleMinimize = () => {
        window.electron.ipcRenderer.send('window:minimize');
    };

    const handleMaximize = () => {
        window.electron.ipcRenderer.send('window:maximize');
    };

    const handleClose = () => {
        window.electron.ipcRenderer.send('window:close');
    };

    return (
        <div className="window-controls">
            <button className="control-btn minimize" onClick={handleMinimize} title="Minimizar">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
            </button>
            <button className="control-btn maximize" onClick={handleMaximize} title="Maximizar">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
            </button>
            <button className="control-btn close" onClick={handleClose} title="Fechar">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            </button>
        </div>
    );
};
