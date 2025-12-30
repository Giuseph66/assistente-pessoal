import { useState, useEffect } from 'react';
import { NotesPanel } from '../Panels/NotesPanel';
import { TranscriptionPanel } from '../Panels/TranscriptionPanel';
import { TranslationPanel } from '../Panels/TranslationPanel';
import { ScreenshotPanel } from '../Panels/ScreenshotPanel';
import { ScreenshotHistoryPanel } from '../Panels/ScreenshotHistoryPanel';
import { AIChatPanel } from '../Panels/AIChatPanel';
import { RecordingsPanel } from '../Panels/RecordingsPanel';
import { SettingsContainer } from '../../pages/Settings/SettingsContainer';
import { DragHandle } from './DragHandle';
import { SttMicBridge } from '../SttMicBridge';
import './OverlayContainer.css';

type PanelType =
  | 'notes'
  | 'transcription'
  | 'translation'
  | 'screenshots'
  | 'screenshot-history'
  | 'ai-chat'
  | 'recordings'
  | 'settings';

export function OverlayContainer(): JSX.Element {
  const [activePanel, setActivePanel] = useState<PanelType>('notes');
  const [isHidden, setIsHidden] = useState(false);
  const [platformInfo, setPlatformInfo] = useState<{
    platform: string;
    supportsContentProtection: boolean;
    usingWorkarounds: boolean;
  } | null>(null);
  const [displayCount, setDisplayCount] = useState<number>(1);

  // Detecta se está no modo overlay (hash na URL)
  const isOverlayMode = window.location.hash === '#overlay';

  // Verifica status inicial do overlay
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 10;
    
    const checkStatus = async () => {
      try {
        if (window.overlay?.getContentProtection && window.overlay?.getDisplayCount) {
          const [status, displayInfo] = await Promise.all([
            window.overlay.getContentProtection(),
            window.overlay.getDisplayCount()
          ]);
          setIsHidden(!status.enabled);
          setPlatformInfo({
            platform: status.platform,
            supportsContentProtection: status.supportsContentProtection,
            usingWorkarounds: status.usingWorkarounds
          });
          setDisplayCount(displayInfo.count);
          retryCount = 0; // Reset retry count on success
        } else if (retryCount < maxRetries) {
          // Handler ainda não está disponível, tenta novamente
          retryCount++;
          setTimeout(checkStatus, 200);
        }
      } catch (error: any) {
        // Se o erro é "No handler registered", tenta novamente
        if (error?.message?.includes('No handler registered') && retryCount < maxRetries) {
          retryCount++;
          setTimeout(checkStatus, 200);
        } else {
          console.error('Error checking overlay status:', error);
        }
      }
    };
    
    // Aguarda um pouco antes de tentar (para garantir que os handlers estão registrados)
    const timeout = setTimeout(checkStatus, 500);
    
    // Listener para atualizar estado quando mudar via hotkey
    const updateStatus = async () => {
      try {
        if (window.overlay?.getContentProtection && window.overlay?.getDisplayCount) {
          const [status, displayInfo] = await Promise.all([
            window.overlay.getContentProtection(),
            window.overlay.getDisplayCount()
          ]);
          setIsHidden(!status.enabled);
          setDisplayCount(displayInfo.count);
          // Atualiza platformInfo apenas se mudou
          setPlatformInfo(prev => {
            if (!prev || 
                prev.platform !== status.platform || 
                prev.supportsContentProtection !== status.supportsContentProtection ||
                prev.usingWorkarounds !== status.usingWorkarounds) {
              return {
                platform: status.platform,
                supportsContentProtection: status.supportsContentProtection,
                usingWorkarounds: status.usingWorkarounds
              };
            }
            return prev;
          });
        }
      } catch (error) {
        // Ignora erros silenciosamente no update periódico
      }
    };

    // Verifica status periodicamente (a cada 5 segundos) para sincronizar com hotkey
    // Aumentado o intervalo para reduzir chamadas e evitar resets
    const interval = setInterval(updateStatus, 5000);
    
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  const handlePanicToggle = async () => {
    try {
      if (window.overlay?.getContentProtection && window.electron?.ipcRenderer) {
        const currentStatus = await window.overlay.getContentProtection();
        const newStatus = !currentStatus.enabled;
        
        // Envia comando para alterar content protection (janela permanece visível)
        window.electron.ipcRenderer.send('overlay:panic', { hide: !newStatus });
        
        // Atualiza estado local (isHidden = content protection desabilitado)
        setIsHidden(!newStatus);
        
        // Atualiza platformInfo
        setPlatformInfo({
          platform: currentStatus.platform,
          supportsContentProtection: currentStatus.supportsContentProtection,
          usingWorkarounds: currentStatus.usingWorkarounds
        });
      }
    } catch (error) {
      console.error('Error toggling panic mode:', error);
    }
  };

  const handleMoveMonitor = async () => {
    try {
      if (window.overlay?.moveToNextMonitor) {
        const result = await window.overlay.moveToNextMonitor();
        if (!result.success) {
          console.error('Failed to move to next monitor:', result.error);
        }
      }
    } catch (error) {
      console.error('Error moving to next monitor:', error);
    }
  };

  // Determina se deve mostrar botão de mover monitor
  // Mostra apenas no Linux quando há múltiplos monitores
  const shouldShowMoveMonitor = platformInfo?.platform === 'linux' && displayCount >= 2;
  
  // No Linux, não mostra botão de pânico (content protection não funciona)
  // Mostra apenas botão de mover monitor se houver múltiplos monitores
  const shouldShowPanicButton = platformInfo?.platform !== 'linux';

  if (!isOverlayMode) {
    return (
      <div className="container">
        <h1>Ricky Assistant</h1>
        <p>Welcome to your personal assistant.</p>
      </div>
    );
  }

  return (
    <div className="overlay-container">
      <SttMicBridge />
      {/* Header com tabs */}
      <div className="overlay-header">
        <div className="overlay-tabs">
          <button
            className={`tab ${activePanel === 'notes' ? 'active' : ''}`}
            onClick={() => setActivePanel('notes')}
          >
            Notas
          </button>
          <button
            className={`tab ${activePanel === 'transcription' ? 'active' : ''}`}
            onClick={() => setActivePanel('transcription')}
          >
            Transcrição
          </button>
          <button
            className={`tab ${activePanel === 'translation' ? 'active' : ''}`}
            onClick={() => setActivePanel('translation')}
          >
            Tradução
          </button>
          <button
            className={`tab ${activePanel === 'screenshots' ? 'active' : ''}`}
            onClick={() => setActivePanel('screenshots')}
          >
            Screenshots
          </button>
          <button
            className={`tab ${activePanel === 'screenshot-history' ? 'active' : ''}`}
            onClick={() => setActivePanel('screenshot-history')}
          >
            Histórico
          </button>
          <button
            className={`tab ${activePanel === 'ai-chat' ? 'active' : ''}`}
            onClick={() => setActivePanel('ai-chat')}
          >
            My AI
          </button>
          <button
            className={`tab ${activePanel === 'recordings' ? 'active' : ''}`}
            onClick={() => setActivePanel('recordings')}
          >
            Audios
          </button>
          <button
            className={`tab ${activePanel === 'settings' ? 'active' : ''}`}
            onClick={() => setActivePanel('settings')}
          >
            Configurações
          </button>
        </div>
        <div className="overlay-actions">
          {shouldShowMoveMonitor ? (
            <button
              className="panic-button move-monitor-button"
              type="button"
              onClick={handleMoveMonitor}
              title="Mover para outro monitor (útil quando compartilhando tela)"
            >
              🖥️
            </button>
          ) : shouldShowPanicButton ? (
            <button
              className={`panic-button ${isHidden ? 'active' : ''}`}
              type="button"
              onClick={handlePanicToggle}
              title={
                isHidden 
                  ? "Proteger do compartilhamento (ativar)" 
                  : "Desproteger do compartilhamento (desativar)"
              }
            >
              {isHidden ? '👁️' : '🚫'}
            </button>
          ) : null}
          <button
            className="window-button"
            type="button"
            onClick={() => window.electron?.ipcRenderer.send('overlay:minimize')}
            title="Minimizar"
          >
            –
          </button>
          <button
            className="window-button close"
            type="button"
            onClick={() => window.electron?.ipcRenderer.send('overlay:close')}
            title="Fechar"
          >
            ×
          </button>
        </div>
        <DragHandle />
      </div>

      {/* Content area */}
      <div className="overlay-content">
        {activePanel === 'notes' && <NotesPanel />}
        {activePanel === 'transcription' && <TranscriptionPanel />}
        {activePanel === 'translation' && <TranslationPanel />}
        {activePanel === 'screenshots' && <ScreenshotPanel />}
        {activePanel === 'screenshot-history' && <ScreenshotHistoryPanel />}
        {activePanel === 'ai-chat' && <AIChatPanel />}
        {activePanel === 'recordings' && <RecordingsPanel />}
        {activePanel === 'settings' && <SettingsContainer />}
      </div>

    </div>
  );
}
