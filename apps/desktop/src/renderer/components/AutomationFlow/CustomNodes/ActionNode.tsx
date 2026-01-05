import { Handle, Position } from '@xyflow/react';

export function ActionNode({ data }: { data: any }) {
  const getIcon = (type: string) => {
    if (type.includes('click')) return '🖱️';
    if (type.includes('type')) return '⌨️';
    if (type.includes('wait')) return '⏳';
    if (type.includes('screenshot')) return '📸';
    if (type.includes('mouse')) return '🖱️';
    return '⚡';
  };

  const label = data.data.label || data.nodeType.split('.').pop();
  const isRunning = data.isRunning;

  return (
    <div className={`workflow-node ${isRunning ? 'running' : ''} ${data.selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} />

      <div className="node-header">
        <div className="node-icon">{getIcon(data.nodeType)}</div>
        <div className="node-title-container" style={{ flex: 1, overflow: 'hidden' }}>
          <div className="node-type">{data.nodeType.split('.').pop()}</div>
          <div className="node-title">{label}</div>
        </div>
      </div>

      <div className="node-body">
        {/* Content specific to action type could go here */}
        {data.data.text && <div style={{ opacity: 0.7 }}>"{data.data.text}"</div>}
        {data.data.ms && <div style={{ opacity: 0.7 }}>{data.data.ms}ms</div>}
      </div>

      <div className="node-footer">
        <span>{isRunning ? 'Executando...' : 'Aguardando'}</span>
        {isRunning && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 5px #10b981' }} />}
      </div>

      <Handle type="source" position={Position.Right} id="OUT" />
    </div>
  );
}

