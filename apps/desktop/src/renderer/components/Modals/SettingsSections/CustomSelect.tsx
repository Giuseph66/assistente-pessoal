import React, { useState, useEffect, useRef } from 'react';

export interface CustomSelectProps {
    options: string[];
    value: string;
    onChange: (value: string) => void;
    icon?: React.ReactNode;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({ options, value, onChange, icon }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (selectRef.current && !(selectRef.current as any).contains(event.target)) {
                setIsOpen(false);
            }
        };
        (globalThis as any).document.addEventListener('mousedown', handleClickOutside);
        return () => (globalThis as any).document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="custom-select-container" ref={selectRef}>
            <div className={`select-wrapper ${isOpen ? 'open' : ''}`} onClick={() => setIsOpen(!isOpen)}>
                <div className="select-content">
                    {icon}
                    <span>{value}</span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`chevron ${isOpen ? 'up' : ''}`}>
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </div>
            {isOpen && (
                <div className="custom-select-options">
                    {options.map((option) => (
                        <div
                            key={option}
                            className={`custom-select-option ${option === value ? 'active' : ''}`}
                            onClick={() => {
                                onChange(option);
                                setIsOpen(false);
                            }}
                        >
                            {option}
                            {option === value && <span className="check-icon">✓</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

