import React from 'react';

export const ShortcutsSection: React.FC = () => {
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
};

