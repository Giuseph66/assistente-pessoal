import { Handle, Position } from '@xyflow/react';
import { FlowIcon } from '../FlowIcons';

export function LoopNode({ data }: { data: any }) {
  const isCount = data.data.mode === 'count';
  const label = isCount ? `Repetir ${data.data.count}x` : `Até achar ${data.data.untilTemplateName}`;
  const isRunning = data.isRunning;

  return (
    <div className={`workflow-node ${isRunning ? 'running' : ''} ${data.selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} />

      <div className="node-header">
        <div className="node-icon" style={{ color: '#8b5cf6' }}>
          <FlowIcon name="repeat" size={15} />
        </div>
        <div className="node-title-container" style={{ flex: 1, overflow: 'hidden' }}>
          <div className="node-type">LÓGICA</div>
          <div className="node-title">Loop</div>
        </div>
      </div>

      <div className="node-body">
        <div style={{
          background: 'rgba(139, 92, 246, 0.1)',
          color: '#a78bfa',
          padding: '6px 8px',
          borderRadius: '6px',
          fontSize: '12px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          textAlign: 'center',
          fontWeight: 500
        }}>
          {label}
        </div>
      </div>

      <div className="node-footer" style={{ padding: '0' }}>
        <div style={{ flex: 1, padding: '8px 12px', borderRight: '1px solid var(--node-border)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#8b5cf6' }} />
          <span style={{ color: '#8b5cf6', fontWeight: 600 }}>REPETIR</span>
        </div>
        <div style={{ flex: 1, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
          <span style={{ color: '#94a3b8', fontWeight: 600 }}>FIM</span>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8' }} />
        </div>
      </div>

      <Handle type="source" position={Position.Right} id="LOOP" style={{ top: '70%', background: '#8b5cf6' }} />
      <Handle type="source" position={Position.Right} id="DONE" style={{ top: '85%', background: '#94a3b8' }} />
    </div>
  );
}
