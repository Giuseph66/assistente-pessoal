export type NotificationSource = 'app' | 'system';
export type NotificationLevel = 'info' | 'warn' | 'error';
export type NotificationExportFormat = 'json' | 'csv';

export type NotificationEntry = {
  id: string;
  createdAt: number;
  source: NotificationSource;
  os: NodeJS.Platform;
  appName?: string | null;
  title: string;
  body: string;
  level: NotificationLevel;
  category?: string | null;
  meta?: Record<string, unknown> | null;
  raw?: Record<string, unknown> | null;
};

export type NotificationSaveInput = Omit<NotificationEntry, 'id' | 'createdAt'> & {
  id?: string;
  createdAt?: number;
};

export type NotificationListFilters = {
  search?: string;
  source?: NotificationSource | 'all';
  level?: NotificationLevel | 'all';
  category?: string;
  appName?: string;
  from?: number;
  to?: number;
  page?: number;
  pageSize?: number;
};

export type NotificationListResult = {
  items: NotificationEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type NotificationSettings = {
  storeAppNotifications: boolean;
  captureSystemNotifications: boolean;
  retentionDays: 7 | 30 | 90;
  blockedApps: string[];
};

export type NotificationSettingsPatch = Partial<NotificationSettings>;

export type CollectorStatus = {
  platform: NodeJS.Platform;
  supported: boolean;
  enabled: boolean;
  mode: 'official' | 'experimental' | 'planned' | 'unsupported';
  lastError: string | null;
};

export type NotificationSettingsWithStatus = NotificationSettings & {
  collector: CollectorStatus;
};

export type SystemNotificationPayload = {
  appName?: string;
  title?: string;
  body?: string;
  level?: NotificationLevel | string;
  category?: string;
  actions?: Array<{ id?: string; label?: string; shortcut?: string }>;
  meta?: Record<string, unknown>;
  raw?: Record<string, unknown>;
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  storeAppNotifications: true,
  captureSystemNotifications: false,
  retentionDays: 30,
  blockedApps: [],
};
