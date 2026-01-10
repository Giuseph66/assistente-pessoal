import React, { useEffect, useRef, useState } from 'react';
import './MiniHUD.css';

export const MiniHUD: React.FC = () => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    console.log('[MiniHUD] Bolinha futurista montada na tela');
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.screenX - dragStartPos.current.x;
      const deltaY = e.screenY - dragStartPos.current.y;
      
      if (Math.abs(deltaX) > 0 || Math.abs(deltaY) > 0) {
        window.electron.ipcRenderer.send('window:mini-hud-drag', {
          deltaX,
          deltaY
        });
        
        dragStartPos.current = { x: e.screenX, y: e.screenY };
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 1) {
        setIsDragging(false);
        document.body.style.cursor = 'default';
      }
    };

    // Usa document ao invés de window para capturar eventos mesmo fora da janela
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('mouseup', handleMouseUp, true);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('mouseup', handleMouseUp, true);
    };
  }, [isDragging]);

  const handleQuit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Botão direito: fecha o app
    window.electron.ipcRenderer.send('window:mini-hud-quit');
  };

  const handleRestore = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Botão esquerdo: restaura o HUD
    window.electron.ipcRenderer.send('window:mini-hud-right-click');
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // e.button === 1 é o botão do meio (scroll)
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      dragStartPos.current = { x: e.screenX, y: e.screenY };
      document.body.style.cursor = 'grabbing';
    }
  };

  return (
    <div 
      className="mini-hud-container"
      onClick={handleRestore}
      onContextMenu={handleQuit}
      onMouseDown={handleMouseDown}
      title="Esq: Restaurar • Dir: Fechar • Scroll: Mover"
    >
      <svg width="64" height="64" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="centralGlow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <stop offset="0%" style={{ stopColor: '#ffffff', stopOpacity: 1 }} />
            <stop offset="20%" style={{ stopColor: '#8B5CF6', stopOpacity: 0.8 }} />
            <stop offset="100%" style={{ stopColor: '#4C1D95', stopOpacity: 0 }} />
          </radialGradient>
          
          <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#2D1B4D', stopOpacity: 1 }} />
            <stop offset="50%" style={{ stopColor: '#8B5CF6', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#2D1B4D', stopOpacity: 1 }} />
          </linearGradient>

          <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Fundo Escuro Circular */}
        <circle cx="60" cy="60" r="55" fill="rgba(10, 10, 10, 0.85)" />

        {/* Anéis Externos Metálicos */}
        <circle cx="60" cy="60" r="54" fill="none" stroke="url(#ringGradient)" strokeWidth="1.2" opacity="0.7" />
        <circle cx="60" cy="60" r="50" fill="none" stroke="#8B5CF6" strokeWidth="0.5" opacity="0.4" />
        
        {/* Pontos de Luz no Anel */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <circle 
            key={angle}
            cx={60 + 52 * Math.cos((angle * Math.PI) / 180)}
            cy={60 + 52 * Math.sin((angle * Math.PI) / 180)}
            r="1.2"
            fill="#8B5CF6"
            filter="url(#neonGlow)"
          />
        ))}

        {/* Linhas Curvas Radiantes (Pétalas) */}
        <g stroke="#8B5CF6" strokeWidth="1" fill="none" filter="url(#neonGlow)" opacity="0.8">
          <path d="M60 15 Q80 40 105 60 Q80 80 60 105 Q40 80 15 60 Q40 40 60 15" strokeWidth="1.5" />
          <path d="M60 30 Q75 45 90 60 Q75 75 60 90 Q45 75 30 60 Q45 45 60 30" opacity="0.5" />
        </g>

        {/* Rede de Linhas Interconectadas */}
        <g stroke="#ffffff" strokeWidth="0.2" opacity="0.3">
          <line x1="60" y1="15" x2="60" y2="105" />
          <line x1="15" y1="60" x2="105" y2="60" />
          <circle cx="60" cy="60" r="35" fill="none" strokeDasharray="1,2" />
        </g>

        {/* Estrela Central Brilhante */}
        <circle cx="60" cy="60" r="12" fill="url(#centralGlow)" />
        
        {/* Raios da Estrela */}
        <g stroke="#ffffff" strokeWidth="2" filter="url(#neonGlow)">
          <line x1="60" y1="40" x2="60" y2="80" />
          <line x1="40" y1="60" x2="80" y2="60" />
        </g>
        
        {/* Núcleo Intenso */}
        <circle cx="60" cy="60" r="2.5" fill="#fff" filter="url(#neonGlow)" />
      </svg>
    </div>
  );
};
