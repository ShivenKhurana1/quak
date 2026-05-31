import fs from 'fs';
import path from 'path';
import os from 'os';

const ROOT = path.join(os.homedir(), '.quak', 'checkpoints');

export interface FileCheckpoint {
  id: string;
  sessionId: string;
  promptId: string;
  filePath: string;
  createdAt: number;
  backupPath: string;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export class CheckpointStore {
  private getSessionDir(sessionId: string) {
    return path.join(ROOT, sessionId);
  }

  private getIndexFile(sessionId: string) {
    return path.join(this.getSessionDir(sessionId), 'index.jsonl');
  }

  saveBeforeEdit(sessionId: string, promptId: string, absPath: string, content: string): FileCheckpoint {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sessionDir = this.getSessionDir(sessionId);
    const backupDir = path.join(sessionDir, 'files');
    ensureDir(backupDir);

    const backupPath = path.join(backupDir, `${id}.bak`);
    fs.writeFileSync(backupPath, content, 'utf-8');

    const row: FileCheckpoint = {
      id,
      sessionId,
      promptId,
      filePath: absPath,
      createdAt: Date.now(),
      backupPath,
    };

    fs.appendFileSync(this.getIndexFile(sessionId), JSON.stringify(row) + '\n', 'utf-8');
    return row;
  }

  list(sessionId: string): FileCheckpoint[] {
    const f = this.getIndexFile(sessionId);
    if (!fs.existsSync(f)) return [];
    return fs.readFileSync(f, 'utf-8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as FileCheckpoint);
  }

  restore(checkpoint: FileCheckpoint): void {
    const content = fs.readFileSync(checkpoint.backupPath, 'utf-8');
    fs.writeFileSync(checkpoint.filePath, content, 'utf-8');
  }

  restoreLatest(sessionId: string, filePath?: string): FileCheckpoint | null {
    const list = this.list(sessionId);
    if (list.length === 0) return null;

    const match = filePath
      ? [...list].reverse().find(
          (c) =>
            c.filePath === filePath ||
            c.filePath.endsWith(filePath) ||
            c.filePath.endsWith(path.sep + filePath),
        )
      : list[list.length - 1];

    if (!match) return null;
    this.restore(match);
    return match;
  }
}