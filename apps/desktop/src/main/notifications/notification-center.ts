import { Notification, app } from 'electron';
import { getLogger } from '@neo/logger';
import { NotificationStore } from './notification-store';
import { createSystemNotificationCollector } from './collectors';
import {
  NotificationEntry,
  NotificationSaveInput,
  NotificationSettings,
  NotificationSettingsPatch,
  NotificationSettingsWithStatus,
  SystemNotificationPayload,
} from './types';

type SaveListener = (notification: NotificationEntry) => void;
type SettingsListener = (settings: NotificationSettingsWithStatus) => void;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type NormalizeOptions = {
  storeBody?: boolean;
  maskOtp?: boolean;
};

const maskOtpValues = (text: string): string => text.replace(/\b\d{4,8}\b/g, '[redacted-otp]');

export function normalizeSystemNotification(
  payload: SystemNotificationPayload,
  os: NodeJS.Platform,
  options: NormalizeOptions = {}
): NotificationSaveInput {
  const sourceTitle = payload.title || '';
  const sourceBody = payload.body || '';
  const storeBody = options.storeBody !== false;
  const maskOtp = options.maskOtp === true;

  const title = maskOtp ? maskOtpValues(sourceTitle) : sourceTitle;
  const bodyBase = storeBody ? sourceBody : '';
  const body = maskOtp ? maskOtpValues(bodyBase) : bodyBase;

  return {
    source: 'system',
    os,
    appName: payload.appName || null,
    title: title || 'Sem titulo',
    body,
    level: payload.level === 'warn' || payload.level === 'error' ? payload.level : 'info',
    category: payload.category || null,
    meta: {
      ...(payload.meta || {}),
      actions: payload.actions || [],
    },
    raw: payload.raw || payload.meta || {},
  };
}

export class NotificationCenter {
  private readonly logger = getLogger();
  private readonly store: NotificationStore;
  private readonly collector = createSystemNotificationCollector(process.platform);
  private retentionTimer: NodeJS.Timeout | null = null;
  private started = false;
  private readonly saveListeners = new Set<SaveListener>();
  private readonly settingsListeners = new Set<SettingsListener>();
  private readonly recentSystemNotifications = new Map<string, number>();

  constructor(store: NotificationStore) {
    this.store = store;
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.runRetention();
    this.retentionTimer = setInterval(() => this.runRetention(), ONE_DAY_MS);
    await this.applyCollectorState(this.store.getSettings());
  }

  async stop(): Promise<void> {
    if (this.retentionTimer) {
      clearInterval(this.retentionTimer);
      this.retentionTimer = null;
    }
    await Promise.resolve(this.collector.stop());
    this.started = false;
  }

  onNotificationSaved(listener: SaveListener): () => void {
    this.saveListeners.add(listener);
    return () => this.saveListeners.delete(listener);
  }

  onSettingsChanged(listener: SettingsListener): () => void {
    this.settingsListeners.add(listener);
    return () => this.settingsListeners.delete(listener);
  }

  private emitSaved(notification: NotificationEntry): void {
    this.saveListeners.forEach((listener) => {
      try {
        listener(notification);
      } catch {
        // No-op for isolated listener failures.
      }
    });
  }

  private emitSettings(settings: NotificationSettingsWithStatus): void {
    this.settingsListeners.forEach((listener) => {
      try {
        listener(settings);
      } catch {
        // No-op for isolated listener failures.
      }
    });
  }

  private runRetention(): void {
    const settings = this.store.getSettings();
    const deleted = this.store.clearOlderThan(settings.retentionDays);
    if (deleted > 0) {
      this.logger.info({ deleted, retentionDays: settings.retentionDays }, 'Notifications retention cleanup executed');
    }
  }

  private async applyCollectorState(settings: NotificationSettings): Promise<void> {
    if (!settings.captureSystemNotifications) {
      await Promise.resolve(this.collector.stop());
      return;
    }

    const status = this.collector.status();
    if (!status.supported) {
      return;
    }

    await Promise.resolve(
      this.collector.start((payload) => {
        this.handleSystemNotification(payload);
      })
    );

    const nextStatus = this.collector.status();
    if (!nextStatus.supported && settings.captureSystemNotifications) {
      this.store.setSettings({ captureSystemNotifications: false });
    }
  }

  private handleSystemNotification(payload: SystemNotificationPayload): void {
    const settings = this.store.getSettings();
    if (!settings.captureSystemNotifications) {
      return;
    }

    const appName = (payload.appName || '').trim().toLowerCase();

    // Prevent capturing our own notifications through the system collector
    if (appName === app.getName().toLowerCase() || appName === 'neo-desktop' || appName === 'neo') {
      return;
    }

    if (appName && settings.blockedApps.some((blocked) => blocked.toLowerCase() === appName)) {
      return;
    }

    const normalized = normalizeSystemNotification(payload, process.platform, {
      storeBody: true,
      maskOtp: false,
    });

    if (!normalized.title && !normalized.body) {
      return;
    }

    // Deduplication (5 seconds window)
    const dupKey = `${normalized.appName || ''}|${normalized.title}|${normalized.body}`;
    const now = Date.now();
    const lastSeen = this.recentSystemNotifications.get(dupKey);

    if (this.recentSystemNotifications.size > 100) {
      this.recentSystemNotifications.clear();
    }

    if (lastSeen && now - lastSeen < 5000) {
      return;
    }
    this.recentSystemNotifications.set(dupKey, now);

    const saved = this.store.save(normalized);
    this.emitSaved(saved);
  }

  async notify(input: {
    title: string;
    body?: string;
    level?: 'info' | 'warn' | 'error';
    category?: string;
    meta?: Record<string, unknown>;
  }): Promise<NotificationEntry | null> {
    const title = String(input.title || '').trim() || 'Notificacao';
    const body = String(input.body || '');
    const level = input.level || 'info';

    try {
      if (Notification.isSupported()) {
        const nativeNotification = new Notification({
          title,
          body,
        });
        nativeNotification.show();
      }
    } catch (error: any) {
      this.logger.warn({ err: error }, 'Failed to display native notification');
    }

    const settings = this.store.getSettings();
    if (!settings.storeAppNotifications) {
      return null;
    }

    const saved = this.store.save({
      source: 'app',
      os: process.platform,
      appName: app.getName(),
      title,
      body,
      level,
      category: input.category || null,
      meta: input.meta || null,
      raw: null,
    });
    this.emitSaved(saved);
    return saved;
  }

  getSettings(): NotificationSettingsWithStatus {
    const settings = this.store.getSettings();
    return {
      ...settings,
      collector: this.collector.status(),
    };
  }

  async updateSettings(patch: NotificationSettingsPatch): Promise<NotificationSettingsWithStatus> {
    const normalizedPatch: NotificationSettingsPatch = { ...patch };
    if (normalizedPatch.captureSystemNotifications) {
      const collectorStatus = this.collector.status();
      if (!collectorStatus.supported) {
        normalizedPatch.captureSystemNotifications = false;
      }
    }

    const next = this.store.setSettings(normalizedPatch);
    this.runRetention();
    await this.applyCollectorState(next);
    const payload = this.getSettings();
    this.emitSettings(payload);
    return payload;
  }
}
