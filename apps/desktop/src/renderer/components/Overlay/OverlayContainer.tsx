import { useState, useEffect } from 'react';
import { SessionLayout } from '../Layout/SessionLayout';
import { TranslationOverlayRoot } from '../Translation/TranslationOverlayRoot';
import { DragHandle } from './DragHandle';
import { SttMicBridge } from '../SttMicBridge';
import './OverlayContainer.css';

export function OverlayContainer(): JSX.Element {
  const [isHidden, setIsHidden] = useState(false);
  const [platformInfo, setPlatformInfo] = useState<{
    platform: string;
    supportsContentProtection: boolean;
    usingWorkarounds: boolean;
  } | null>(null);
  const [displayCount, setDisplayCount] = useState<number>(1);

  const hash = window.location.hash;
  const isOverlayMode = hash === '#overlay';
  const isTranslationOverlay = hash === '#translation-overlay';

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

  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);

  useEffect(() => {
    const handleSessionActivated = (_event: any, { sessionId }: { sessionId: number }) => {
      setActiveSessionId(sessionId);
    };
    // Use type assertion for window.electron if needed or ensure types are correct
    (window as any).electron.ipcRenderer.on('session:activated', handleSessionActivated);
    return () => {
      (window as any).electron.ipcRenderer.removeListener('session:activated', handleSessionActivated);
    };
  }, []);

  if (isTranslationOverlay) {
    return <TranslationOverlayRoot />;
  }

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
      <DragHandle />

      {/* New Session Layout */}
      <SessionLayout activeSessionId={activeSessionId} />
    </div>
  );
}
