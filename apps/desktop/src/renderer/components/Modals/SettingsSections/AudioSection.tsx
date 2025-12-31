import React from 'react';
import { AudioVisualizer } from '../../Panels/AudioVisualizer';
import { CustomSelect } from './CustomSelect';

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
                        <AudioVisualizer analyser={null} levelRef={systemLevelRef} width={220} height={60} />
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
};

