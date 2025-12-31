import React, { useEffect, useRef, useState } from 'react';
import './CommandBar.css';

interface CommandBarProps {
    isOpen: boolean;
    onClose: () => void;
    onCommand: (command: string) => void;
}

export const CommandBar: React.FC<CommandBarProps> = ({ isOpen, onClose, onCommand }) => {
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: any) => {
            if (!isOpen) return;

            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                onCommand(inputValue);
                setInputValue('');
                onClose();
            }
        };

        (window as any).addEventListener('keydown', handleKeyDown);
        return () => (window as any).removeEventListener('keydown', handleKeyDown);
    }, [isOpen, inputValue, onClose, onCommand]);

    if (!isOpen) return null;

    return (
        <div className="command-bar-overlay" onClick={onClose}>
            <div className="command-bar-window" onClick={(e) => e.stopPropagation()}>
                <div className="command-input-pill">
                    <input
                        ref={inputRef}
                        type="text"
                        className="command-input"
                        placeholder="Comece a digitar... (Enter para enviar)"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                    />
                </div>

                <div className="command-bar-shortcuts">
                    <div className="shortcut-item">
                        <span className="key">Ctrl</span> + <span className="key">E</span>
                        <span className="label">Capturar Tela</span>
                    </div>
                    <div className="shortcut-item">
                        <span className="key">Ctrl</span> + <span className="key">Enter</span>
                        <span className="label">Enviar</span>
                    </div>
                    <div className="shortcut-item">
                        <span className="key">Esc</span>
                        <span className="label">Cancelar</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
