import React, { useState, useEffect } from 'react';
import { AudioVisualizer } from '../../Panels/AudioVisualizer';
import { CustomSelect } from './CustomSelect';
import { getFeaturePermission, setFeaturePermission, type FeaturePermission } from '../../../utils/featurePermissions';

interface AudioSectionProps {
    selectedMic: string;
    setSelectedMic: (mic: string) => void;
    selectedSystemAudio: string;
    setSelectedSystemAudio: (audio: string) => void;
    micDevices: { id: string; label: string }[];
    systemAudioSources: { id: string; name: string }[];
    localAnalyser: AnalyserNode | null;
    sttMicAnalyser: AnalyserNode | null;
    systemLevelRef: React.MutableRefObject<number>;
    showToast: (message: string) => void;
}

export const AudioSection: React.FC<AudioSectionProps> = ({
    selectedMic,
    setSelectedMic,
    selectedSystemAudio,
    setSelectedSystemAudio,
    micDevices,
    systemAudioSources,
    localAnalyser,
    sttMicAnalyser,
    systemLevelRef,
    showToast
}) => {
    const [micPermissionGranted, setMicPermissionGranted] = useState<boolean | null>(null);
    const [systemAudioPermissionGranted, setSystemAudioPermissionGranted] = useState<boolean | null>(null);
    const [screenPermissionGranted, setScreenPermissionGranted] = useState<boolean | null>(null);
    const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);
    const [confirmDialog, setConfirmDialog] = useState<{ type: 'microphone' | 'systemAudio' | 'screen' | null; resourceName: string }>({ type: null, resourceName: '' });
    const [ocrMode, setOcrMode] = useState<'local' | 'ai'>('local');
    const [ocrCaptureMode, setOcrCaptureMode] = useState<'fullscreen' | 'area'>('fullscreen');

    useEffect(() => {
        checkPermissions();
    }, []);

    useEffect(() => {
        const loadOcrMode = async () => {
            try {
                const result = await window.textHighlightAPI?.getMode?.();
                if (result?.mode === 'ai' || result?.mode === 'local') {
                    setOcrMode(result.mode);
                }
            } catch {
                // ignore
            }
        };
        loadOcrMode();
    }, []);

    useEffect(() => {
        const loadCaptureMode = async () => {
            try {
                const result = await window.textHighlightAPI?.getCaptureMode?.();
                if (result?.mode === 'area' || result?.mode === 'fullscreen') {
                    setOcrCaptureMode(result.mode);
                }
            } catch {
                // ignore
            }
        };
        loadCaptureMode();
    }, []);

    const checkPermissions = async () => {
        setIsCheckingPermissions(true);
        try {
            // Permissões "internas" (controle do app)
            const micAllowed = getFeaturePermission('microphone');
            const sysAllowed = getFeaturePermission('systemAudio');
            const screenAllowed = getFeaturePermission('screenCapture');

            // Microfone: se permitido no app, tenta validar com getUserMedia (senão, fica negado)
            if (!micAllowed) {
                setMicPermissionGranted(false);
            } else {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    stream.getTracks().forEach(track => track.stop());
                    setMicPermissionGranted(true);
                } catch {
                    // Se o SO/navegador negar, refletir como negado e desabilitar no app
                    setFeaturePermission('microphone', false);
                    setMicPermissionGranted(false);
                }
            }

            setSystemAudioPermissionGranted(sysAllowed);
            setScreenPermissionGranted(screenAllowed);
        } catch (error) {
            console.error('Error checking permissions:', error);
        } finally {
            setIsCheckingPermissions(false);
        }
    };

    const handleManagePermission = async (type: 'microphone' | 'systemAudio' | 'screen') => {
        const resourceNames = {
            microphone: 'Microfone',
            systemAudio: 'Áudio do Sistema',
            screen: 'Captura de Tela'
        };

        const isGranted = type === 'microphone' 
            ? micPermissionGranted 
            : type === 'systemAudio' 
            ? systemAudioPermissionGranted 
            : screenPermissionGranted;

        // Se a permissão está concedida, mostrar confirmação para negar
        if (isGranted) {
            setConfirmDialog({ type, resourceName: resourceNames[type] });
            return;
        }

        // Se não está concedida, tentar conceder dentro do app
        await enablePermission(type);
    };

    const enablePermission = async (type: 'microphone' | 'systemAudio' | 'screen') => {
        try {
            if (type === 'microphone') {
                // Solicita permissao real do microfone + marca como permitido no app
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(track => track.stop());
                setFeaturePermission('microphone', true);
                setMicPermissionGranted(true);
                showToast('Permissão do microfone concedida');
                return;
            }

            const feature: FeaturePermission =
                type === 'systemAudio' ? 'systemAudio' : 'screenCapture';
            setFeaturePermission(feature, true);
            if (type === 'systemAudio') setSystemAudioPermissionGranted(true);
            if (type === 'screen') setScreenPermissionGranted(true);
            showToast(`Permissão concedida: ${type === 'systemAudio' ? 'Áudio do Sistema' : 'Captura de Tela'}`);
        } catch (error) {
            console.error('Error enabling permission:', error);
            showToast('Não foi possível conceder a permissão agora');
            if (type === 'microphone') {
                setFeaturePermission('microphone', false);
                setMicPermissionGranted(false);
            }
        }
    };

    const denyPermission = (type: 'microphone' | 'systemAudio' | 'screen') => {
        if (type === 'microphone') {
            setFeaturePermission('microphone', false);
            setMicPermissionGranted(false);
            showToast('Permissão do microfone negada no app');
            return;
        }
        if (type === 'systemAudio') {
            setFeaturePermission('systemAudio', false);
            setSystemAudioPermissionGranted(false);
            showToast('Permissão do áudio do sistema negada no app');
            return;
        }
        setFeaturePermission('screenCapture', false);
        setScreenPermissionGranted(false);
        showToast('Permissão de captura de tela negada no app');
    };

    const handleConfirmDeny = async () => {
        if (!confirmDialog.type) return;
        denyPermission(confirmDialog.type);
        setConfirmDialog({ type: null, resourceName: '' });
    };

    const handleCancelDeny = () => {
        setConfirmDialog({ type: null, resourceName: '' });
    };

    return (
        <div className="settings-content-inner">
            {/* Confirmation Dialog */}
            {confirmDialog.type && (
                <div className="permission-confirm-overlay" onClick={handleCancelDeny}>
                    <div className="permission-confirm-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="permission-confirm-header">
                            <div className="permission-confirm-icon denied">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 8v4M12 16h.01" />
                                </svg>
                            </div>
                            <h3>Negar Permissão</h3>
                        </div>
                        <div className="permission-confirm-body">
                            <p>
                                Tem certeza que deseja negar a permissão de acesso ao <strong>{confirmDialog.resourceName}</strong>?
                            </p>
                            <p className="permission-confirm-warning">
                                Isso desativa o uso desse recurso dentro do app (você pode reativar depois).
                            </p>
                        </div>
                        <div className="permission-confirm-footer">
                            <button className="permission-confirm-btn cancel" onClick={handleCancelDeny}>
                                Cancelar
                            </button>
                            <button className="permission-confirm-btn confirm" onClick={handleConfirmDeny}>
                                Negar Permissão
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="audio-settings-grid">
                <div className="audio-column">
                    <div className="audio-column-header">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /></svg>
                        <h3>Seu Microfone</h3>
                        <button 
                            className={`permission-btn ${micPermissionGranted === null ? '' : micPermissionGranted ? 'granted' : 'denied'}`}
                            onClick={() => handleManagePermission('microphone')}
                            title={micPermissionGranted === null ? 'Verificando...' : micPermissionGranted ? 'Permissão concedida' : 'Gerenciar permissão'}
                            disabled={isCheckingPermissions}
                        >
                            {micPermissionGranted === null ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="permission-loading">
                                    <circle cx="12" cy="12" r="10" />
                                </svg>
                            ) : micPermissionGranted ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M20 6L9 17l-5-5" />
                                </svg>
                            ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 8v4M12 16h.01" />
                                </svg>
                            )}
                        </button>
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
                        <button 
                            className={`permission-btn ${systemAudioPermissionGranted ? 'granted' : ''}`}
                            onClick={() => handleManagePermission('systemAudio')}
                            title={systemAudioPermissionGranted ? 'Permissão concedida' : 'Gerenciar permissão'}
                        >
                            {systemAudioPermissionGranted ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M20 6L9 17l-5-5" />
                                </svg>
                            ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 8v4M12 16h.01" />
                                </svg>
                            )}
                        </button>
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
                        <AudioVisualizer analyser={null} levelRef={systemLevelRef} width={220} height={60} />
                        <span className="visualizer-label">Monitorando saída...</span>
                    </div>
                </div>

                <div className="audio-column">
                    <div className="audio-column-header">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="12" cy="12" r="3" /><path d="M12 18v-2" /><path d="M12 8V6" /><path d="M18 12h-2" /><path d="M8 12H6" /></svg>
                        <h3>Captura de Tela</h3>
                        <button 
                            className={`permission-btn ${screenPermissionGranted ? 'granted' : ''}`}
                            onClick={() => handleManagePermission('screen')}
                            title={screenPermissionGranted ? 'Permissão concedida' : 'Gerenciar permissão'}
                        >
                            {screenPermissionGranted ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M20 6L9 17l-5-5" />
                                </svg>
                            ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 8v4M12 16h.01" />
                                </svg>
                            )}
                        </button>
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
                    <div className="input-group">
                        <label>Área de Captura</label>
                        <div className="ocr-mode-toggle">
                            <button
                                className={`ocr-mode-option ${ocrCaptureMode === 'fullscreen' ? 'active' : ''}`}
                                onClick={async () => {
                                    setOcrCaptureMode('fullscreen');
                                    await window.textHighlightAPI?.setCaptureMode?.('fullscreen');
                                    showToast('OCR por tela inteira');
                                }}
                                type="button"
                            >
                                <span className="ocr-mode-dot" />
                                Tela inteira
                            </button>
                            <button
                                className={`ocr-mode-option ${ocrCaptureMode === 'area' ? 'active' : ''}`}
                                onClick={async () => {
                                    setOcrCaptureMode('area');
                                    await window.textHighlightAPI?.setCaptureMode?.('area');
                                    showToast('OCR por área específica');
                                }}
                                type="button"
                            >
                                <span className="ocr-mode-dot" />
                                Área específica
                            </button>
                        </div>
                        <span className="ocr-mode-helper">
                            Área específica abre a seleção de captura antes do OCR.
                        </span>
                    </div>
                    <div className="input-group">
                        <label>Processamento de OCR</label>
                        <div className="ocr-mode-toggle">
                            <button
                                className={`ocr-mode-option ${ocrMode === 'local' ? 'active' : ''}`}
                                onClick={async () => {
                                    setOcrMode('local');
                                    await window.textHighlightAPI?.setMode?.('local');
                                    showToast('OCR local ativado');
                                }}
                                type="button"
                            >
                                <span className="ocr-mode-dot" />
                                Processamento Local
                            </button>
                            <button
                                className={`ocr-mode-option ${ocrMode === 'ai' ? 'active' : ''}`}
                                onClick={async () => {
                                    setOcrMode('ai');
                                    await window.textHighlightAPI?.setMode?.('ai');
                                    showToast('OCR por IA ativado');
                                }}
                                type="button"
                            >
                                <span className="ocr-mode-dot" />
                                Inteligência Artificial
                            </button>
                        </div>
                        <span className="ocr-mode-helper">
                            IA usa o modelo configurado para transcrever a tela. Local usa o OCR do dispositivo.
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
