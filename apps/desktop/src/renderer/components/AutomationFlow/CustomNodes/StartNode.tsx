import { Handle, Position } from '@xyflow/react';
import { FlowIcon } from '../FlowIcons';

export function StartNode({ data }: { data: any }) {
  const isRunning = data.isRunning;

  return (
    <div className={`workflow-node start-node ${isRunning ? 'running' : ''} ${data.selected ? 'selected' : ''}`} style={{
      minWidth: '120px',
      background: 'rgba(16, 185, 129, 0.1)',
      borderColor: '#10b981',
      boxShadow: isRunning ? '0 0 20px rgba(16, 185, 129, 0.4)' : '0 4px 15px rgba(16, 185, 129, 0.2)'
    }}>
      <div style={{
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontWeight: 700,
        color: '#10b981',
        letterSpacing: '0.05em'
      }}>
        <FlowIcon name="play" size={18} />
        INÍCIO
      </div>
      <Handle type="source" position={Position.Right} id="OUT" style={{ background: '#10b981', width: '12px', height: '12px' }} />
    </div>
  );
}
