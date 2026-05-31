import fs from 'fs';
import path from 'path';
import os from 'os';

const SESSIONS_DIR = path.join(os.homedir(), '.quak', 'sessions');

export interface StoredMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function persistSession(sessionId: string, messages: StoredMessage[]): void {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(SESSIONS_DIR, `${sessionId}.json`),
    JSON.stringify({ sessionId, updatedAt: Date.now(), messages }, null, 2),
  );
}

export function loadSession(sessionId: string): StoredMessage[] | null {
  const file = path.join(SESSIONS_DIR, `${sessionId}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return (JSON.parse(fs.readFileSync(file, 'utf-8')) as { messages?: StoredMessage[] }).messages ?? null;
  } catch {
    return null;
  }
}
export function searchSessions(query: string): { sessionId: string; match: string; updatedAt: number }[] {
  if (!fs.existsSync(SESSIONS_DIR)) return [];
  const results: { sessionId: string; match: string; updatedAt: number }[] = [];
  const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
  const q = query.toLowerCase();
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf-8'));
      const sessionId = data.sessionId ?? file.replace(/\.json$/, '');
      const msgs: StoredMessage[] = data.messages ?? [];
      const match = msgs.find(m => m.content.toLowerCase().includes(q));
      if (match) {
        results.push({ sessionId, match: match.content.slice(0, 200), updatedAt: data.updatedAt ?? 0 });
      }
    } catch {}
  }
  return results.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 20);
}

export function tagSession(sessionId: string, tags: string[]): void {
  const file = path.join(SESSIONS_DIR, `${sessionId}.json`);
  if (!fs.existsSync(file)) return;
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    data.tags = [...new Set([...(data.tags ?? []), ...tags])];
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch {}
}

export function exportSession(sessionId: string, format: 'json' | 'markdown' = 'markdown'): string | null {
  const file = path.join(SESSIONS_DIR, `${sessionId}.json`);
  if (!fs.existsSync(file)) return null;
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const msgs: StoredMessage[] = data.messages ?? [];
  if (format === 'json') return JSON.stringify(msgs, null, 2);
  return msgs.map(m => `## ${m.role.toUpperCase()}\n${m.content}\n`).join('---\n');
}

export function cleanOldSessions(maxAgeDays = 30): number {
  const cutoff = Date.now() - (maxAgeDays * 86400000);
  let removed = 0;
  const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const stat = fs.statSync(path.join(SESSIONS_DIR, file));
    if (stat.mtimeMs < cutoff) {
      fs.unlinkSync(path.join(SESSIONS_DIR, file));
      removed++;
    }
  }
  return removed;
}
export function listRecentSessions(limit = 5): { sessionId: string; updatedAt: number }[] {
  if (!fs.existsSync(SESSIONS_DIR)) return [];
  return fs
    .readdirSync(SESSIONS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const file = path.join(SESSIONS_DIR, f);
      const data = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
        sessionId?: string;
        updatedAt?: number;
      };
      return {
        sessionId: data.sessionId ?? f.replace(/\.json$/, ''),
        updatedAt: data.updatedAt ?? fs.statSync(file).mtimeMs,
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

export function getLatestSessionId(): string | null {
  const recent = listRecentSessions(1);
  return recent[0]?.sessionId ?? null;
}
