import type { CollectorStatus, SystemNotificationPayload } from '../types';
import { LinuxNotificationCollector } from './linux-collector';
import { MacOSNotificationCollector } from './macos-collector';
import { WindowsNotificationCollector } from './windows-collector';

export interface SystemNotificationCollector {
  start(onEvent: (payload: SystemNotificationPayload) => void): Promise<void> | void;
  stop(): Promise<void> | void;
  status(): CollectorStatus;
}

class UnsupportedNotificationCollector implements SystemNotificationCollector {
  private readonly platform: NodeJS.Platform;
  private readonly reason: string;

  constructor(platform: NodeJS.Platform, reason: string) {
    this.platform = platform;
    this.reason = reason;
  }

  start(): void {
    return;
  }

  stop(): void {
    return;
  }

  status(): CollectorStatus {
    return {
      platform: this.platform,
      supported: false,
      enabled: false,
      mode: 'unsupported',
      lastError: this.reason,
    };
  }
}

export function createSystemNotificationCollector(
  platform: NodeJS.Platform = process.platform
): SystemNotificationCollector {
  if (platform === 'linux') {
    return new LinuxNotificationCollector();
  }
  if (platform === 'darwin') {
    return new MacOSNotificationCollector();
  }
  if (platform === 'win32') {
    return new WindowsNotificationCollector();
  }
  return new UnsupportedNotificationCollector(platform, 'Platform not supported');
}
