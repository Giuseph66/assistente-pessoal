import React from 'react';

export const PrivacySection: React.FC = () => {
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
};

