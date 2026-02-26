import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import type { CollectorStatus, SystemNotificationPayload } from '../types';
import type { SystemNotificationCollector } from './index';

type ParsedAction = {
  id?: string;
  label?: string;
  shortcut?: string;
};

export class LinuxNotificationCollector implements SystemNotificationCollector {
  private process: ChildProcessWithoutNullStreams | null = null;
  private enabled = false;
  private supported = process.platform === 'linux';
  private lastError: string | null = null;
  private stdoutBuffer = '';
  private currentLines: string[] | null = null;
  private flushTimer: NodeJS.Timeout | null = null;
  private onEvent: ((payload: SystemNotificationPayload) => void) | null = null;

  start(onEvent: (payload: SystemNotificationPayload) => void): void {
    if (!this.supported || this.enabled) return;
    this.onEvent = onEvent;
    this.lastError = null;

    try {
      this.process = spawn(
        'dbus-monitor',
        ['--session', "interface='org.freedesktop.Notifications',member='Notify'"],
        { stdio: ['ignore', 'pipe', 'pipe'] }
      );
    } catch (error: any) {
      this.enabled = false;
      this.lastError = error?.message || 'Failed to start dbus-monitor';
      return;
    }

    this.enabled = true;

    this.process.stdout.on('data', (chunk: Buffer) => {
      this.consumeStdout(chunk.toString('utf8'));
    });

    this.process.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8').trim();
      if (text) {
        this.lastError = text;
      }
    });

    this.process.on('error', (error: any) => {
      this.enabled = false;
      if (error?.code === 'ENOENT') {
        this.supported = false;
        this.lastError = 'dbus-monitor command not available on this system';
      } else {
        this.lastError = error?.message || 'Collector process error';
      }
    });

    this.process.on('exit', (code) => {
      this.enabled = false;
      if (code !== 0 && code !== null) {
        this.lastError = `dbus-monitor exited with code ${code}`;
      }
    });
  }

  stop(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.flushCurrentEvent();
    if (this.process && !this.process.killed) {
      this.process.kill();
    }
    this.process = null;
    this.enabled = false;
    this.stdoutBuffer = '';
  }

  status(): CollectorStatus {
    return {
      platform: 'linux',
      supported: this.supported,
      enabled: this.enabled,
      mode: 'experimental',
      lastError: this.lastError,
    };
  }

  private consumeStdout(chunk: string): void {
    this.stdoutBuffer += chunk;

    let newlineIndex = this.stdoutBuffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = this.stdoutBuffer.slice(0, newlineIndex);
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);
      this.consumeLine(line);
      newlineIndex = this.stdoutBuffer.indexOf('\n');
    }
  }

  private consumeLine(rawLine: string): void {
    const line = rawLine.replace(/\r/g, '');

    if (line.includes('member=Notify')) {
      this.flushCurrentEvent();
      this.currentLines = [line];
      this.scheduleFlush();
      return;
    }

    if (!this.currentLines) return;
    this.currentLines.push(line);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    this.flushTimer = setTimeout(() => this.flushCurrentEvent(), 120);
  }

  private flushCurrentEvent(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (!this.currentLines || this.currentLines.length === 0) {
      this.currentLines = null;
      return;
    }

    const payload = this.parseNotifyEvent(this.currentLines);
    this.currentLines = null;
    if (payload && this.onEvent) {
      this.onEvent(payload);
    }
  }

  private parseNotifyEvent(lines: string[]): SystemNotificationPayload | null {
    const stringPattern = /^\s*string "(.*)"\s*$/;
    const allStringValues: string[] = [];

    for (const line of lines) {
      const match = line.match(stringPattern);
      if (!match) continue;
      const value = match[1].replace(/\\"/g, '"').trim();
      allStringValues.push(value);
    }

    if (allStringValues.length < 4) {
      return null;
    }

    const appName = allStringValues[0] || undefined;
    const title = allStringValues[2] || '';
    const body = allStringValues[3] || '';

    if (!title && !body) {
      return null;
    }

    const actions = this.parseActions(lines);

    return {
      appName,
      title,
      body,
      level: 'info',
      category: 'system-notification',
      actions,
      meta: {
        collector: 'linux-dbus-monitor',
      },
      raw: {
        collector: 'linux-dbus-monitor',
        lines,
      },
    };
  }

  private parseActions(lines: string[]): ParsedAction[] {
    let seenBodyString = false;
    let stringCounter = 0;
    let insideActionsArray = false;
    const actionValues: string[] = [];

    for (const line of lines) {
      const stringMatch = line.match(/^\s*string "(.*)"\s*$/);
      if (!seenBodyString && stringMatch) {
        stringCounter += 1;
        // 4th string in Notify() is body.
        if (stringCounter >= 4) {
          seenBodyString = true;
        }
      }

      if (!seenBodyString) continue;

      if (!insideActionsArray && /^\s*array \[\s*$/.test(line)) {
        insideActionsArray = true;
        continue;
      }

      if (insideActionsArray && /^\s*\]\s*$/.test(line)) {
        break;
      }

      if (insideActionsArray && stringMatch) {
        actionValues.push(stringMatch[1].replace(/\\"/g, '"'));
      }
    }

    const actions: ParsedAction[] = [];
    for (let i = 0; i < actionValues.length; i += 2) {
      const id = actionValues[i];
      const label = actionValues[i + 1];
      actions.push({
        id,
        label,
        shortcut: id,
      });
    }
    return actions;
  }
}
