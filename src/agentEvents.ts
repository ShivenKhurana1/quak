export interface ToolActivityEntry {
  tool: string;
  target?: string;
  status: 'running' | 'done' | 'error';
  preview?: string;
  ms?: number;
}

type Listener = (entries: ToolActivityEntry[]) => void;

const entries: ToolActivityEntry[] = [];
const listeners = new Set<Listener>();
const startTimes = new Map<string, number>();

function notify(): void {
  const snapshot = [...entries];
  for (const fn of listeners) fn(snapshot);
}

export function clearToolActivity(): void {
  entries.length = 0;
  startTimes.clear();
  notify();
}

export function startToolActivity(tool: string, target?: string): void {
  const key = `${tool}:${target ?? ''}:${Date.now()}`;
  startTimes.set(key, Date.now());
  entries.push({ tool, target, status: 'running' });
  if (entries.length > 30) entries.splice(0, entries.length - 30);
  notify();
}

export function finishToolActivity(
  tool: string,
  opts: { target?: string; preview?: string; ok?: boolean },
): void {
  const idx = [...entries].reverse().findIndex((e) => e.tool === tool && e.status === 'running');
  if (idx < 0) return;
  const realIdx = entries.length - 1 - idx;
  const entry = entries[realIdx];
  entry.status = opts.ok === false ? 'error' : 'done';
  entry.preview = opts.preview?.slice(0, 120);
  entry.target = opts.target ?? entry.target;
  const started = [...startTimes.values()].pop();
  if (started) entry.ms = Date.now() - started;
  notify();
}

export function pushSubAgentChunk(expertise: string, chunk: string): void {
  entries.push({
    tool: `sub:${expertise}`,
    status: 'running',
    preview: chunk.replace(/\x1b\[[0-9;]*m/g, '').slice(0, 80),
  });
  if (entries.length > 30) entries.splice(0, entries.length - 30);
  notify();
}

export function subscribeToolActivity(listener: Listener): () => void {
  listeners.add(listener);
  listener([...entries]);
  return () => listeners.delete(listener);
}