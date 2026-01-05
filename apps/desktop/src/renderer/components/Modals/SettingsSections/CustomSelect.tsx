import React, { useState, useEffect, useRef } from 'react';

export interface CustomSelectProps {
    options: string[] | { label: string; value: string }[];
    value: string;
    onChange: (value: string) => void;
    icon?: React.ReactNode;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({ options, value, onChange, icon }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectRef = useRef<HTMLDivElement>(null);

    // Normaliza as opções para o formato { label, value }
    const normalizedOptions = options.map(opt => 
        typeof opt === 'string' ? { label: opt, value: opt } : opt
    );

    // Encontra o label da opção selecionada
    const selectedOption = normalizedOptions.find(opt => opt.value === value);
    const displayLabel = selectedOption ? selectedOption.label : value;

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
                    <span>{displayLabel}</span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`chevron ${isOpen ? 'up' : ''}`}>
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </div>
            {isOpen && (
                <div className="custom-select-options">
                    {normalizedOptions.map((option) => (
                        <div
                            key={option.value}
                            className={`custom-select-option ${option.value === value ? 'active' : ''}`}
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                        >
                            {option.label}
                            {option.value === value && <span className="check-icon">✓</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

