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

                <div className="shortcut-card">
                    <div className="shortcut-info">
                        <span className="shortcut-title">Colar Texto STT em App Externo</span>
                        <span className="shortcut-desc">Cola o texto transcrito do STT no campo onde seu cursor está focado (qualquer aplicativo)</span>
                    </div>
                    <div className="shortcut-actions">
                        <div className="shortcut-display">
                            <span className="key">Ctrl</span>
                            <span className="plus">+</span>
                            <span className="key">Shift</span>
                            <span className="plus">+</span>
                            <span className="key">.</span>
                        </div>
                        <button className="btn-change">Change</button>
                    </div>
                </div>

                <div className="shortcut-card">
                    <div className="shortcut-info">
                        <span className="shortcut-title">Mostrar/Ocultar Overlay</span>
                        <span className="shortcut-desc">Alterna a visibilidade da janela principal do assistente</span>
                    </div>
                    <div className="shortcut-actions">
                        <div className="shortcut-display">
                            <span className="key">Ctrl</span>
                            <span className="plus">+</span>
                            <span className="key">Shift</span>
                            <span className="plus">+</span>
                            <span className="key">O</span>
                        </div>
                        <button className="btn-change">Change</button>
                    </div>
                </div>

                <div className="shortcut-card">
                    <div className="shortcut-info">
                        <span className="shortcut-title">Modo de Apresentação (Pânico)</span>
                        <span className="shortcut-desc">Esconde a janela em compartilhamentos de tela (Google Meet, Zoom, etc.)</span>
                    </div>
                    <div className="shortcut-actions">
                        <div className="shortcut-display">
                            <span className="key">Ctrl</span>
                            <span className="plus">+</span>
                            <span className="key">Alt</span>
                            <span className="plus">+</span>
                            <span className="key">H</span>
                        </div>
                        <button className="btn-change">Change</button>
                    </div>
                </div>

                <div className="shortcut-card">
                    <div className="shortcut-info">
                        <span className="shortcut-title">Destacar Texto na Tela (OCR)</span>
                        <span className="shortcut-desc">Captura e destaca texto visível na tela usando OCR</span>
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
                        <span className="shortcut-title">Limpar Destaques de Texto</span>
                        <span className="shortcut-desc">Remove os destaques de texto da tela</span>
                    </div>
                    <div className="shortcut-actions">
                        <div className="shortcut-display">
                            <span className="key">Escape</span>
                        </div>
                        <button className="btn-change">Change</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

