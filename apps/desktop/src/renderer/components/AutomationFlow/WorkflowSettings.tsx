import { useState, useEffect } from 'react';
import { WorkflowGraph } from '@ricky/shared';
import { WorkflowEditor } from './WorkflowEditor';

export function WorkflowSettings() {
  const [workflows, setWorkflows] = useState<WorkflowGraph[]>([]);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowGraph | null>(null);
  const [loading, setLoading] = useState(true);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      const list = await window.automation.flow.listWorkflows();
      setWorkflows(list);
    } catch (error) {
      console.error('Falha ao carregar workflows flow:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkflows();
  }, []);

  const handleCreate = async () => {
    const newWorkflow: WorkflowGraph = {
      id: `flow_${Date.now()}`,
      name: 'Novo Workflow Flow',
      schemaVersion: 1,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [
        {
          id: 'start-1',
          type: 'start',
          position: { x: 100, y: 100 },
          data: { nodeType: 'start', data: {} },
        },
      ],
      edges: [],
    };
    await window.automation.flow.saveWorkflow(newWorkflow);
    setEditingWorkflow(newWorkflow);
    // setEditingWorkflow(newWorkflow); // Removed inline editing
    loadWorkflows();
    handleEditWorkflow(newWorkflow); // Open in new window after creation
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar este workflow visual?')) return;
    await window.automation.flow.deleteWorkflow(id);
    loadWorkflows();
  };

  const handleCreateWorkflow = () => {
    window.electron.ipcRenderer.send('window:open-workflow-editor');
  };

  const handleEditWorkflow = (workflow: WorkflowGraph) => {
    window.electron.ipcRenderer.send('window:open-workflow-editor', workflow.id);
  };

  // Removed the if (editingWorkflow) block that rendered WorkflowEditor inline

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h3 style={{ margin: 0, color: '#fff' }}>Workflow Editor</h3>
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: '13px' }}>Editor visual de automações</p>
        </div>
        <button className="btn-get-key-premium" onClick={handleCreate}>
          ➕ Criar Workflow Visual
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#666', textAlign: 'center', padding: '40px' }}>Carregando...</div>
      ) : workflows.length === 0 ? (
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '40px', textAlign: 'center', border: '1px dashed #333' }}>
          <p style={{ color: '#666' }}>Nenhum workflow visual criado.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {workflows.map((wf) => (
            <div key={wf.id} className="api-key-card-premium" style={{ height: 'auto' }}>
              <div className="provider-text-details">
                <h4 style={{ margin: 0 }}>{wf.name}</h4>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                  {wf.nodes.length} blocos • Atualizado em {new Date(wf.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button className="btn-get-key-premium" style={{ flex: 1 }} onClick={() => handleEditWorkflow(wf)}>
                  ✏️ Abrir Editor
                </button>
                <button
                  className="btn-get-key-premium"
                  style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}
                  onClick={() => handleDelete(wf.id)}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

