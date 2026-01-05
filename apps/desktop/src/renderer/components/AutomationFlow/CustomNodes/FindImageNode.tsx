import { Handle, Position } from '@xyflow/react';

export function FindImageNode({ data }: { data: any }) {
  const isRunning = data.isRunning;

  return (
    <div className={`workflow-node ${isRunning ? 'running' : ''} ${data.selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} />

      <div className="node-header">
        <div className="node-icon" style={{ color: '#f59e0b' }}>🔍</div>
        <div className="node-title-container" style={{ flex: 1, overflow: 'hidden' }}>
          <div className="node-type">CONDICIONAL</div>
          <div className="node-title">Buscar Imagem</div>
        </div>
      </div>

      <div className="node-body">
        <div style={{ marginBottom: '4px', fontSize: '11px', color: 'var(--workflow-text-secondary)' }}>TEMPLATE</div>
        <div style={{
          background: 'rgba(0,0,0,0.2)',
          padding: '6px 8px',
          borderRadius: '6px',
          fontSize: '12px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          {data.data.templateName || 'Selecione template...'}
        </div>
      </div>

      <div className="node-footer" style={{ padding: '0' }}>
        <div style={{ flex: 1, padding: '8px 12px', borderRight: '1px solid var(--node-border)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
          <span style={{ color: '#10b981', fontWeight: 600 }}>ENCONTRADO</span>
        </div>
        <div style={{ flex: 1, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
          <span style={{ color: '#ef4444', fontWeight: 600 }}>NÃO ENC.</span>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
        </div>
      </div>

      <Handle type="source" position={Position.Right} id="FOUND" style={{ top: '70%', background: '#10b981' }} />
      <Handle type="source" position={Position.Right} id="NOT_FOUND" style={{ top: '85%', background: '#ef4444' }} />
    </div>
  );
}

