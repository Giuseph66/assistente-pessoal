import React, { useState, useEffect } from 'react';
import './VintageWindow.css';

interface VintageWindowProps {
  visible: boolean;
}

export const VintageWindow: React.FC<VintageWindowProps> = ({ visible }) => {
  const [isColliding, setIsColliding] = useState(false);
  const [isDropZoneActive, setIsDropZoneActive] = useState(false);

  useEffect(() => {
    const handleCollision = (_event: any, state: boolean) => {
      setIsColliding(state);
    };

    const handleDropZone = (_event: any, active: boolean) => {
      setIsDropZoneActive(active);
    };

    window.electron.ipcRenderer.on('vintage:collision-state', handleCollision);
    window.electron.ipcRenderer.on('vintage:drop-zone-active', handleDropZone);
    
    return () => {
      window.electron.ipcRenderer.removeListener('vintage:collision-state', handleCollision);
      window.electron.ipcRenderer.removeListener('vintage:drop-zone-active', handleDropZone);
    };
  }, []);

  if (!visible) return null;

  const isActive = isColliding || isDropZoneActive;

  return (
    <div className={`vintage-window-container ${visible ? 'fade-in' : 'fade-out'}`}>
      <svg width="100" height="120" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="techFrameGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#2d1b4d', stopOpacity: 1 }} />
            <stop offset="50%" style={{ stopColor: '#1a1033', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#2d1b4d', stopOpacity: 1 }} />
          </linearGradient>
          
          <linearGradient id="techGlowGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#8b5cf6', stopOpacity: 0.6 }} />
            <stop offset="50%" style={{ stopColor: '#a78bfa', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#8b5cf6', stopOpacity: 0.6 }} />
          </linearGradient>

          <filter id="techNeonGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Moldura Metálica Principal - Apenas o contorno preenchido */}
        <path
          d="M3 12 L12 3 L88 3 L97 12 L97 88 L88 97 L12 97 L3 88 Z M10 10 L10 90 L90 90 L90 10 Z"
          fill="url(#techFrameGradient)"
          fillRule="evenodd"
          stroke="#8b5cf6"
          strokeWidth="0.5"
        />

        {/* Painéis da Janela que abrem - Transparentes com contorno apenas */}
        <g style={{ transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)', transform: isActive ? 'translateX(-35px)' : 'translateX(0)' }}>
          <rect x="10" y="10" width="40" height="80" fill="transparent" stroke="#8b5cf6" strokeWidth="1" strokeOpacity="0.3" />
          <rect x="46" y="10" width="4" height="80" fill="#2d1b4d" />
          <rect x="10" y="48" width="40" height="4" fill="#2d1b4d" />
        </g>

        <g style={{ transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)', transform: isActive ? 'translateX(35px)' : 'translateX(0)' }}>
          <rect x="50" y="10" width="40" height="80" fill="transparent" stroke="#8b5cf6" strokeWidth="1" strokeOpacity="0.3" />
          <rect x="50" y="10" width="4" height="80" fill="#2d1b4d" />
          <rect x="50" y="48" width="40" height="4" fill="#2d1b4d" />
        </g>

        {/* Detalhes Laterais Brilhantes (Esquerda) */}
        <rect x="5.5" y="18" width="1.2" height="14" fill="url(#techGlowGradient)" filter="url(#techNeonGlow)" />
        <circle cx="6.1" cy="32" r="0.8" fill="#8b5cf6" filter="url(#techNeonGlow)" />
        <rect x="5.5" y="52" width="1.2" height="14" fill="url(#techGlowGradient)" filter="url(#techNeonGlow)" />

        {/* Detalhes Laterais Brilhantes (Direita) */}
        <rect x="93.3" y="18" width="1.2" height="14" fill="url(#techGlowGradient)" filter="url(#techNeonGlow)" />
        <circle cx="93.9" cy="32" r="0.8" fill="#8b5cf6" filter="url(#techNeonGlow)" />
        <rect x="93.3" y="52" width="1.2" height="14" fill="url(#techGlowGradient)" filter="url(#techNeonGlow)" />

        {/* Base / Prateleira Tecnológica */}
        <path
          d="M0 97 L100 97 L98.5 115 L1.5 115 Z"
          fill="#130b26"
          stroke="#4c1d95"
          strokeWidth="1"
        />
        <rect x="8" y="104" width="84" height="1" fill="#8b5cf6" opacity="0.4" filter="url(#techNeonGlow)" />

        {/* Brilhos nos Cantos */}
        <circle cx="12" cy="3" r="0.7" fill="#fff" opacity="0.8" />
        <circle cx="88" cy="3" r="0.7" fill="#fff" opacity="0.8" />
        <circle cx="12" cy="97" r="0.7" fill="#fff" opacity="0.8" />
        <circle cx="88" cy="97" r="0.7" fill="#fff" opacity="0.8" />
      </svg>
    </div>
  );
};

