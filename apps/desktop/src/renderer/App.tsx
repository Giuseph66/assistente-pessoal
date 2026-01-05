import { useEffect, useState } from 'react';
import { OverlayContainer } from './components/Overlay/OverlayContainer';
import { SettingsModal } from './components/Modals/SettingsModal';
import { HistoryModal } from './components/Modals/HistoryModal';
import { HUD } from './components/HUD/HUD';
import { HUDDropdown } from './components/HUD/HUDDropdown';
import { CommandBar } from './components/CommandBar/CommandBar';
import { VintageWindow } from './components/HUD/VintageWindow';
import { MiniHUD } from './components/HUD/MiniHUD';
import { TextHighlightOutput } from './components/TextHighlightOverlay/TextHighlightOutput';
import { ScreenshotSelector } from './components/ScreenshotSelector/ScreenshotSelector';
import { ScreenshotPreview } from './components/ScreenshotPreview/ScreenshotPreview';
import { WorkflowEditorWindow } from './components/AutomationFlow/WorkflowEditorWindow';
import { WindowControls } from './components/Layout/WindowControls';
import { initSttStore } from './store/sttStore';
import './styles/global.css';

function App(): JSX.Element {
    const [route, setRoute] = useState(window.location.hash);

    useEffect(() => {
        initSttStore();

        const handleHashChange = () => {
            setRoute(window.location.hash);
        };

        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    // Render based on hash
    if (route === '#settings') {
        return <SettingsModal isOpen={true} onClose={() => window.close()} />;
    }

    if (route === '#history') {
        return <HistoryModal isOpen={true} onClose={() => window.close()} />;
    }

    if (route === '#hud') {
        return (
            <div style={{
                width: '100vw',
                //height: '100vh',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                background: 'transparent'
            }}>
                <HUD
                    onOpenSettings={() => window.electron.ipcRenderer.send('window:open-settings')}
                    onOpenHistory={() => window.electron.ipcRenderer.send('window:open-history')}
                    onOpenSessionPanel={() => window.electron.ipcRenderer.send('window:open-session')}
                    onStartListening={async () => {
                        try {
                            await window.stt.start();
                        } catch (error) {
                            console.error('Falha ao iniciar STT:', error);
                        }
                    }}
                    isListening={false} // Todo: Sync via IPC
                    onTriggerTextHighlight={() => window.electron.ipcRenderer.send('hud:trigger-text-highlight')}
                />
            </div>
        );
    }

    if (route === '#hud-dropdown') {
        return <HUDDropdown
            personalities={[]}
            sessions={[]}
            onPersonalitySelect={() => { }}
            onSessionSelect={() => { }}
            onCreateSession={() => { }}
        />;
    }

    if (route === '#command-bar') {
        return (
            <CommandBar
                isOpen={true}
                onClose={() => window.electron.ipcRenderer.send('window:close-command-bar')}
                onCommand={(cmd) => window.electron.ipcRenderer.send('session:command', cmd)}
            />
        );
    }

    if (route === '#vintage-window') {
        return <VintageWindow visible={true} />;
    }

    if (route === '#mini-hud') {
        return (<div style={{
            width: '100vw',
            height: '100vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'transparent'
        }}><MiniHUD /></div>);
    }

    if (route === '#text-highlight-output') {
        return <TextHighlightOutput />;
    }

    if (route === '#screenshot-selector') {
        return <ScreenshotSelector />;
    }

    if (route === '#screenshot-preview') {
        return <ScreenshotPreview />;
    }

    if (route.startsWith('#workflow-editor')) {
        return (
            <WindowControls title="Workflow Editor" onClose={() => window.close()} onMinimize={() => window.electron.ipcRenderer.send('window:minimize')} onMaximize={() => window.electron.ipcRenderer.send('window:maximize')}>
                <WorkflowEditorWindow />
            </WindowControls>
        );
    }

    // Default to OverlayContainer (Main Session Window)
    return <OverlayContainer />;
}

export default App;
