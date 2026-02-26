import { useEffect, useState } from 'react';
import { WorkflowGraph } from '@neo/shared';
import { WorkflowEditor } from './WorkflowEditor';

export function WorkflowEditorWindow() {
    const [workflow, setWorkflow] = useState<WorkflowGraph | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadWorkflow = async () => {
            try {
                const hash = window.location.hash;
                const params = new URLSearchParams(hash.split('?')[1]);
                const id = params.get('id');

                if (id) {
                    console.log('Loading workflow:', id);
                    const wf = await window.automation.flow.getWorkflow(id);
                    setWorkflow(wf);
                } else {
                    console.log('No workflow ID provided, starting new.');
                }
            } catch (error) {
                console.error('Failed to load workflow:', error);
            } finally {
                setLoading(false);
            }
        };

        loadWorkflow();
    }, []);

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                background: '#0f172a',
                color: '#fff'
            }}>
                Carregando...
            </div>
        );
    }

    return (
        <WorkflowEditor
            workflow={workflow}
            onBack={() => window.close()}
        />
    );
}
