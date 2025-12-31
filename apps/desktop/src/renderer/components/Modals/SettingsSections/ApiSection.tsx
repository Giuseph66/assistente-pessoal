import React from 'react';
import { CustomSelect } from './CustomSelect';

interface ApiSectionProps {
    apiProvider: 'google' | 'openai' | 'local';
    setApiProvider: (provider: 'google' | 'openai' | 'local') => void;
    savedProvider: string | null;
    geminiKey: string;
    openaiKey: string;
    setGeminiKey: (key: string) => void;
    setOpenaiKey: (key: string) => void;
    handleSaveKey: () => void;
    performance: string;
    setPerformance: (value: string) => void;
    analysisModel: string;
    setAnalysisModel: (model: string) => void;
    liveModel: string;
    setLiveModel: (model: string) => void;
    showToast: (message: string) => void;
}

export const ApiSection: React.FC<ApiSectionProps> = ({
    apiProvider,
    setApiProvider,
    savedProvider,
    geminiKey,
    openaiKey,
    setGeminiKey,
    setOpenaiKey,
    handleSaveKey,
    performance,
    setPerformance,
    analysisModel,
    setAnalysisModel,
    liveModel,
    setLiveModel,
    showToast
}) => {
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
};

