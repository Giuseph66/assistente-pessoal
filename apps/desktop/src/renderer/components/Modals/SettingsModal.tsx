import React, { useState, useEffect, useRef } from 'react';
import { useSttMicAnalyser } from '../../store/sttMicStore';
import { ApiSection } from './SettingsSections/ApiSection';
import { AudioSection } from './SettingsSections/AudioSection';
import { PermissionsSection } from './SettingsSections/PermissionsSection';
import { FeaturesSection } from './SettingsSections/FeaturesSection';
import { PrivacySection } from './SettingsSections/PrivacySection';
import { ShortcutsSection } from './SettingsSections/ShortcutsSection';
import { ProfileSection } from './SettingsSections/ProfileSection';
import { HelpSection } from './SettingsSections/HelpSection';
import './SettingsModal.css';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type SettingsSection =
    | 'api'
    | 'audio'
    | 'permissions'
    | 'features'
    | 'shortcuts'
    | 'privacy'
    | 'profile'
    | 'premium'
    | 'help';


export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [activeSection, setActiveSection] = useState<SettingsSection>('api');
    const [performance, setPerformance] = useState('personalizado');
    const [apiProvider, setApiProvider] = useState<'google' | 'openai' | 'local'>('google');
    const [toast, setToast] = useState<string | null>(null);

    // Model selection states
    const [analysisModel, setAnalysisModel] = useState('Gemini 3 Pro');
    const [liveModel, setLiveModel] = useState('Gemini 2.0 Flash (Live)');

    // API Key states
    const [geminiKey, setGeminiKey] = useState('');
    const [openaiKey, setOpenaiKey] = useState('');
    const [isKeyLoaded, setIsKeyLoaded] = useState(false);
    const [savedProvider, setSavedProvider] = useState<string | null>(null);

    // Audio states
    const [selectedMic, setSelectedMic] = useState('Microfone Padrão');
    const [selectedSystemAudio, setSelectedSystemAudio] = useState('Áudio do Sistema (Nativo)');
    const [micDevices, setMicDevices] = useState<{ id: string; label: string }[]>([]);
    const [systemAudioSources, setSystemAudioSources] = useState<{ id: string; name: string }[]>([]);
    const sttMicAnalyser = useSttMicAnalyser();
    const [localAnalyser, setLocalAnalyser] = useState<AnalyserNode | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const localContextRef = useRef<AudioContext | null>(null);
    const systemLevelRef = useRef(0);

    // Fetch keys and config on mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch keys
                const keys = await (globalThis as any).ai.listKeys();
                if (keys && Array.isArray(keys)) {
                    const gKey = keys.find((k: { providerId: string; last4: string }) => k.providerId === 'gemini');
                    const oKey = keys.find((k: { providerId: string; last4: string }) => k.providerId === 'openai');

                    if (gKey) setGeminiKey(`•••• •••• •••• ${gKey.last4}`);
                    if (oKey) setOpenaiKey(`•••• •••• •••• ${oKey.last4}`);
                }

                // Fetch active config
                const config = await (globalThis as any).ai.getConfig();
                if (config && config.providerId) {
                    setSavedProvider(config.providerId);
                    // Sincroniza a aba atual com o provedor salvo no primeiro carregamento
                    setApiProvider(config.providerId === 'gemini' ? 'google' : config.providerId === 'openai' ? 'openai' : 'local');
                }

                setIsKeyLoaded(true);

                // Fetch audio devices
                const devices = await navigator.mediaDevices.enumerateDevices();
                const mics = devices
                    .filter((d: MediaDeviceInfo) => d.kind === 'audioinput')
                    .map((d: MediaDeviceInfo) => ({
                        id: d.deviceId,
                        label: d.deviceId === 'default' ? 'Padrão' : (d.label || `Microfone ${d.deviceId.slice(0, 5)}`)
                    }))
                    .sort((a, b) => (a.id === 'default' ? -1 : b.id === 'default' ? 1 : 0)); // Ensure Padrão is first

                setMicDevices(mics);
                if (mics.length > 0) {
                    // Prefer 'Padrão' if available, otherwise first
                    const defaultMic = mics.find(m => m.id === 'default') || mics[0];
                    setSelectedMic(defaultMic.label);
                }

                // Fetch system audio sources
                const sources = await (globalThis as any).window.electron.ipcRenderer.invoke('systemAudio.listSources');
                if (sources && Array.isArray(sources)) {
                    setSystemAudioSources(sources);
                    setSelectedSystemAudio('Padrão');
                }
            } catch (error) {
                console.error('Failed to fetch settings data:', error);
            }
        };
        fetchData();
    }, []);

    const handleSaveKey = async () => {
        const currentKey = apiProvider === 'google' ? geminiKey : openaiKey;
        const providerId = apiProvider === 'google' ? 'gemini' : 'openai';

        try {
            // Se a chave não começar com os pontos, salva a nova chave
            if (!currentKey.startsWith('••••')) {
                if (!currentKey.trim()) {
                    showToast('Por favor, insira uma chave de API válida.');
                    return;
                }
                await (globalThis as any).ai.addKey(providerId, currentKey, `Key ${apiProvider.toUpperCase()}`);

                // Atualiza o estado com a versão mascarada após salvar
                const last4 = currentKey.slice(-4);
                if (apiProvider === 'google') setGeminiKey(`•••• •••• •••• ${last4}`);
                else setOpenaiKey(`•••• •••• •••• ${last4}`);
            }

            // Salva a configuração como ativa
            await (globalThis as any).ai.saveConfig({ providerId });
            setSavedProvider(providerId);
            showToast(`Configurações de ${apiProvider.toUpperCase()} aplicadas e ativadas!`);
        } catch (error) {
            showToast('Erro ao salvar as configurações.');
            console.error(error);
        }
    };

    useEffect(() => {
        if (apiProvider === 'google') {
            setAnalysisModel('Gemini 3 Pro');
            setLiveModel('Gemini 2.0 Flash (Live)');
        } else if (apiProvider === 'openai') {
            setAnalysisModel('GPT-5.2 Standard');
            setLiveModel('GPT-4o Realtime');
        }
    }, [apiProvider]);

    useEffect(() => {
        if (isOpen && activeSection === 'audio') {
            const startLocalMic = async () => {
                try {
                    const mic = micDevices.find((d: { label: string }) => d.label === selectedMic);
                    const constraints = mic ? { audio: { deviceId: { exact: mic.id } } } : { audio: true };
                    const stream = await navigator.mediaDevices.getUserMedia(constraints);
                    const context = new AudioContext();
                    const source = context.createMediaStreamSource(stream);
                    const analyser = context.createAnalyser();
                    analyser.fftSize = 256;
                    source.connect(analyser);

                    localStreamRef.current = stream;
                    localContextRef.current = context;
                    setLocalAnalyser(analyser);
                } catch (err) {
                    console.error('Error capturing local mic:', err);
                }
            };

            startLocalMic();
        } else {
            // Cleanup Mic
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((t: MediaStreamTrack) => t.stop());
                localStreamRef.current = null;
            }
            if (localContextRef.current) {
                localContextRef.current.close();
                localContextRef.current = null;
            }
            setLocalAnalyser(null);
        }
    }, [isOpen, activeSection, selectedMic, micDevices]);

    // System Audio Preview Effect
    useEffect(() => {
        if (!isOpen || activeSection !== 'audio' || !(globalThis as any).window.systemAudio) {
            return;
        }

        let isMounted = true;
        let offLevel: (() => void) | undefined;

        // Registrar listener primeiro para garantir que não perdemos eventos
        offLevel = (globalThis as any).window.systemAudio?.onLevel((payload: { level: number }) => {
            if (isMounted) {
                systemLevelRef.current = payload.level;
            }
        });

        const startPreview = async () => {
            try {
                if (!isMounted) return;
                
                let source = systemAudioSources.find((s: { name: string; id: string }) => s.name === selectedSystemAudio);
                if (selectedSystemAudio === 'Padrão') {
                    source = systemAudioSources.find((s: any) => s.isDefaultCandidate) || systemAudioSources[0];
                }
                
                if (!source?.id) {
                    console.warn('No system audio source selected');
                    return;
                }

                await (globalThis as any).window.systemAudio.startPreview(source.id);
            } catch (err) {
                console.error('Failed to start system audio preview:', err);
                systemLevelRef.current = 0;
            }
        };

        // Aguardar que as fontes estejam disponíveis antes de iniciar
        if (systemAudioSources.length > 0) {
            startPreview();
        }

        return () => {
            isMounted = false;
            if (offLevel) {
                offLevel();
            }
            (globalThis as any).window.systemAudio?.stopPreview().catch(() => {
                // Ignorar erros ao parar preview
            });
            systemLevelRef.current = 0;
        };
    }, [isOpen, activeSection, selectedSystemAudio, systemAudioSources]);

    const showToast = (message: string) => {
        setToast(message);
        setTimeout(() => setToast(null), 3000);
    };

    if (!isOpen) return null;

    const renderContent = () => {
        switch (activeSection) {
            case 'api':
                return (
                    <ApiSection
                        apiProvider={apiProvider}
                        setApiProvider={setApiProvider}
                        savedProvider={savedProvider}
                        geminiKey={geminiKey}
                        openaiKey={openaiKey}
                        setGeminiKey={setGeminiKey}
                        setOpenaiKey={setOpenaiKey}
                        handleSaveKey={handleSaveKey}
                        performance={performance}
                        setPerformance={setPerformance}
                        analysisModel={analysisModel}
                        setAnalysisModel={setAnalysisModel}
                        liveModel={liveModel}
                        setLiveModel={setLiveModel}
                        showToast={showToast}
                    />
                );
            case 'audio':
                return (
                    <AudioSection
                        selectedMic={selectedMic}
                        setSelectedMic={setSelectedMic}
                        selectedSystemAudio={selectedSystemAudio}
                        setSelectedSystemAudio={setSelectedSystemAudio}
                        micDevices={micDevices}
                        systemAudioSources={systemAudioSources}
                        localAnalyser={localAnalyser}
                        sttMicAnalyser={sttMicAnalyser}
                        systemLevelRef={systemLevelRef}
                        showToast={showToast}
                    />
                );
            case 'permissions':
                return <PermissionsSection />;
            case 'help':
                return <HelpSection />;
            case 'features':
                return (
                    <FeaturesSection
                        performance={performance}
                        setPerformance={setPerformance}
                        showToast={showToast}
                    />
                );
            case 'privacy':
                return <PrivacySection />;
            case 'shortcuts':
                return <ShortcutsSection />;
            case 'profile':
                return <ProfileSection />;
        }
    };

    return (
        <div className="modal-window" onClick={e => e.stopPropagation()}>
            {/* Toast Notification */}
            {toast && (
                <div className="settings-toast">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                    <span>{toast}</span>
                </div>
            )}

            {/* Header */}
            <div className="modal-header">
                <span className="header-title">Configurações</span>
                <button className="close-btn-red" onClick={onClose}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>

            <div className="modal-main">
                {/* Sidebar */}
                <div className="modal-sidebar">
                    <nav className="sidebar-nav">
                        <button className={`sidebar-item ${activeSection === 'api' ? 'active' : ''}`} onClick={() => setActiveSection('api')}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                            API e Modelos
                        </button>
                        <button className={`sidebar-item ${activeSection === 'audio' ? 'active' : ''}`} onClick={() => setActiveSection('audio')}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
                            Áudio e Tela
                        </button>
                        <button className={`sidebar-item ${activeSection === 'permissions' ? 'active' : ''}`} onClick={() => setActiveSection('permissions')}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                            Permissões
                        </button>
                        <button className={`sidebar-item ${activeSection === 'features' ? 'active' : ''}`} onClick={() => setActiveSection('features')}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="2" y1="14" x2="6" y2="14" /><line x1="10" y1="8" x2="14" y2="8" /><line x1="18" y1="16" x2="22" y2="16" /></svg>
                            Recursos
                        </button>
                        <button className={`sidebar-item ${activeSection === 'shortcuts' ? 'active' : ''}`} onClick={() => setActiveSection('shortcuts')}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" ry="2" /><line x1="6" y1="8" x2="6" y2="8" /><line x1="10" y1="8" x2="10" y2="8" /><line x1="14" y1="8" x2="14" y2="8" /><line x1="18" y1="8" x2="18" y2="8" /><line x1="6" y1="12" x2="6" y2="12" /><line x1="10" y1="12" x2="10" y2="12" /><line x1="14" y1="12" x2="14" y2="12" /><line x1="18" y1="12" x2="18" y2="12" /><line x1="7" y1="16" x2="17" y2="16" /></svg>
                            Atalhos
                        </button>
                        <button className={`sidebar-item ${activeSection === 'privacy' ? 'active' : ''}`} onClick={() => setActiveSection('privacy')}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                            Privacidade
                        </button>
                        <button className={`sidebar-item ${activeSection === 'profile' ? 'active' : ''}`} onClick={() => setActiveSection('profile')}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                            Perfil
                        </button>{/*
                            <button className={`sidebar-item ${activeSection === 'premium' ? 'active' : ''}`} onClick={() => setActiveSection('premium')}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                Premium
                            </button>
                                */}
                        <button className={`sidebar-item ${activeSection === 'help' ? 'active' : ''}`} onClick={() => setActiveSection('help')}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12" y2="17" /></svg>
                            Ajuda
                        </button>
                    </nav>
                </div>

                {/* Content */}
                <div className="modal-content">
                    {renderContent()}
                </div>
            </div>

            {/* Footer */}
            <div className="modal-footer">
                <button className="power-btn" onClick={() => (globalThis as any).window.electron.ipcRenderer.send('app:quit')}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                        <line x1="12" y1="2" x2="12" y2="12" />
                    </svg>
                </button>
                <button className="btn-save" onClick={onClose}>Salvar</button>
            </div>
        </div>
    );
};
