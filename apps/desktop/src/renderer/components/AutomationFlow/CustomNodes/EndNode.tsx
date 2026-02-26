import { Handle, Position } from '@xyflow/react';
import { FlowIcon } from '../FlowIcons';

export function EndNode({ data }: { data: any }) {
  const isRunning = data.isRunning;

  return (
    <div className={`workflow-node end-node ${isRunning ? 'running' : ''} ${data.selected ? 'selected' : ''}`} style={{
      minWidth: '120px',
      background: 'rgba(239, 68, 68, 0.1)',
      borderColor: '#ef4444',
      boxShadow: isRunning ? '0 0 20px rgba(239, 68, 68, 0.4)' : '0 4px 15px rgba(239, 68, 68, 0.2)'
    }}>
      <Handle type="target" position={Position.Left} style={{ background: '#ef4444', width: '12px', height: '12px' }} />
      <div style={{
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontWeight: 700,
        color: '#ef4444',
        letterSpacing: '0.05em'
      }}>
        <FlowIcon name="stopSquare" size={18} />
        FIM
      </div>
    </div>
  );
}
