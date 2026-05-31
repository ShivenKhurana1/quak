import { z } from 'zod';
import { execSync } from 'child_process';
import { formatToolError } from '../utils/toolError.js';
import type { ToolName } from '../permissions.js';

type GuardFn = (tool: ToolName, target?: string) => Promise<string | null>;

function git(cwd: string, args: string, maxChars = 8000): string {
  try {
    const out = execSync(`git ${args}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 2 * 1024 * 1024,
    }).trim();
    if (out.length > maxChars) return out.slice(0, maxChars) + '\n...(truncated)';
    return out || '(empty)';
  } catch (e: unknown) {
    const err = e as { stderr?: string; message?: string };
    return formatToolError('command_failed', err.stderr?.trim() || err.message || 'git failed', { args });
  }
}

export function runGitStatus(cwd: string): string {
  return git(cwd, 'status --short');
}
export function runGitDiff(cwd: string, file?: string): string {
  return git(cwd, `diff HEAD ${file ? `-- ${file}` : ''}`.trim());
}
export function runGitLog(cwd: string, n = 15): string {
  return git(cwd, `log -n ${n} --oneline --decorate`);
}

export function createGitTools(
  projectRoot: string,
  touchTool: (name: string) => void,
  checkGuard: GuardFn,
) {
  return {
    gitStatus: {
      description: 'Show git status (short)',
      inputSchema: z.object({ reasoning: z.string() }),
      execute: async (): Promise<string> => {
        touchTool('gitStatus');
        const blocked = await checkGuard('gitStatus');
        if (blocked) return blocked;
        return runGitStatus(projectRoot);
      },
    },
    gitDiff: {
      description: 'Show git diff against HEAD',
      inputSchema: z.object({ path: z.string().optional(), reasoning: z.string() }),
      execute: async ({ path: filePath }: { path?: string }): Promise<string> => {
        touchTool('gitDiff');
        const blocked = await checkGuard('gitDiff', filePath);
        if (blocked) return blocked;
        return runGitDiff(projectRoot, filePath);
      },
    },
    gitLog: {
      description: 'Recent git commits',
      inputSchema: z.object({ count: z.number().optional(), reasoning: z.string() }),
      execute: async ({ count }: { count?: number }): Promise<string> => {
        touchTool('gitLog');
        const blocked = await checkGuard('gitLog');
        if (blocked) return blocked;
        return runGitLog(projectRoot, count ?? 15);
      },
    },
  };
}