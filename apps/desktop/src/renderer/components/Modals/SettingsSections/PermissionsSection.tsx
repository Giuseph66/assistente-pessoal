import React from 'react';

export const PermissionsSection: React.FC = () => {
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
};

