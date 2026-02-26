import type { CollectorStatus, SystemNotificationPayload } from '../../types';
import type { SystemNotificationCollector } from '../index';

const WINDOWS_NOTIFICATION_LISTENER_ENABLED = false;

export class WindowsNotificationCollector implements SystemNotificationCollector {
  start(_onEvent: (payload: SystemNotificationPayload) => void): void {
    return;
  }

  stop(): void {
    return;
  }

  status(): CollectorStatus {
    return {
      platform: 'win32',
      supported: WINDOWS_NOTIFICATION_LISTENER_ENABLED,
      enabled: false,
      mode: 'planned',
      lastError: WINDOWS_NOTIFICATION_LISTENER_ENABLED
        ? null
        : 'Windows Notification Listener companion ainda nao implementado (feature flag desativada).',
    };
  }
}
