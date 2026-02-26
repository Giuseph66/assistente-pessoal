import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'path';
import { randomUUID } from 'crypto';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NotificationEntry,
  NotificationExportFormat,
  NotificationLevel,
  NotificationListFilters,
  NotificationListResult,
  NotificationSaveInput,
  NotificationSettings,
  NotificationSettingsPatch,
  NotificationSource,
} from './types';

type NotificationRow = {
  id: string;
  createdAt: number;
  source: string;
  os: NodeJS.Platform;
  appName: string | null;
  title: string;
  body: string;
  level: string;
  category: string | null;
  meta: string | null;
  raw: string | null;
};

type WhereResult = {
  sql: string;
  params: unknown[];
};

export class NotificationStore {
  private db: Database.Database;
  private readonly dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath ?? join(app.getPath('userData'), 'notifications.sqlite');
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.init();
  }

  getPath(): string {
    return this.dbPath;
  }

  close(): void {
    this.db.close();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        createdAt INTEGER NOT NULL,
        source TEXT NOT NULL,
        os TEXT NOT NULL,
        appName TEXT,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        level TEXT NOT NULL,
        category TEXT,
        meta TEXT,
        raw TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_createdAt ON notifications(createdAt DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_source ON notifications(source);
      CREATE INDEX IF NOT EXISTS idx_notifications_appName ON notifications(appName);
      CREATE INDEX IF NOT EXISTS idx_notifications_level ON notifications(level);

      CREATE TABLE IF NOT EXISTS notification_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    this.seedDefaultSettings();
  }

  private seedDefaultSettings(): void {
    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO notification_settings (key, value)
      VALUES (?, ?)
    `);
    insert.run('storeAppNotifications', JSON.stringify(DEFAULT_NOTIFICATION_SETTINGS.storeAppNotifications));
    insert.run('captureSystemNotifications', JSON.stringify(DEFAULT_NOTIFICATION_SETTINGS.captureSystemNotifications));
    insert.run('retentionDays', JSON.stringify(DEFAULT_NOTIFICATION_SETTINGS.retentionDays));
    insert.run('blockedApps', JSON.stringify(DEFAULT_NOTIFICATION_SETTINGS.blockedApps));
  }

  private parseJson<T>(value: string | null, fallback: T): T {
    if (!value) return fallback;
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  private stringifyJson(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }

  private normalizeSource(source: string): NotificationSource {
    return source === 'system' ? 'system' : 'app';
  }

  private normalizeLevel(level: string): NotificationLevel {
    if (level === 'warn' || level === 'error') return level;
    return 'info';
  }

  private rowToEntry(row: NotificationRow): NotificationEntry {
    return {
      id: row.id,
      createdAt: Number(row.createdAt),
      source: this.normalizeSource(row.source),
      os: row.os,
      appName: row.appName,
      title: row.title,
      body: row.body,
      level: this.normalizeLevel(row.level),
      category: row.category,
      meta: this.parseJson<Record<string, unknown> | null>(row.meta, null),
      raw: this.parseJson<Record<string, unknown> | null>(row.raw, null),
    };
  }

  save(input: NotificationSaveInput): NotificationEntry {
    const id = input.id ?? randomUUID();
    const createdAt = input.createdAt ?? Date.now();
    const source = input.source === 'system' ? 'system' : 'app';
    const level = this.normalizeLevel(input.level);

    this.db
      .prepare(`
        INSERT INTO notifications (
          id, createdAt, source, os, appName, title, body, level, category, meta, raw
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        createdAt,
        source,
        input.os,
        input.appName ?? null,
        input.title?.trim() || 'Sem titulo',
        input.body ?? '',
        level,
        input.category ?? null,
        this.stringifyJson(input.meta ?? null),
        this.stringifyJson(input.raw ?? null)
      );

    const saved = this.get(id);
    if (!saved) {
      throw new Error('Failed to read saved notification');
    }
    return saved;
  }

  get(id: string): NotificationEntry | null {
    const row = this.db
      .prepare('SELECT * FROM notifications WHERE id = ?')
      .get(id) as NotificationRow | undefined;
    return row ? this.rowToEntry(row) : null;
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
    return result.changes > 0;
  }

  clearAll(): number {
    const result = this.db.prepare('DELETE FROM notifications').run();
    return result.changes;
  }

  clearOlderThan(days: number): number {
    const safeDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : DEFAULT_NOTIFICATION_SETTINGS.retentionDays;
    const threshold = Date.now() - safeDays * 24 * 60 * 60 * 1000;
    const result = this.db
      .prepare('DELETE FROM notifications WHERE createdAt < ?')
      .run(threshold);
    return result.changes;
  }

  clearByRange(from: number, to: number): number {
    const safeFrom = Number.isFinite(from) ? Number(from) : 0;
    const safeTo = Number.isFinite(to) ? Number(to) : Date.now();
    const result = this.db
      .prepare('DELETE FROM notifications WHERE createdAt >= ? AND createdAt <= ?')
      .run(safeFrom, safeTo);
    return result.changes;
  }

  private buildWhere(filters: NotificationListFilters = {}): WhereResult {
    const clauses: string[] = [];
    const params: unknown[] = [];

    const search = (filters.search || '').trim();
    if (search) {
      const like = `%${search}%`;
      clauses.push('(title LIKE ? OR body LIKE ? OR IFNULL(appName, \'\') LIKE ? OR IFNULL(category, \'\') LIKE ?)');
      params.push(like, like, like, like);
    }

    if (filters.source && filters.source !== 'all') {
      clauses.push('source = ?');
      params.push(filters.source);
    }

    if (filters.level && filters.level !== 'all') {
      clauses.push('level = ?');
      params.push(filters.level);
    }

    const category = (filters.category || '').trim();
    if (category) {
      clauses.push('category = ?');
      params.push(category);
    }

    const appName = (filters.appName || '').trim();
    if (appName) {
      clauses.push('appName = ?');
      params.push(appName);
    }

    if (Number.isFinite(filters.from)) {
      clauses.push('createdAt >= ?');
      params.push(Number(filters.from));
    }

    if (Number.isFinite(filters.to)) {
      clauses.push('createdAt <= ?');
      params.push(Number(filters.to));
    }

    return {
      sql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
      params,
    };
  }

  list(filters: NotificationListFilters = {}): NotificationListResult {
    const page = Math.max(1, Math.floor(filters.page ?? 1));
    const pageSize = Math.min(200, Math.max(1, Math.floor(filters.pageSize ?? 20)));
    const offset = (page - 1) * pageSize;

    const where = this.buildWhere(filters);

    const totalRow = this.db
      .prepare(`SELECT COUNT(*) as count FROM notifications ${where.sql}`)
      .get(...where.params) as { count: number };
    const total = Number(totalRow?.count ?? 0);

    const rows = this.db
      .prepare(`
        SELECT * FROM notifications
        ${where.sql}
        ORDER BY createdAt DESC
        LIMIT ? OFFSET ?
      `)
      .all(...where.params, pageSize, offset) as NotificationRow[];

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      items: rows.map((row) => this.rowToEntry(row)),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  private listForExport(filters: NotificationListFilters = {}): NotificationEntry[] {
    const where = this.buildWhere(filters);
    const rows = this.db
      .prepare(`
        SELECT * FROM notifications
        ${where.sql}
        ORDER BY createdAt DESC
      `)
      .all(...where.params) as NotificationRow[];
    return rows.map((row) => this.rowToEntry(row));
  }

  export(format: NotificationExportFormat, filters: NotificationListFilters = {}): { content: string; count: number } {
    const items = this.listForExport(filters);

    if (format === 'csv') {
      const header = [
        'id',
        'createdAt',
        'source',
        'os',
        'appName',
        'title',
        'body',
        'level',
        'category',
        'meta',
        'raw',
      ];
      const csvEscape = (value: unknown): string => {
        const text = String(value ?? '');
        return `"${text.replace(/"/g, '""')}"`;
      };
      const lines = items.map((item) =>
        [
          item.id,
          item.createdAt,
          item.source,
          item.os,
          item.appName ?? '',
          item.title,
          item.body,
          item.level,
          item.category ?? '',
          item.meta ? JSON.stringify(item.meta) : '',
          item.raw ? JSON.stringify(item.raw) : '',
        ]
          .map(csvEscape)
          .join(',')
      );
      return { content: [header.join(','), ...lines].join('\n'), count: items.length };
    }

    return {
      content: JSON.stringify(items, null, 2),
      count: items.length,
    };
  }

  private getSetting<T>(key: string, fallback: T): T {
    const row = this.db
      .prepare('SELECT value FROM notification_settings WHERE key = ?')
      .get(key) as { value: string } | undefined;
    return this.parseJson<T>(row?.value ?? null, fallback);
  }

  private setSetting(key: string, value: unknown): void {
    this.db
      .prepare(`
        INSERT INTO notification_settings (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `)
      .run(key, JSON.stringify(value));
  }

  getSettings(): NotificationSettings {
    const rawStoreApp = this.getSetting<boolean>('storeAppNotifications', DEFAULT_NOTIFICATION_SETTINGS.storeAppNotifications);
    const rawCapture = this.getSetting<boolean>('captureSystemNotifications', DEFAULT_NOTIFICATION_SETTINGS.captureSystemNotifications);
    const rawRetention = this.getSetting<number>('retentionDays', DEFAULT_NOTIFICATION_SETTINGS.retentionDays);
    const rawBlockedApps = this.getSetting<string[]>('blockedApps', DEFAULT_NOTIFICATION_SETTINGS.blockedApps);

    const retentionDays: 7 | 30 | 90 = [7, 30, 90].includes(rawRetention) ? (rawRetention as 7 | 30 | 90) : 30;
    const blockedApps = Array.isArray(rawBlockedApps)
      ? Array.from(
        new Set(
          rawBlockedApps
            .map((entry) => String(entry).trim())
            .filter(Boolean)
        )
      )
      : [];

    return {
      storeAppNotifications: Boolean(rawStoreApp),
      captureSystemNotifications: Boolean(rawCapture),
      retentionDays,
      blockedApps,
    };
  }

  setSettings(patch: NotificationSettingsPatch): NotificationSettings {
    const current = this.getSettings();
    const next: NotificationSettings = {
      storeAppNotifications: patch.storeAppNotifications ?? current.storeAppNotifications,
      captureSystemNotifications: patch.captureSystemNotifications ?? current.captureSystemNotifications,
      retentionDays: [7, 30, 90].includes(patch.retentionDays as number)
        ? (patch.retentionDays as 7 | 30 | 90)
        : current.retentionDays,
      blockedApps: Array.isArray(patch.blockedApps)
        ? Array.from(
          new Set(
            patch.blockedApps
              .map((entry) => String(entry).trim())
              .filter(Boolean)
          )
        )
        : current.blockedApps,
    };

    this.setSetting('storeAppNotifications', next.storeAppNotifications);
    this.setSetting('captureSystemNotifications', next.captureSystemNotifications);
    this.setSetting('retentionDays', next.retentionDays);
    this.setSetting('blockedApps', next.blockedApps);

    return next;
  }
}
