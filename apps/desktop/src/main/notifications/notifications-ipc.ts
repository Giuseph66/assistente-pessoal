import { BrowserWindow, dialog, ipcMain } from 'electron';
import { writeFile } from 'fs/promises';
import { NotificationCenter } from './notification-center';
import { NotificationStore } from './notification-store';
import {
  NotificationExportFormat,
  NotificationListFilters,
  NotificationSettingsPatch,
} from './types';

const NOTIFICATIONS_LIST_CHANNEL = 'notifications:list';
const NOTIFICATIONS_GET_CHANNEL = 'notifications:get';
const NOTIFICATIONS_CLEAR_CHANNEL = 'notifications:clear';
const NOTIFICATIONS_DELETE_CHANNEL = 'notifications:delete';
const NOTIFICATIONS_EXPORT_CHANNEL = 'notifications:export';
const NOTIFICATIONS_SETTINGS_GET_CHANNEL = 'notifications:settings:get';
const NOTIFICATIONS_SETTINGS_SET_CHANNEL = 'notifications:settings:set';
const NOTIFICATIONS_NOTIFY_CHANNEL = 'notifications:notify';

const NOTIFICATIONS_UPDATED_EVENT = 'notifications:updated';
const NOTIFICATIONS_SETTINGS_UPDATED_EVENT = 'notifications:settings:updated';

function broadcast(channel: string, payload: unknown): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (win.isDestroyed()) return;
    const contents = win.webContents;
    if (contents.isDestroyed() || contents.isCrashed()) return;
    try {
      contents.send(channel, payload);
    } catch {
      // Ignore invalidated frame deliveries.
    }
  });
}

function sanitizeFilters(payload: any): NotificationListFilters {
  if (!payload || typeof payload !== 'object') return {};

  const filters: NotificationListFilters = {};

  if (typeof payload.search === 'string') filters.search = payload.search;
  if (payload.source === 'app' || payload.source === 'system' || payload.source === 'all') {
    filters.source = payload.source;
  }
  if (payload.level === 'info' || payload.level === 'warn' || payload.level === 'error' || payload.level === 'all') {
    filters.level = payload.level;
  }
  if (typeof payload.category === 'string') filters.category = payload.category;
  if (typeof payload.appName === 'string') filters.appName = payload.appName;
  if (Number.isFinite(payload.from)) filters.from = Number(payload.from);
  if (Number.isFinite(payload.to)) filters.to = Number(payload.to);
  if (Number.isFinite(payload.page)) filters.page = Number(payload.page);
  if (Number.isFinite(payload.pageSize)) filters.pageSize = Number(payload.pageSize);

  return filters;
}

function sanitizeSettingsPatch(payload: any): NotificationSettingsPatch {
  if (!payload || typeof payload !== 'object') return {};

  const patch: NotificationSettingsPatch = {};
  if (typeof payload.storeAppNotifications === 'boolean') {
    patch.storeAppNotifications = payload.storeAppNotifications;
  }
  if (typeof payload.captureSystemNotifications === 'boolean') {
    patch.captureSystemNotifications = payload.captureSystemNotifications;
  }
  if ([7, 30, 90].includes(payload.retentionDays)) {
    patch.retentionDays = payload.retentionDays;
  }
  if (Array.isArray(payload.blockedApps)) {
    patch.blockedApps = payload.blockedApps.map((entry) => String(entry));
  }
  return patch;
}

function sanitizeExportFormat(value: any): NotificationExportFormat {
  return value === 'csv' ? 'csv' : 'json';
}

export function registerNotificationsIpc(store: NotificationStore, center: NotificationCenter): void {
  ipcMain.removeHandler(NOTIFICATIONS_LIST_CHANNEL);
  ipcMain.removeHandler(NOTIFICATIONS_GET_CHANNEL);
  ipcMain.removeHandler(NOTIFICATIONS_CLEAR_CHANNEL);
  ipcMain.removeHandler(NOTIFICATIONS_DELETE_CHANNEL);
  ipcMain.removeHandler(NOTIFICATIONS_EXPORT_CHANNEL);
  ipcMain.removeHandler(NOTIFICATIONS_SETTINGS_GET_CHANNEL);
  ipcMain.removeHandler(NOTIFICATIONS_SETTINGS_SET_CHANNEL);
  ipcMain.removeHandler(NOTIFICATIONS_NOTIFY_CHANNEL);

  ipcMain.handle(NOTIFICATIONS_LIST_CHANNEL, async (_event, filters) => {
    return store.list(sanitizeFilters(filters));
  });

  ipcMain.handle(NOTIFICATIONS_GET_CHANNEL, async (_event, id) => {
    const safeId = String(id || '');
    if (!safeId) return null;
    return store.get(safeId);
  });

  ipcMain.handle(NOTIFICATIONS_DELETE_CHANNEL, async (_event, id) => {
    const safeId = String(id || '');
    if (!safeId) return { success: false };
    return { success: store.delete(safeId) };
  });

  ipcMain.handle(NOTIFICATIONS_CLEAR_CHANNEL, async (_event, payload) => {
    const from = Number(payload?.from);
    const to = Number(payload?.to);
    const days = Number(payload?.days);
    const deleted = Number.isFinite(from)
      ? store.clearByRange(from, Number.isFinite(to) ? to : Date.now())
      : Number.isFinite(days) && days > 0
        ? store.clearOlderThan(days)
        : store.clearAll();
    return { success: true, deleted };
  });

  ipcMain.handle(NOTIFICATIONS_EXPORT_CHANNEL, async (_event, payload) => {
    const format = sanitizeExportFormat(payload?.format);
    const filters = sanitizeFilters(payload?.filters);
    const defaultPath = `notifications-${Date.now()}.${format}`;

    const result = await dialog.showSaveDialog({
      title: 'Exportar notificacoes',
      defaultPath,
      filters: [
        {
          name: format === 'csv' ? 'CSV' : 'JSON',
          extensions: [format],
        },
      ],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    const exported = store.export(format, filters);
    await writeFile(result.filePath, exported.content, 'utf8');

    return {
      success: true,
      canceled: false,
      filePath: result.filePath,
      count: exported.count,
      format,
    };
  });

  ipcMain.handle(NOTIFICATIONS_SETTINGS_GET_CHANNEL, async () => {
    return center.getSettings();
  });

  ipcMain.handle(NOTIFICATIONS_SETTINGS_SET_CHANNEL, async (_event, patch) => {
    return center.updateSettings(sanitizeSettingsPatch(patch));
  });

  ipcMain.handle(NOTIFICATIONS_NOTIFY_CHANNEL, async (_event, payload) => {
    const title = String(payload?.title || '').trim();
    if (!title) {
      return { success: false, error: 'missing_title' };
    }
    const saved = await center.notify({
      title,
      body: typeof payload?.body === 'string' ? payload.body : '',
      level: payload?.level === 'warn' || payload?.level === 'error' ? payload.level : 'info',
      category: typeof payload?.category === 'string' ? payload.category : undefined,
      meta: payload?.meta && typeof payload.meta === 'object' ? payload.meta : undefined,
    });
    return { success: true, saved };
  });

  center.onNotificationSaved((notification) => {
    broadcast(NOTIFICATIONS_UPDATED_EVENT, notification);
  });
  center.onSettingsChanged((settings) => {
    broadcast(NOTIFICATIONS_SETTINGS_UPDATED_EVENT, settings);
  });
}
