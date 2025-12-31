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
    <div className={`vintage-window-container ${visible ? 'fade-in' : 'fade-out'} ${isDropZoneActive ? 'drop-zone-active' : ''}`}>
      <svg width="240" height="320" viewBox="0 0 240 320" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Padrão para as cortinas */}
          <pattern id="curtainPattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill={isActive ? "#059669" : "#cc3333"} />
            <circle cx="10" cy="10" r="3" fill={isActive ? "#34d399" : "#6699ff"} />
            <circle cx="5" cy="5" r="1.5" fill="#ffffff" opacity="0.5" />
            <circle cx="15" cy="15" r="1.5" fill="#ffffff" opacity="0.5" />
          </pattern>
          
          {/* Filtro para efeito de madeira desgastada */}
          <filter id="distress">
            <feTurbulence type="fractalNoise" baseFrequency="0.1" numOctaves="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" />
          </filter>
        </defs>

        {/* Ornamento de Ferro Forjado */}
        <path 
          d="M40 20 Q120 -10 200 20 M60 20 Q120 0 180 20 M120 5 L120 20" 
          stroke={isActive ? "#10b981" : "#8b5cf6"} strokeWidth="3" fill="none" strokeLinecap="round" 
        />
        <circle cx="40" cy="20" r="4" fill={isActive ? "#10b981" : "#8b5cf6"} />
        <circle cx="200" cy="20" r="4" fill={isActive ? "#10b981" : "#8b5cf6"} />

        {/* Moldura de Madeira (Fundo) */}
        <rect 
          x="20" y="30" width="200" height="220" 
          fill={isActive ? "rgba(16, 185, 129, 0.1)" : "rgba(139, 92, 246, 0.1)"} 
          stroke={isActive ? "#10b981" : "#8b5cf6"} strokeWidth="4" rx="2" 
        />
        
        {/* Painéis da Janela */}
        <rect x="35" y="45" width="80" height="95" fill={isActive ? "#064e3b" : "#1e1b4b"} fillOpacity="0.5" />
        <rect x="125" y="45" width="80" height="95" fill={isActive ? "#064e3b" : "#1e1b4b"} fillOpacity="0.5" />
        <rect x="35" y="150" width="80" height="95" fill={isActive ? "#064e3b" : "#1e1b4b"} fillOpacity="0.5" />
        <rect x="125" y="150" width="80" height="95" fill={isActive ? "#064e3b" : "#1e1b4b"} fillOpacity="0.5" />

        {/* Cortinas */}
        <path d="M35 45 Q55 90 35 140 L115 140 Q95 90 115 45 Z" fill="url(#curtainPattern)" />
        <path d="M125 45 Q145 90 125 140 L205 140 Q185 90 205 45 Z" fill="url(#curtainPattern)" />
        <path d="M35 150 Q55 195 35 245 L115 245 Q95 195 115 150 Z" fill="url(#curtainPattern)" />
        <path d="M125 150 Q145 195 125 245 L205 245 Q185 195 205 150 Z" fill="url(#curtainPattern)" />

        {/* Moldura Interna (Cruz) */}
        <line x1="120" y1="30" x2="120" y2="250" stroke={isActive ? "#10b981" : "#8b5cf6"} strokeWidth="6" />
        <line x1="20" y1="145" x2="220" y2="145" stroke={isActive ? "#10b981" : "#8b5cf6"} strokeWidth="6" />
        
        {/* Prateleira */}
        <rect x="10" y="250" width="220" height="15" fill={isActive ? "#065f46" : "#4c1d95"} rx="2" />

        {/* Ganchos e Canecas */}
        {[35, 75, 120, 165, 205].map((x, i) => (
          <g key={i}>
            <path d={`M${x} 265 Q${x-5} 275 ${x} 280 Q${x+5} 285 ${x} 290`} stroke={isActive ? "#34d399" : "#a78bfa"} strokeWidth="2" fill="none" />
            <g transform={`translate(${x-10}, 290)`}>
              <rect x="0" y="0" width="20" height="18" rx="4" fill={isActive ? "#10b981" : "#8b5cf6"} />
              <path d="M20 5 Q25 5 25 10 Q25 15 20 15" stroke={isActive ? "#10b981" : "#8b5cf6"} strokeWidth="3" fill="none" />
              <ellipse cx="10" cy="0" rx="10" ry="3" fill={isActive ? "#059669" : "#7c3aed"} />
            </g>
          </g>
        ))}
      </svg>
    </div>
  );
};

