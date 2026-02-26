import type { CollectorStatus, SystemNotificationPayload } from '../types';
import type { SystemNotificationCollector } from './index';

export class MacOSNotificationCollector implements SystemNotificationCollector {
  start(_onEvent: (payload: SystemNotificationPayload) => void): void {
    return;
  }

  stop(): void {
    return;
  }

  status(): CollectorStatus {
    return {
      platform: 'darwin',
      supported: false,
      enabled: false,
      mode: 'unsupported',
      lastError: 'Captura de notificacoes de outros apps nao e suportada no macOS.',
    };
  }
}
