import { execSync } from 'child_process';

export type NotificationChannel = 'auto' | 'terminal_bell' | 'notifications_disabled';

export function notify(title: string, message: string, channel: NotificationChannel = 'auto'): void {
  switch (channel) {
    case 'notifications_disabled':
      return;
    case 'terminal_bell':
      process.stdout.write('\x07');
      return;
    case 'auto':
    default:
      try {
        if (process.platform === 'darwin') {
          execSync(`osascript -e 'display notification "${message.replace(/"/g, '\\"')}" with title "${title.replace(/"/g, '\\"')}"'`, { timeout: 2000 });
        } else if (process.platform === 'linux') {
          execSync(`notify-send "${title}" "${message}"`, { timeout: 2000 });
        } else {
          process.stdout.write('\x07');
        }
      } catch {
        process.stdout.write('\x07');
      }
  }
}