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
    | 'account'
    | 'premium'
    | 'help';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [activeSection, setActiveSection] = useState<SettingsSection>('api');

    if (!isOpen) return null;

    const renderContent = () => {
        switch (activeSection) {
            case 'api':
                return (
                    <div className="settings-content-inner">
                        <div className="content-header">
                            <div className="provider-tabs">
                                <button className="provider-tab">OpenAI</button>
                                <button className="provider-tab active">Google <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg></button>
                                <button className="provider-tab">OpenRouter</button>
                                <button className="provider-tab">Custom API <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg></button>
                            </div>
                        </div>

                        <div className="settings-body">
                            <div className="provider-details">
                                <div className="provider-title-row">
                                    <div className="provider-title-info">
                                        <h3>Google</h3>
                                        <span className="provider-subtitle">Modelos Gemini</span>
                                    </div>
                                    <div className="status-badge success">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                                        Ativo
                                    </div>
                                </div>

                                <div className="status-indicator ready">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                                    Pronto
                                </div>

                                <div className="input-group">
                                    <label>Chave de API</label>
                                    <div className="api-key-wrapper">
                                        <input type="password" value="••••••••••••••••••••••••••••••••••••••••" readOnly />
                                        <button className="icon-btn-small">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                                <polyline points="15 3 21 3 21 9" />
                                                <line x1="10" y1="14" x2="21" y2="3" />
                                            </svg>
                                        </button>
                                    </div>
                                    <span className="input-help">Sua chave de API do Gemini para suporte de análise de imagem.</span>
                                </div>

                                <div className="performance-section">
                                    <label>Desempenho</label>
                                    <span className="section-help">Escolha o equilíbrio preferido entre velocidade e qualidade. Selecionaremos automaticamente os melhores modelos para você.</span>
                                    <div className="performance-options">
                                        <button className="perf-option">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                                        </button>
                                        <button className="perf-option">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /></svg>
                                        </button>
                                        <button className="perf-option">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                        </button>
                                        <button className="perf-option active">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7h-9m3 3H5m16 6h-9m3 3H5" /></svg>
                                            <div className="option-check">
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12" /></svg>
                                            </div>
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
            default:
                return (
                    <div className="settings-content-inner">
                        <div className="settings-body">
                            <div className="empty-state">
                                <p>Configurações de {activeSection} em breve.</p>
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
                            <button className={`sidebar-item ${activeSection === 'account' ? 'active' : ''}`} onClick={() => setActiveSection('account')}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                Conta
                            </button>
                            <button className={`sidebar-item ${activeSection === 'premium' ? 'active' : ''}`} onClick={() => setActiveSection('premium')}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                Premium
                            </button>
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
                    <button className="power-btn">
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
