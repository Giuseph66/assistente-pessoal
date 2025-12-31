import React from 'react';

export const PermissionsSection: React.FC = () => {
    return (
        <div className="settings-content-inner">
            <div className="future-implementation">
                <div className="future-implementation-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M12 2v20M2 12h20" />
                    </svg>
                </div>
                <h2>Implementação Futura</h2>
                <p>Esta seção será implementada em uma versão futura do aplicativo.</p>
            </div>
        </div>
    );
};

