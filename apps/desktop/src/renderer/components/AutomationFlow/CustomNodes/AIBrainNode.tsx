import { Handle, Position } from '@xyflow/react';
import { FlowIcon } from '../FlowIcons';

interface AIBrainNodeProps {
  data: {
    nodeType: string;
    isRunning?: boolean;
    selected?: boolean;
    data?: {
      instruction?: string;
      inputMode?: 'context' | 'visual' | 'hybrid';
      routes?: string[];
      toolChannels?: string[];
    };
  };
}

export function AIBrainNode({ data }: AIBrainNodeProps) {
  const isRunning = Boolean(data.isRunning);
  const routes = Array.isArray(data.data?.routes) && data.data?.routes.length
    ? data.data.routes.filter((route) => route && route !== 'ERROR')
    : ['OUT'];
  const mode = data.data?.inputMode || 'hybrid';
  const toolChannels = Array.isArray(data.data?.toolChannels) ? data.data.toolChannels : ['*'];
  const routeCount = routes.length + 1; // + ERROR
  const instructionPreview = (data.data?.instruction || '').trim();

  const getTopPercent = (index: number) => `${Math.round(((index + 1) * 100) / (routeCount + 1))}%`;

  return (
    <div className={`workflow-node ai-brain-node ${isRunning ? 'running' : ''} ${data.selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} id="IN" style={{ top: '50%', background: '#60a5fa' }} />

      <div className="node-header">
        <div className="node-icon" style={{ color: '#60a5fa' }}>
          <FlowIcon name="brain" size={15} />
        </div>
        <div className="node-title-container" style={{ flex: 1, overflow: 'hidden' }}>
          <div className="node-type">IA</div>
          <div className="node-title">Nó Cérebro</div>
        </div>
      </div>

      <div className="node-body">
        <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '8px' }}>
          Modo: <strong style={{ color: '#c7d2fe' }}>{mode}</strong> | Ferramentas: <strong style={{ color: '#c7d2fe' }}>{toolChannels[0] === '*' ? 'todas' : toolChannels.length}</strong>
        </div>
        <div style={{
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(96, 165, 250, 0.25)',
          borderRadius: '6px',
          padding: '8px',
          fontSize: '11px',
          color: 'var(--workflow-text-secondary)',
          minHeight: '42px',
          lineHeight: 1.35,
        }}>
          {instructionPreview ? instructionPreview.slice(0, 110) : 'Defina a instrução da IA'}
          {instructionPreview.length > 110 ? '...' : ''}
        </div>
        <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--workflow-text-secondary)' }}>
          Rotas: {routes.join(', ')} + ERROR
        </div>
      </div>

      <div className="node-footer">
        <span>{isRunning ? 'Raciocinando...' : 'Pronto'}</span>
        {isRunning && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#60a5fa', boxShadow: '0 0 8px #60a5fa' }} />}
      </div>

      {routes.map((route, index) => (
        <Handle
          key={`route-${route}-${index}`}
          type="source"
          position={Position.Right}
          id={route}
          style={{ top: getTopPercent(index), background: '#60a5fa' }}
          title={`Rota ${route}`}
        />
      ))}
      <Handle
        type="source"
        position={Position.Right}
        id="ERROR"
        style={{ top: getTopPercent(routeCount - 1), background: '#ef4444' }}
        title="Rota ERROR"
      />
    </div>
  );
}
