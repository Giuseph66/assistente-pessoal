import React from 'react';
import './DashboardSection.css';

export const DashboardSection: React.FC = () => {
    return (
        <div className="dashboard-container">
            <div className="dashboard-header-section">
                <div>
                    <h2>Visão Geral</h2>
                    <p className="subtitle">Estatísticas de uso do seu assistente</p>
                </div>
                <span className="period-badge">Últimos 30 dias</span>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-header">
                        <div className="stat-icon-box blue">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                        </div>
                        <div className="stat-trend positive">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                        <div className="stat-trend positive">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                        <div className="stat-trend positive">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
    );
};
