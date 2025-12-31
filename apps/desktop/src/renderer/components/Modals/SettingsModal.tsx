import React, { useState, useEffect, useRef } from 'react';
import { AudioVisualizer } from '../Panels/AudioVisualizer';
import { useSttMicAnalyser } from '../../store/sttMicStore';
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

interface CustomSelectProps {
    options: string[];
    value: string;
    onChange: (value: string) => void;
    icon?: React.ReactNode;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ options, value, onChange, icon }) => {
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

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [activeSection, setActiveSection] = useState<SettingsSection>('api');
    const [performance, setPerformance] = useState('personalizado');
    const [audioTab, setAudioTab] = useState<'mic' | 'system'>('mic');
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
    const [systemLevel, setSystemLevel] = useState(0);
    const localStreamRef = useRef<MediaStream | null>(null);
    const localContextRef = useRef<AudioContext | null>(null);

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
        if (isOpen && activeSection === 'audio') {
            let isMounted = true;

            const startPreview = async () => {
                try {
                    let source = systemAudioSources.find((s: { name: string; id: string }) => s.name === selectedSystemAudio);
                    if (selectedSystemAudio === 'Padrão') {
                        source = systemAudioSources.find((s: any) => s.isDefaultCandidate) || systemAudioSources[0];
                    }
                    if (source && (globalThis as any).window.systemAudio) {
                        await (globalThis as any).window.systemAudio.startPreview(source.id);
                    }
                } catch (err) {
                    console.error('Failed to start system audio preview:', err);
                }
            };

            const offLevel = (globalThis as any).window.systemAudio?.onLevel((payload: { level: number }) => {
                if (isMounted) setSystemLevel(payload.level);
            });

            startPreview();

            return () => {
                isMounted = false;
                if (offLevel) offLevel();
                (globalThis as any).window.systemAudio?.stopPreview();
                setSystemLevel(0);
            };
        }
        return undefined;
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
                    <div className="settings-content-inner">
                        <div className="content-header">
                            <div className="provider-tabs">
                                <button
                                    className={`provider-tab ${apiProvider === 'google' ? 'active' : ''}`}
                                    onClick={() => setApiProvider('google')}
                                >
                                    Google Gemini {savedProvider === 'gemini' && <span className="check-icon">✓</span>}
                                </button>
                                <button
                                    className={`provider-tab ${apiProvider === 'openai' ? 'active' : ''}`}
                                    onClick={() => setApiProvider('openai')}
                                >
                                    OpenAI {savedProvider === 'openai' && <span className="check-icon">✓</span>}
                                </button>
                                <button
                                    className={`provider-tab ${apiProvider === 'local' ? 'active' : ''}`}
                                    onClick={() => setApiProvider('local')}
                                >
                                    Local LLM (Ollama) {savedProvider === 'local' && <span className="check-icon">✓</span>}
                                </button>
                            </div>
                        </div>

                        <div className="settings-body">
                            {apiProvider === 'local' ? (
                                <div className="local-llm-placeholder">
                                    <div className="placeholder-icon">
                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 16V8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2z" /><path d="M9 13v2" /><path d="M15 13v2" /><path d="M12 9v2" /></svg>
                                    </div>
                                    <h3>Integração Local em Breve</h3>
                                    <p>Estamos trabalhando para suportar Ollama, LM Studio e outras LLMs rodando localmente na sua máquina.</p>
                                    <button className="btn-future" onClick={() => showToast('Esta funcionalidade será implementada em breve!')}>
                                        Me avise quando estiver pronto
                                    </button>
                                </div>
                            ) : (
                                <div className="api-selection-content">
                                    <div className="api-key-card-premium">
                                        <div className="api-key-card-header">
                                            <div className="provider-info-main">
                                                <div className={`provider-icon-circle ${apiProvider}`}>
                                                    {apiProvider === 'google' ? (
                                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                                                    ) : (
                                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20" /></svg>
                                                    )}
                                                </div>
                                                <div className="provider-text-details">
                                                    <div className="provider-title-row">
                                                        <h4>{apiProvider === 'google' ? 'Google Gemini API' : 'OpenAI API'}</h4>
                                                        <span className={`status-badge-premium ${savedProvider === (apiProvider === 'google' ? 'gemini' : apiProvider) ? 'active' : ''}`}>
                                                            {savedProvider === (apiProvider === 'google' ? 'gemini' : apiProvider) ? 'Conectado' : 'Pendente'}
                                                        </span>
                                                    </div>
                                                    <p>{apiProvider === 'google' ? 'Modelos Pro e Flash de última geração' : 'GPT-4o e modelos de raciocínio o1'}</p>
                                                </div>
                                            </div>
                                            <button
                                                className="btn-get-key-premium"
                                                onClick={() => {
                                                    const url = apiProvider === 'google'
                                                        ? 'https://aistudio.google.com/api-keys'
                                                        : 'https://platform.openai.com/api-keys';
                                                    (globalThis as any).electron.ipcRenderer.send('app:open-url', url);
                                                }}
                                            >
                                                Obter Chave <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" /></svg>
                                            </button>
                                        </div>

                                        <div className="api-key-input-section-premium">
                                            <div className="input-with-label-premium">
                                                <label>Sua Chave de Acesso</label>
                                                <div className="premium-input-wrapper">
                                                    <input
                                                        type="password"
                                                        placeholder={`sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}
                                                        className="premium-api-input"
                                                        value={apiProvider === 'google' ? geminiKey : openaiKey}
                                                        onChange={(e) => {
                                                            const val = (e.target as any).value;
                                                            if (apiProvider === 'google') setGeminiKey(val);
                                                            else setOpenaiKey(val);
                                                        }}
                                                    />
                                                    <div className="input-glow"></div>
                                                </div>
                                            </div>

                                            <button
                                                className={`btn-activate-premium ${savedProvider === (apiProvider === 'google' ? 'gemini' : apiProvider) ? 'active' : ''}`}
                                                onClick={handleSaveKey}
                                            >
                                                {savedProvider === (apiProvider === 'google' ? 'gemini' : apiProvider) ? (
                                                    <><span className="check-circle">✓</span> Ativado</>
                                                ) : (
                                                    'Ativar Modelo'
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="performance-section-title">Configurações de Desempenho</div>
                                    <div className="performance-grid">
                                        <button className={`perf-card ${performance === 'rapido' ? 'active' : ''}`} onClick={() => setPerformance('rapido')}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                                            <div className="perf-info">
                                                <span className="perf-title">Rápido</span>
                                                <span className="perf-desc">Respostas rápidas, respostas curtas</span>
                                            </div>
                                        </button>
                                        <button className={`perf-card ${performance === 'padrao' ? 'active' : ''}`} onClick={() => setPerformance('padrao')}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /></svg>
                                            <div className="perf-info">
                                                <span className="perf-title">Padrão</span>
                                                <span className="perf-desc">Equilíbrio entre velocidade e qualidade</span>
                                            </div>
                                        </button>
                                        <button className={`perf-card ${performance === 'qualidade' ? 'active' : ''}`} onClick={() => setPerformance('qualidade')}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                            <div className="perf-info">
                                                <span className="perf-title">Qualidade</span>
                                                <span className="perf-desc">Respostas completas e detalhadas</span>
                                            </div>
                                        </button>
                                        <button className={`perf-card ${performance === 'personalizado' ? 'active' : ''}`} onClick={() => setPerformance('personalizado')}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7h-9m3 3H5m16 6h-9m3 3H5" /></svg>
                                            <div className="perf-info">
                                                <span className="perf-title">Personalizado</span>
                                                <span className="perf-desc">Escolha seus próprios modelos</span>
                                            </div>
                                        </button>
                                    </div>

                                    <div className="input-group">
                                        <label>Modelo de Análise</label>
                                        <CustomSelect
                                            value={analysisModel}
                                            onChange={(val) => {
                                                setAnalysisModel(val);
                                                showToast(`Modelo de análise alterado para ${val}`);
                                            }}
                                            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>}
                                            options={apiProvider === 'google'
                                                ? ['Gemini 3 Pro', 'Gemini 3 Flash', 'Gemini 2.5 Pro', 'Gemini 2.5 Flash', 'Gemini 2.5 Flash-Lite']
                                                : ['GPT-5.2 Standard', 'GPT-5.2 Mini', 'GPT-4.1 Standard', 'GPT-4o', 'o1']
                                            }
                                        />
                                        <span className="input-help">Modelo usado para analisar imagens e conversas</span>
                                    </div>

                                    <div className="input-group">
                                        <label>Modelo de Transcrição Live</label>
                                        <CustomSelect
                                            value={liveModel}
                                            onChange={(val) => {
                                                setLiveModel(val);
                                                showToast(`Modelo de transcrição alterado para ${val}`);
                                            }}
                                            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /></svg>}
                                            options={apiProvider === 'google'
                                                ? ['Gemini 2.0 Flash (Live)', 'Gemini 1.5 Flash']
                                                : ['GPT-4o Realtime', 'GPT-4o Mini Realtime', 'Whisper v3']
                                            }
                                        />
                                        <span className="input-help">Selecione o modelo usado para transcrição de voz em tempo real</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            case 'audio':
                return (
                    <div className="settings-content-inner">
                        <div className="audio-settings-grid">
                            <div className="audio-column">
                                <div className="audio-column-header">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /></svg>
                                    <h3>Seu Microfone</h3>
                                </div>
                                <div className="input-group">
                                    <label>Dispositivo de Entrada</label>
                                    <CustomSelect
                                        value={selectedMic}
                                        onChange={(val) => {
                                            setSelectedMic(val);
                                            showToast(`Microfone alterado para ${val}`);
                                        }}
                                        options={micDevices.length > 0 ? micDevices.map(d => d.label) : ['Microfone Padrão']}
                                    />
                                </div>
                                <div className="visualizer-container-settings">
                                    <AudioVisualizer analyser={localAnalyser || sttMicAnalyser} width={220} height={60} />
                                    <span className="visualizer-label">Monitorando entrada...</span>
                                </div>
                            </div>

                            <div className="audio-column">
                                <div className="audio-column-header">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /></svg>
                                    <h3>Áudio do Sistema</h3>
                                </div>
                                <div className="input-group">
                                    <label>Fonte de Captura</label>
                                    <CustomSelect
                                        value={selectedSystemAudio}
                                        onChange={(val) => {
                                            setSelectedSystemAudio(val);
                                            showToast(`Fonte de áudio alterada para ${val}`);
                                        }}
                                        options={['Padrão', ...systemAudioSources.map(s => s.name)]}
                                    />
                                </div>
                                <div className="visualizer-container-settings">
                                    <AudioVisualizer analyser={null} level={systemLevel} width={220} height={60} />
                                    <span className="visualizer-label">Monitorando saída...</span>
                                </div>
                            </div>

                            <div className="audio-column">
                                <div className="audio-column-header">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="12" cy="12" r="3" /><path d="M12 18v-2" /><path d="M12 8V6" /><path d="M18 12h-2" /><path d="M8 12H6" /></svg>
                                    <h3>Captura de Tela</h3>
                                </div>
                                <div className="input-group">
                                    <label>Qualidade da Captura</label>
                                    <CustomSelect
                                        value="Alta (1080p)"
                                        onChange={(val) => showToast(`Qualidade alterada para ${val}`)}
                                        options={['Baixa (480p)', 'Média (720p)', 'Alta (1080p)', 'Nativa (4K)']}
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Frequência de Captura</label>
                                    <CustomSelect
                                        value="1 FPS"
                                        onChange={(val) => showToast(`Frequência alterada para ${val}`)}
                                        options={['0.5 FPS', '1 FPS', '2 FPS', '5 FPS']}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'permissions':
                return (
                    <div className="settings-content-inner">
                        <div className="permissions-grid">
                            <div className="permission-card-premium">
                                <div className="permission-card-header">
                                    <div className="permission-icon-box">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /></svg>
                                    </div>
                                    <div className="permission-status-badge active">
                                        <span className="pulse"></span>
                                        Ativo
                                    </div>
                                </div>
                                <div className="permission-card-body">
                                    <h3>Acesso ao Microfone</h3>
                                    <p>Permite que o assistente capture e processe sua voz em tempo real para transcrição e comandos.</p>
                                </div>
                                <div className="permission-card-footer">
                                    <button className="btn-manage-permission">Gerenciar</button>
                                </div>
                            </div>

                            <div className="permission-card-premium">
                                <div className="permission-card-header">
                                    <div className="permission-icon-box">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                                    </div>
                                    <div className="permission-status-badge active">
                                        <span className="pulse"></span>
                                        Ativo
                                    </div>
                                </div>
                                <div className="permission-card-body">
                                    <h3>Privacidade e Dados</h3>
                                    <p>Seus dados são processados localmente e criptografados antes de serem enviados para a nuvem.</p>
                                </div>
                                <div className="permission-card-footer">
                                    <button className="btn-manage-permission">Configurar</button>
                                </div>
                            </div>
                        </div>
                        <div className="stealth-mode-info">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                            <span>O aplicativo opera em modo furtivo. Use <strong>Ctrl + B</strong> para alternar visibilidade.</span>
                        </div>
                    </div>
                );
            case 'help':
                return (
                    <div className="settings-content-inner">
                        <div className="help-center-header">
                            <h2>Central de Ajuda</h2>
                            <p>Como podemos ajudar você hoje?</p>
                        </div>

                        <div className="help-categories">
                            <div className="help-cat-card">
                                <div className="cat-icon discord">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037 19.736 19.736 0 0 0-4.885 1.515.069.069 0 0 0-.032.027C.533 9.048-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" /></svg>
                                </div>
                                <h4>Comunidade</h4>
                                <p>Tire dúvidas e compartilhe ideias no Discord.</p>
                                <button className="btn-cat">Entrar</button>
                            </div>
                            <div className="help-cat-card">
                                <div className="cat-icon docs">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
                                </div>
                                <h4>Documentação</h4>
                                <p>Guias detalhados sobre todas as funções.</p>
                                <button className="btn-cat">Ler Guias</button>
                            </div>
                            <div className="help-cat-card">
                                <div className="cat-icon support">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                                </div>
                                <h4>Suporte</h4>
                                <p>Fale diretamente com nosso time técnico.</p>
                                <button className="btn-cat">Abrir Ticket</button>
                            </div>
                        </div>

                        <div className="diagnosis-section">
                            <div className="diagnosis-header">
                                <div className="diagnosis-title">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                                    <span>Diagnóstico e Logs</span>
                                </div>
                            </div>
                            <div className="diagnosis-content">
                                <div className="log-info-premium">
                                    <div className="log-path-display">
                                        <span className="label">Caminho dos Logs:</span>
                                        <code className="path">~/.config/ricky-assistant/logs</code>
                                    </div>
                                    <div className="log-actions-premium">
                                        <button className="btn-diagnosis-outline" onClick={() => (globalThis as any).window.electron.ipcRenderer.send('app:open-log-folder')}>
                                            Abrir Pasta
                                        </button>
                                        <button className="btn-diagnosis-primary">
                                            Copiar Logs
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'features':
                return (
                    <div className="settings-content-inner">
                        <div className="content-header">
                            <h3>Recursos e Desempenho</h3>
                            <p className="header-desc">Ajuste o equilíbrio entre velocidade e qualidade para o seu assistente.</p>
                        </div>
                        <div className="settings-body">
                            <div className="input-group">
                                <label>Perfil de Desempenho</label>
                                <CustomSelect
                                    value={performance}
                                    onChange={(val) => {
                                        setPerformance(val);
                                        showToast(`Perfil de desempenho alterado para ${val}`);
                                    }}
                                    icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>}
                                    options={['personalizado', 'qualidade', 'padrao', 'rapido']}
                                />
                                <span className="input-help">Escolha como o assistente deve priorizar o processamento</span>
                            </div>

                            <div className="feature-toggle-list">
                                <div className="feature-toggle-item">
                                    <div className="toggle-info">
                                        <h4>Análise de Contexto Contínua</h4>
                                        <p>Permite que o assistente analise o que você está fazendo sem precisar ser chamado.</p>
                                    </div>
                                    <div className="toggle-switch active"></div>
                                </div>
                                <div className="feature-toggle-item">
                                    <div className="toggle-info">
                                        <h4>Sugestões Proativas</h4>
                                        <p>O assistente sugerirá ações baseadas no seu fluxo de trabalho atual.</p>
                                    </div>
                                    <div className="toggle-switch"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'privacy':
                return (
                    <div className="settings-content-inner">
                        <div className="content-header">
                            <h3>Privacidade e Segurança</h3>
                            <p className="header-desc">Gerencie como seus dados são tratados e armazenados localmente.</p>
                        </div>
                        <div className="settings-body">
                            <div className="feature-toggle-list">
                                <div className="feature-toggle-item">
                                    <div className="toggle-info">
                                        <h4>Histórico Local Criptografado</h4>
                                        <p>Todas as suas sessões são salvas apenas na sua máquina com criptografia de ponta.</p>
                                    </div>
                                    <div className="toggle-switch active"></div>
                                </div>
                                <div className="feature-toggle-item">
                                    <div className="toggle-info">
                                        <h4>Modo Furtivo Automático</h4>
                                        <p>Oculta o aplicativo automaticamente quando não estiver em uso.</p>
                                    </div>
                                    <div className="toggle-switch active"></div>
                                </div>
                                <div className="feature-toggle-item">
                                    <div className="toggle-info">
                                        <h4>Anonimizar Dados de Telemetria</h4>
                                        <p>Remove informações identificáveis antes de enviar logs de erro.</p>
                                    </div>
                                    <div className="toggle-switch"></div>
                                </div>
                            </div>
                            <div className="danger-zone-settings">
                                <h4>Zona de Perigo</h4>
                                <button className="btn-danger-outline">Limpar Todo o Histórico</button>
                            </div>
                        </div>
                    </div>
                );
            case 'shortcuts':
                return (
                    <div className="settings-content-inner">
                        <div className="content-header">
                            <h3>Atalhos de Teclado</h3>
                            <p className="header-desc">Personalize os atalhos de teclado para corresponder ao seu fluxo de trabalho. Clique em "Alterar" para gravar um novo atalho.</p>
                        </div>
                        <div className="settings-body">
                            <div className="shortcut-card">
                                <div className="shortcut-info">
                                    <span className="shortcut-title">Perguntar Qualquer Coisa / Enviar</span>
                                    <span className="shortcut-desc">Envie seu prompt ou abra a entrada de texto para fazer uma pergunta</span>
                                </div>
                                <div className="shortcut-actions">
                                    <div className="shortcut-display">
                                        <span className="key">Ctrl</span>
                                        <span className="plus">+</span>
                                        <span className="key">Enter</span>
                                    </div>
                                    <button className="btn-change">Change</button>
                                </div>
                            </div>

                            <div className="shortcut-card">
                                <div className="shortcut-info">
                                    <span className="shortcut-title">Capturar Captura de Tela</span>
                                    <span className="shortcut-desc">Capture uma captura de tela da sua tela para análise</span>
                                </div>
                                <div className="shortcut-actions">
                                    <div className="shortcut-display">
                                        <span className="key">Ctrl</span>
                                        <span className="plus">+</span>
                                        <span className="key">E</span>
                                    </div>
                                    <button className="btn-change">Change</button>
                                </div>
                            </div>

                            <div className="shortcut-card">
                                <div className="shortcut-info">
                                    <span className="shortcut-title">Gravação de Voz</span>
                                    <span className="shortcut-desc">Inicie ou pare a gravação de voz para transcrição</span>
                                </div>
                                <div className="shortcut-actions">
                                    <div className="shortcut-display">
                                        <span className="key">Ctrl</span>
                                        <span className="plus">+</span>
                                        <span className="key">D</span>
                                    </div>
                                    <button className="btn-change">Change</button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'profile':
                return (
                    <div className="settings-content-inner">
                        <div className="profile-header-premium">
                            <div className="profile-avatar-large">
                                <img src="https://ui-avatars.com/api/?name=User&background=4f46e5&color=fff" alt="Avatar" />
                                <button className="edit-avatar-btn">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                                </button>
                            </div>
                            <div className="profile-info-main">
                                <h2>Usuário Neurelix</h2>
                                <p>usuario@exemplo.com</p>
                                <div className="profile-badges">
                                    <span className="badge-premium">PREMIUM</span>
                                    <span className="badge-status">ATIVO</span>
                                </div>
                            </div>
                            <button className="btn-edit-profile">Editar Perfil</button>
                        </div>

                        <div className="stats-dashboard-card-settings">
                            <div className="dashboard-header">
                                <div className="dashboard-title-group">
                                    <h2>Visão Geral do Uso</h2>
                                    <p>Estatísticas detalhadas de todas as suas sessões</p>
                                </div>
                                <div className="dashboard-period">Últimos 30 dias</div>
                            </div>

                            <div className="stats-grid-premium">
                                <div className="stat-item-premium">
                                    <div className="stat-icon-wrapper blue">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                                    </div>
                                    <div className="stat-data">
                                        <span className="stat-label-premium">Total de Sessões</span>
                                        <span className="stat-value-premium">128</span>
                                    </div>
                                </div>
                                <div className="stat-item-premium">
                                    <div className="stat-icon-wrapper green">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /></svg>
                                    </div>
                                    <div className="stat-data">
                                        <span className="stat-label-premium">Horas de Áudio</span>
                                        <span className="stat-value-premium">42.5h</span>
                                    </div>
                                </div>
                                <div className="stat-item-premium">
                                    <div className="stat-icon-wrapper purple">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
                                    </div>
                                    <div className="stat-data">
                                        <span className="stat-label-premium">Mensagens IA</span>
                                        <span className="stat-value-premium">1,452</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
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
