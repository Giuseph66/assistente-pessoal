import React from 'react';
import { CustomSelect } from './CustomSelect';

interface FeaturesSectionProps {
    performance: string;
    setPerformance: (value: string) => void;
    showToast: (message: string) => void;
}

export const FeaturesSection: React.FC<FeaturesSectionProps> = ({
    performance,
    setPerformance,
    showToast
}) => {
    return (
        <div className="settings-content-inner">
            <div className="content-header">
                <h3>Recursos e Desempenho</h3>
                <p className="header-desc">Ajuste o equilíbrio entre velocidade e qualidade para o seu assistente.</p>
            </div>
            <div className="settings-body">
                <div className="input-group">
                    <label>Perfil de Desempenho</label>
                    <CustomSelect
                        value={performance}
                        onChange={(val) => {
                            setPerformance(val);
                            showToast(`Perfil de desempenho alterado para ${val}`);
                        }}
                        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>}
                        options={['personalizado', 'qualidade', 'padrao', 'rapido']}
                    />
                    <span className="input-help">Escolha como o assistente deve priorizar o processamento</span>
                </div>

                <div className="feature-toggle-list">
                    <div className="feature-toggle-item">
                        <div className="toggle-info">
                            <h4>Análise de Contexto Contínua</h4>
                            <p>Permite que o assistente analise o que você está fazendo sem precisar ser chamado.</p>
                        </div>
                        <div className="toggle-switch active"></div>
                    </div>
                    <div className="feature-toggle-item">
                        <div className="toggle-info">
                            <h4>Sugestões Proativas</h4>
                            <p>O assistente sugerirá ações baseadas no seu fluxo de trabalho atual.</p>
                        </div>
                        <div className="toggle-switch"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

