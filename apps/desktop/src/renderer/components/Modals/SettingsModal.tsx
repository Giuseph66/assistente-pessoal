import React, { useState } from 'react';
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
    const [audioTab, setAudioTab] = useState<'mic' | 'system'>('mic');

    if (!isOpen) return null;

    const renderContent = () => {
        switch (activeSection) {
            case 'api':
                return (
                    <div className="settings-content-inner">
                        <div className="content-header">
                            <div className="provider-tabs">
                                <button className="provider-tab">OpenAI</button>
                                <button className="provider-tab active">Google <span className="check-icon">✓</span></button>
                                <button className="provider-tab">OpenRouter</button>
                                <button className="provider-tab locked">Custom API <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg></button>
                            </div>
                        </div>

                        <div className="settings-body">
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
                                        <span className="perf-desc">Boa combinação de velocidade e qualidade</span>
                                    </div>
                                </button>
                                <button className={`perf-card ${performance === 'qualidade' ? 'active' : ''}`} onClick={() => setPerformance('qualidade')}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                    <div className="perf-info">
                                        <span className="perf-title">Qualidade</span>
                                        <span className="perf-desc">Respostas completas, respostas detalhadas</span>
                                    </div>
                                </button>
                                <button className={`perf-card ${performance === 'personalizado' ? 'active' : ''}`} onClick={() => setPerformance('personalizado')}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7h-9m3 3H5m16 6h-9m3 3H5" /></svg>
                                    <div className="perf-info">
                                        <span className="perf-title">Personalizado</span>
                                        <span className="perf-desc">Escolha seus próprios modelos</span>
                                    </div>
                                    {performance === 'personalizado' && <div className="card-check">✓</div>}
                                </button>
                            </div>

                            <div className="info-box blue">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                                <span>As seleções de modelo são otimizadas automaticamente com base na sua escolha de desempenho.</span>
                            </div>

                            <div className="input-group">
                                <label>Modelo de Análise</label>
                                <div className="select-wrapper">
                                    <div className="select-content">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                                        <span>Gemini 2.5 Flash-Lite</span>
                                    </div>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                                </div>
                                <span className="input-help">Modelo usado para analisar imagens e conversas</span>
                            </div>

                            <div className="input-group">
                                <label>Modelo de Transcrição Gemini Live</label>
                                <div className="select-wrapper">
                                    <div className="select-content">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /></svg>
                                        <span>Gemini Live 2.5 Flash Preview</span>
                                    </div>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                                </div>
                                <span className="input-help">Selecione o modelo usado para transcrição de voz Gemini Live</span>
                                <button className="link-btn">Ver detalhes do modelo</button>
                            </div>
                        </div>
                    </div>
                );
            case 'audio':
                return (
                    <div className="settings-content-inner">
                        <div className="content-header">
                            <div className="sub-tabs">
                                <button className={`sub-tab ${audioTab === 'mic' ? 'active' : ''}`} onClick={() => setAudioTab('mic')}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /></svg>
                                    Seu Áudio
                                </button>
                                <button className={`sub-tab ${audioTab === 'system' ? 'active' : ''}`} onClick={() => setAudioTab('system')}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /></svg>
                                    Áudio Recebido
                                </button>
                            </div>
                        </div>

                        <div className="settings-body">
                            {audioTab === 'mic' ? (
                                <>
                                    <div className="input-group">
                                        <label>Seu Microfone</label>
                                        <div className="select-wrapper">
                                            <div className="select-content">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /></svg>
                                                <span>Microfone Padrão</span>
                                            </div>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                                        </div>
                                        <div className="volume-meter">
                                            <div className="volume-bar" style={{ width: '40%' }}></div>
                                        </div>
                                        <span className="input-help">Selecione seu microfone para capturar o que você diz durante reuniões</span>
                                        <span className="device-count">3 dispositivos disponíveis</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="input-group">
                                        <label>Fonte de Áudio Recebido</label>
                                        <div className="select-wrapper">
                                            <div className="select-content">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                                                <span>Áudio do Sistema (Nativo)</span>
                                            </div>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                                        </div>
                                        <div className="info-box green">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                                            <span>Capturando áudio do sistema - selecione uma tela no popup</span>
                                        </div>
                                        <span className="input-help">Captura áudio diretamente do seu sistema sem drivers de áudio virtuais. Você será solicitado a selecionar uma tela.</span>
                                        <span className="device-count">3 dispositivos disponíveis</span>
                                    </div>
                                </>
                            )}
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
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="12" cy="12" r="3" /><path d="M12 18v-2" /><path d="M12 8V6" /><path d="M18 12h-2" /><path d="M8 12H6" /></svg>
                                    </div>
                                    <div className="permission-status-badge active">
                                        <span className="pulse"></span>
                                        Ativo
                                    </div>
                                </div>
                                <div className="permission-card-body">
                                    <h3>Captura de Tela</h3>
                                    <p>Necessário para que o assistente entenda o contexto visual do que você está fazendo.</p>
                                </div>
                                <div className="permission-card-footer">
                                    <button className="btn-manage-permission">Gerenciar</button>
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
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-window" onClick={e => e.stopPropagation()}>
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
        </div>
    );
};
