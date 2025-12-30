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
                        <div className="settings-header">
                            <h2>API e Modelos</h2>
                            <button className="close-btn" onClick={onClose}>×</button>
                        </div>

                        <div className="settings-body">
                            {/* Provider Tabs */}
                            <div className="provider-tabs">
                                <button className="provider-tab active">Google</button>
                                <button className="provider-tab">OpenAI</button>
                                <button className="provider-tab">OpenRouter</button>
                                <button className="provider-tab">Custom</button>
                            </div>

                            {/* Provider Card */}
                            <div className="settings-card">
                                <div className="card-header">
                                    <div className="provider-info">
                                        <span className="provider-name">Google Gemini</span>
                                        <span className="status-badge success">Pronto</span>
                                    </div>
                                    <div className="toggle-switch active"></div>
                                </div>

                                <div className="card-body">
                                    <div className="input-group">
                                        <label>Chave de API</label>
                                        <div className="api-key-input">
                                            <input type="password" value="AIzaSy..." readOnly />
                                            <button className="icon-btn-small">👁️</button>
                                            <button className="icon-btn-small">✏️</button>
                                        </div>
                                    </div>
                                    <button className="btn-secondary full-width">Testar Chave</button>
                                </div>
                            </div>

                            {/* Model Info */}
                            <div className="settings-card">
                                <div className="card-header">
                                    <h3>Modelo Selecionado</h3>
                                </div>
                                <div className="card-body">
                                    <select className="model-select">
                                        <option>Gemini 2.5 Flash</option>
                                        <option>Gemini Pro Vision</option>
                                    </select>

                                    <div className="model-stats-grid">
                                        <div className="stat-item">
                                            <span className="stat-icon">👁️</span>
                                            <span className="stat-label">Visão: Sim</span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-icon">🪙</span>
                                            <span className="stat-label">1M Tokens</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="settings-footer">
                            <button className="btn-primary" onClick={onClose}>Salvar</button>
                        </div>
                    </div>
                );
            default:
                return (
                    <div className="settings-content-inner">
                        <div className="settings-header">
                            <h2>{activeSection}</h2>
                            <button className="close-btn" onClick={onClose}>×</button>
                        </div>
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
                {/* Sidebar */}
                <div className="modal-sidebar">
                    <div className="sidebar-title">Configurações</div>
                    <nav className="sidebar-nav">
                        <button
                            className={`sidebar-item ${activeSection === 'api' ? 'active' : ''}`}
                            onClick={() => setActiveSection('api')}
                        >
                            API e Modelos
                        </button>
                        <button
                            className={`sidebar-item ${activeSection === 'audio' ? 'active' : ''}`}
                            onClick={() => setActiveSection('audio')}
                        >
                            Áudio e Tela
                        </button>
                        <button
                            className={`sidebar-item ${activeSection === 'permissions' ? 'active' : ''}`}
                            onClick={() => setActiveSection('permissions')}
                        >
                            Permissões
                        </button>
                        <button
                            className={`sidebar-item ${activeSection === 'features' ? 'active' : ''}`}
                            onClick={() => setActiveSection('features')}
                        >
                            Recursos
                        </button>
                        <button
                            className={`sidebar-item ${activeSection === 'shortcuts' ? 'active' : ''}`}
                            onClick={() => setActiveSection('shortcuts')}
                        >
                            Atalhos
                        </button>
                        <div className="sidebar-divider" />
                        <button
                            className={`sidebar-item ${activeSection === 'privacy' ? 'active' : ''}`}
                            onClick={() => setActiveSection('privacy')}
                        >
                            Privacidade
                        </button>
                        <button
                            className={`sidebar-item ${activeSection === 'account' ? 'active' : ''}`}
                            onClick={() => setActiveSection('account')}
                        >
                            Conta
                        </button>
                    </nav>
                </div>

                {/* Content */}
                <div className="modal-content">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};
