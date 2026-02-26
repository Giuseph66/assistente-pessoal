import { STTStatus } from '@neo/shared';

const getLabel = (status: STTStatus): string => {
  switch (status.state) {
    case 'idle':
      return 'Idle';
    case 'starting':
      return 'Iniciando';
    case 'listening':
      return 'Ouvindo';
    case 'running':
      return 'Rodando';
    case 'finalizing':
      return 'Finalizando';
    case 'stopping':
      return 'Parando';
    case 'error':
      return 'Erro';
    default:
      return 'Status';
  }
};

export function StatusBadge({ status }: { status: STTStatus }): JSX.Element {
  return (
    <span className={`status-badge ${status.state}`}>
      {getLabel(status)}
    </span>
  );
}
