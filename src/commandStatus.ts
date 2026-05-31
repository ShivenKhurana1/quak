import { pushEvent } from './current.js';

export type CommandRunStatus = 'running' | 'background' | 'success' | 'failed' | 'timeout';

export interface CommandRun {
  id: string;
  command: string;
  status: CommandRunStatus;
  exitCode?: number;
  startedAt: number;
  endedAt?: number;
  output: string;
  pid?: number;
}

const MAX_RUNS = 8;
const MAX_OUTPUT_CHARS = 12_000;
const runs: CommandRun[] = [];
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) fn();
}

function getRun(id: string): CommandRun | undefined {
  return runs.find((r) => r.id === id);
}

export function subscribeCommandStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRecentCommandRuns(): CommandRun[] {
  return [...runs];
}

export function getActiveCommandRuns(): CommandRun[] {
  return runs.filter((r) => r.status === 'running' || r.status === 'background');
}

export function startCommandRun(command: string): string {
  const id = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  runs.push({
    id,
    command,
    status: 'running',
    startedAt: Date.now(),
    output: '',
  });
  if (runs.length > MAX_RUNS) runs.splice(0, runs.length - MAX_RUNS);
  notify();
  return id;
}

export function appendCommandOutput(id: string, chunk: string): void {
  const run = getRun(id);
  if (!run || !chunk) return;
  run.output += chunk;
  if (run.output.length > MAX_OUTPUT_CHARS) {
    run.output = run.output.slice(-MAX_OUTPUT_CHARS);
  }
  notify();
}

export function setCommandPid(id: string, pid: number): void {
  const run = getRun(id);
  if (!run) return;
  run.pid = pid;
  notify();
}

export function markCommandBackground(id: string): void {
  const run = getRun(id);
  if (!run) return;
  run.status = 'background';
  notify();
}

export function finishCommandRun(
  id: string,
  status: Exclude<CommandRunStatus, 'running' | 'background'>,
  exitCode?: number,
): void {
  const run = getRun(id);
  if (!run) return;
  run.status = status;
  run.exitCode = exitCode;
  run.endedAt = Date.now();
  const label =
    status === 'success' ? 'OK' : status === 'timeout' ? 'TIMEOUT' : `EXIT ${exitCode ?? '?'}`;
  pushEvent('command', `[${label}] ${run.command.slice(0, 80)}`);
  notify();
}

export function clearCommandRuns(): void {
  runs.length = 0;
  notify();
}

export function getCommandOutputTail(id: string, maxLines = 14): string {
  const run = getRun(id);
  if (!run?.output) return '';
  const lines = run.output.split('\n');
  return lines.slice(-maxLines).join('\n');
}
