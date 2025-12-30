/**
 * Handle visual para indicar a area de arrasto (usa app-region drag)
 */
export function DragHandle(): JSX.Element {
  return (
    <div
      className="drag-handle"
      style={{
        width: '20px',
        height: '20px',
        cursor: 'move',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
        <circle cx="2" cy="2" r="1" />
        <circle cx="6" cy="2" r="1" />
        <circle cx="10" cy="2" r="1" />
        <circle cx="2" cy="6" r="1" />
        <circle cx="6" cy="6" r="1" />
        <circle cx="10" cy="6" r="1" />
        <circle cx="2" cy="10" r="1" />
        <circle cx="6" cy="10" r="1" />
        <circle cx="10" cy="10" r="1" />
      </svg>
    </div>
  );
}
