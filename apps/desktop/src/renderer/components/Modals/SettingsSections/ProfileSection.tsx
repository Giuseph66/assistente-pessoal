import React from 'react';
import './ProfileSection.css';

export const ProfileSection: React.FC = () => {
    return (
        <div className="profile-container">
            {/* Header Section */}
            <div className="profile-header-premium">
                <div className="profile-avatar-wrapper">
                    <div className="profile-avatar-large">
                        <img src="https://ui-avatars.com/api/?name=User&background=4f46e5&color=fff&size=200" alt="Avatar" />
                    </div>
                    <button className="edit-avatar-btn" title="Alterar foto">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                            <circle cx="12" cy="13" r="4" />
                        </svg>
                    </button>
                </div>

                <div className="profile-info-main">
                    <h2 className="profile-name">Usuário Neurelix</h2>
                    <p className="profile-email">usuario@exemplo.com</p>
                    <div className="profile-badges">
                        <span className="badge premium">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                            Premium
                        </span>
                        <span className="badge status">
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', marginRight: 4 }}></div>
                            Ativo
                        </span>
                    </div>
                </div>

                <button className="btn-edit-profile">
                    Editar Perfil
                </button>
            </div>

            {/* Plan Section */}
            <div className="plan-card">
                <div className="plan-info">
                    <h3>Plano Neurelix Pro</h3>
                    <p>Sua assinatura renova em 15 de Jan, 2026</p>
                </div>
                <div className="plan-actions">
                    <button className="btn-upgrade">Gerenciar Assinatura</button>
                </div>
            </div>

            {/* Stats Section */}
            <div className="stats-section">
                <div className="section-title">
                    Visão Geral
                    <span className="section-subtitle">Últimos 30 dias</span>
                </div>

                <div className="stats-grid-premium">
                    <div className="stat-card">
                        <div className="stat-header">
                            <div className="stat-icon-box blue">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                            </div>
                            <div className="stat-trend">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 2 }}>
                                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                                    <polyline points="17 6 23 6 23 12" />
                                </svg>
                                +12%
                            </div>
                        </div>
                        <div className="stat-value">128</div>
                        <div className="stat-label">Sessões Totais</div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-header">
                            <div className="stat-icon-box green">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                </svg>
                            </div>
                            <div className="stat-trend">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 2 }}>
                                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                                    <polyline points="17 6 23 6 23 12" />
                                </svg>
                                +5%
                            </div>
                        </div>
                        <div className="stat-value">42.5h</div>
                        <div className="stat-label">Horas de Áudio</div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-header">
                            <div className="stat-icon-box purple">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                                </svg>
                            </div>
                            <div className="stat-trend">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 2 }}>
                                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                                    <polyline points="17 6 23 6 23 12" />
                                </svg>
                                +24%
                            </div>
                        </div>
                        <div className="stat-value">1,452</div>
                        <div className="stat-label">Mensagens IA</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

