import { Handle, Position } from '@xyflow/react';
import { FlowIcon, FlowIconName } from '../FlowIcons';

export function ActionNode({ data }: { data: any }) {
  const getIcon = (type: string): FlowIconName => {
    if (type === 'action.clickCoordinates') return 'mapPin';
    if (type === 'action.clickFoundImage') return 'target';
    if (type.includes('click') || type.includes('mouse')) return 'mousePointer';
    if (type.includes('type') || type.includes('pressKey')) return 'keyboard';
    if (type.includes('wait')) return 'clock';
    if (type.includes('screenshot')) return 'camera';
    return 'bolt';
  };

  const label = data.data.label || data.nodeType.split('.').pop();
  const isRunning = data.isRunning;

  return (
    <div className={`workflow-node ${isRunning ? 'running' : ''} ${data.selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} />

      <div className="node-header">
        <div className="node-icon">
          <FlowIcon name={getIcon(data.nodeType)} size={15} />
        </div>
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
