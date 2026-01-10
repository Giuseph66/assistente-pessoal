import React from 'react';
import { ProviderIcon, ProviderIconProps } from './ProviderIcon';

export const OllamaIcon: React.FC<ProviderIconProps> = (props) => {
    return (
        <ProviderIcon {...props} viewBox="0 0 24 24">
            <defs>
                <linearGradient id="ollama-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#333" />
                    <stop offset="100%" stopColor="#000" />
                </linearGradient>
            </defs>
            {/* Furry Head Shape - Based on the provided cute llama image */}
            <path
                d="M7 6V3.5C7 2.1 7.8 1.5 8.5 1.5C9.2 1.5 10 2.1 10 3.5V5.5C10.5 5.2 11.2 5 12 5C12.8 5 13.5 5.2 14 5.5V3.5C14 2.1 14.8 1.5 15.5 1.5C16.2 1.5 17 2.1 17 3.5V6C18.5 6.5 20 8 20 10.5C20 11.8 19.5 12.8 18.8 13.3C19.5 14 20 15.2 20 16.5C20 18.2 19 19.5 18 20.2C18.5 21 18.8 22 18.8 22.8C18.8 23.5 18.2 24 17.5 24H6.5C5.8 24 5.2 23.5 5.2 22.8C5.2 22 5.5 21 6 20.2C5 19.5 4 18.2 4 16.5C4 15.2 4.5 14 5.2 13.3C4.5 12.8 4 11.8 4 10.5C4 8 5.5 6.5 7 6Z"
                fill="none"
                stroke="url(#ollama-gradient)"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Eyes - Solid and expressive */}
            <circle cx="8.2" cy="11.5" r="1.4" fill="url(#ollama-gradient)" />
            <circle cx="15.8" cy="11.5" r="1.4" fill="url(#ollama-gradient)" />
            {/* Snout Area - Ellipse like the image */}
            <ellipse cx="12" cy="14.8" rx="3.8" ry="3.2" stroke="url(#ollama-gradient)" strokeWidth="1.3" fill="none" />
            {/* Nose (Y shape) */}
            <path
                d="M12 13.8V15M12 15L11 16M12 15L13 16"
                stroke="url(#ollama-gradient)"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </ProviderIcon>
    );
};
