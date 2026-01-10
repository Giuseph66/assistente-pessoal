import React, { useEffect, useState } from 'react';

interface SessionSummaryProps {
    sessionId: number;
}

export const SessionSummary: React.FC<SessionSummaryProps> = ({ sessionId }) => {
    const [summary, setSummary] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSession = async () => {
            setLoading(true);
            try {
                const session = await (window as any).electron.ipcRenderer.invoke('session:get', sessionId);
                if (session && session.summary) {
                    setSummary(session.summary);
                } else {
                    setSummary(null);
                }
            } catch (err) {
                console.error('Failed to fetch session summary:', err);
            } finally {
                setLoading(false);
            }
        };

        if (sessionId) {
            fetchSession();
        }
    }, [sessionId]);

    const handleGenerateSummary = () => {
        // This will be implemented with AI later
        setSummary(`Este é um resumo gerado automaticamente para a sessão #${sessionId}. A conversa focou em... (Funcionalidade em desenvolvimento)`);
    };

    return (
        <div className="session-summary" style={{ padding: '24px', color: '#e0e0e0', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>Resumo da Sessão</h2>
                <button
                    onClick={handleGenerateSummary}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: '#4f46e5',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500'
                    }}
                >
                    Gerar Resumo
                </button>
            </div>

            {loading ? (
                <p style={{ color: '#888' }}>Carregando...</p>
            ) : summary ? (
                <div style={{
                    backgroundColor: '#1a1a1a',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1px solid #333',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap'
                }}>
                    {summary}
                </div>
            ) : (
                <div style={{
                    textAlign: 'center',
                    padding: '40px',
                    backgroundColor: '#1a1a1a',
                    borderRadius: '12px',
                    border: '1px dashed #444',
                    color: '#888'
                }}>
                    <p>Nenhum resumo disponível para esta sessão.</p>
                    <p style={{ fontSize: '13px' }}>Clique em "Gerar Resumo" para criar um automaticamente.</p>
                </div>
            )}
        </div>
    );
};
