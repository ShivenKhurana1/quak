import { spawn, type ChildProcess } from 'child_process';
import {
  appendCommandOutput,
  finishCommandRun,
  markCommandBackground,
  setCommandPid,
  startCommandRun,
} from './commandStatus.js';

const backgroundChildren = new Map<string, ChildProcess>();

const DEV_SERVER_READY =
  /ready in|started server|local:\s*https?:\/\/|compiled successfully/i;

export function isLongRunningCommand(command: string): boolean {
  const c = command.toLowerCase();
  return (
    /\bnext dev\b/.test(c) ||
    /\bnpm run dev\b/.test(c) ||
    /\bpnpm dev\b/.test(c) ||
    /\byarn dev\b/.test(c) ||
    /\bnpx next dev\b/.test(c) ||
    /\bnpm (run )?start\b/.test(c) ||
    /\bpnpm start\b/.test(c) ||
    /\byarn start\b/.test(c)
  );
}

export interface RunShellOptions {
  timeoutMs?: number;
  background?: boolean;
  backgroundWaitMs?: number;
}

export function runShellCommand(
  command: string,
  cwd: string,
  options: RunShellOptions = {},
): Promise<string> {
  const background = options.background ?? isLongRunningCommand(command);
  const timeoutMs = background ? 0 : (options.timeoutMs ?? 120_000);
  const backgroundWaitMs = options.backgroundWaitMs ?? 12_000;
  const runId = startCommandRun(command);

  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      env: process.env,
      detached: background,
    });

    if (child.pid != null) setCommandPid(runId, child.pid);
    if (background) backgroundChildren.set(runId, child);

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let returned = false;

    const finalizeReturn = (message: string) => {
      if (returned) return;
      returned = true;
      resolve(message);
    };

    let backgroundTimer: ReturnType<typeof setTimeout> | undefined;

    const onChunk = (chunk: string, target: 'stdout' | 'stderr') => {
      if (target === 'stdout') stdout += chunk;
      else stderr += chunk;

      appendCommandOutput(runId, chunk);

      if (background && DEV_SERVER_READY.test(stdout + stderr)) {
        markCommandBackground(runId);
        if (backgroundTimer) clearTimeout(backgroundTimer);
        if (child.unref) child.unref();
        finalizeReturn(formatBackgroundResult(runId, command, stdout, stderr, child.pid));
      }
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        finishCommandRun(runId, 'timeout');
        finalizeReturn(`Command timed out after ${timeoutMs}ms`);
      }, timeoutMs);
    }

    if (background) {
      backgroundTimer = setTimeout(() => {
        markCommandBackground(runId);
        if (child.unref) child.unref();
        finalizeReturn(formatBackgroundResult(runId, command, stdout, stderr, child.pid));
      }, backgroundWaitMs);
    }

    child.stdout?.on('data', (buf) => onChunk(buf.toString(), 'stdout'));
    child.stderr?.on('data', (buf) => onChunk(buf.toString(), 'stderr'));

    child.on('error', (error) => {
      if (timer) clearTimeout(timer);
      if (backgroundTimer) clearTimeout(backgroundTimer);
      if (!timedOut) finishCommandRun(runId, 'failed', -1);
      finalizeReturn(`Command failed to start: ${error.message}`);
    });

    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (backgroundTimer) clearTimeout(backgroundTimer);
      if (timedOut || returned) return;

      backgroundChildren.delete(runId);
      const exitCode = code ?? -1;
      finishCommandRun(runId, exitCode === 0 ? 'success' : 'failed', exitCode);

      const out = [stdout, stderr].filter(Boolean).join('\n').trim();
      const header = `exit_code: ${exitCode}`;
      finalizeReturn(out.length > 0 ? `${header}\n${out}` : header);
    });
  });
}

function formatBackgroundResult(
  runId: string,
  command: string,
  stdout: string,
  stderr: string,
  pid?: number,
): string {
  const out = [stdout, stderr].filter(Boolean).join('\n').trim();
  const tail = out.length > 4000 ? out.slice(-4000) : out;
  return [
    'status: running_in_background',
    `pid: ${pid ?? 'unknown'}`,
    `run_id: ${runId}`,
    `command: ${command}`,
    '',
    'The dev server is still running. Output continues in the Commands panel.',
    'Do not run the same dev command again unless you intend to start another instance.',
    '',
    tail || '(no output yet)',
  ].join('\n');
}

export function killBackgroundCommand(runId: string): boolean {
  const child = backgroundChildren.get(runId);
  if (!child) return false;
  child.kill('SIGTERM');
  backgroundChildren.delete(runId);
  return true;
}

export function killAllBackgroundCommands(): number {
  let count = 0;
  for (const [id, child] of backgroundChildren) {
    child.kill('SIGTERM');
    backgroundChildren.delete(id);
    count++;
  }
  return count;
}