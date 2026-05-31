import chokidar from 'chokidar';
import { EventEmitter } from 'events';

type WatchEvent = 'change' | 'add' | 'unlink' | 'addDir' | 'unlinkDir';

interface FileChange {
  type: WatchEvent;
  path: string;
  timestamp: number;
}

class FileWatcher extends EventEmitter {
  private watcher: chokidar.FSWatcher | null = null;
  private changeBuffer: FileChange[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  start(projectDir: string, patterns: string[] = ['src/**/*', '*.json', '*.ts', '*.tsx', '*.js', '*.jsx']): void {
    if (this.watcher) this.stop();
    this.watcher = chokidar.watch(patterns, {
      cwd: projectDir,
      ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/.next/**'],
      persistent: true,
      ignoreInitial: true,
    });
    for (const event of ['change', 'add', 'unlink', 'addDir', 'unlinkDir'] as WatchEvent[]) {
      this.watcher.on(event, (filePath: string) => {
        this.changeBuffer.push({ type: event, path: filePath, timestamp: Date.now() });
        this.scheduleFlush();
      });
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      const batch = this.changeBuffer.splice(0);
      if (batch.length > 0) this.emit('changes', batch);
    }, 500);
  }

  getRecentChanges(sinceMs = 5000): FileChange[] {
    return this.changeBuffer.filter(c => Date.now() - c.timestamp < sinceMs);
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
  }
}

export const fileWatcher = new FileWatcher();