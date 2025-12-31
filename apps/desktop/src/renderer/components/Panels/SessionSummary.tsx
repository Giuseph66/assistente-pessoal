import React, { useEffect, useState } from 'react';

interface SessionSummaryProps {
    sessionId: number;
}

export const SessionSummary: React.FC<SessionSummaryProps> = ({ sessionId }) => {
    const [summary, setSummary] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Fetch summary logic here
        // For now, just a placeholder
        setSummary(`Resumo da sessão #${sessionId}`);
    }, [sessionId]);

    return (
        <div className="session-summary" style={{ padding: '20px', color: '#e0e0e0' }}>
            <h2>Resumo da Sessão</h2>
            {loading ? <p>Carregando...</p> : <p>{summary}</p>}
            <p style={{ fontSize: '14px', color: '#999', marginTop: '10px' }}>
                O recurso de geração automática de resumo será implementado em breve.
            </p>
        </div>
    );
};
