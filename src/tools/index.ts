import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';
import { z } from 'zod';
import { Storage } from '../storage.js';
import { evaluatePermission, PermissionSettings, ToolName } from '../permissions.js';
import { pushEvent } from '../current.js';
import { CheckpointStore } from '../checkpoints.js';
import { ToolWorkflow } from './workflow.js';
import { requestPermission } from '../permissionsPrompt.js';
import { runShellCommand, isLongRunningCommand } from '../shell.js';
import { runGrep } from './grep.js';
import { runReadLints } from './lint.js';
import { runFetchUrl } from './fetch.js';
import { createGitTools } from './git.js';
import { markPlanStep } from './plan.js';
import { loadPluginTools } from '../pluginLoader.js';

function normalizeRelativePath(root: string, absolutePath: string): string {
  return path.relative(root, absolutePath).split(path.sep).join('/');
}

function createGuard(permissionSettings: PermissionSettings) {
  return (tool: ToolName, targetPath?: string): string | null => {
    const decision = evaluatePermission(permissionSettings, tool, targetPath);
    if (decision.action === 'deny') return `Error: Permission denied. ${decision.reason}`;
    if (decision.action === 'ask') return `Error: Permission required. ${decision.reason}`;
    return null;
  };
}

async function checkGuard(
  guard: ReturnType<typeof createGuard>,
  tool: ToolName,
  targetPath?: string,
): Promise<string | null> {
  const blocked = guard(tool, targetPath);
  if (!blocked) return null;
  if (blocked.startsWith('Error: Permission required')) {
    const ok = await requestPermission({
      tool,
      target: targetPath,
      reason: blocked.replace('Error: Permission required. ', ''),
    });
    if (!ok) return 'Error: Permission denied by user';
    return null;
  }
  return blocked;
}

function makeIgnorePatterns(skipDirs: string[]): string[] {
  return skipDirs.flatMap((dir) => [`**/${dir}`, `**/${dir}/**`]);
}

export async function createTools(
  storage: Storage,
  projectDir: string,
  permissionSettings: PermissionSettings,
  sessionId: string,
  promptId: string,
  workflow: ToolWorkflow,
) {
  const projectRoot = path.resolve(projectDir);
  const checkpoints = new CheckpointStore();
  const guard = createGuard(permissionSettings);
  const defaultSkipDirs = ['node_modules', '.git', '.next', 'dist', 'build', '.turbo', 'coverage', 'out'];
  const shellSettings = storage.loadShellSettings();

  const touchTool = (toolName: string): void => {
    const state = storage.loadState();
    state.totalToolCalls += 1;
    state.lastActive = Date.now();
    storage.saveState(state);
    pushEvent('tool', toolName);
  };

  const resolveProjectPath = (filePath: string): string | null => {
    const resolved = path.resolve(projectDir, filePath);
    if (resolved === projectRoot) return resolved;
    if (!resolved.startsWith(`${projectRoot}${path.sep}`)) return null;
    return resolved;
  };

  const walkEntries = (
    rootDir: string,
    visitor: (absolutePath: string, relativePath: string, isDirectory: boolean) => void,
    recursive: boolean,
    skipDirs: Set<string>,
  ): void => {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(rootDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory() && skipDirs.has(entry.name)) continue;
      const absolutePath = path.join(rootDir, entry.name);
      const relativePath = normalizeRelativePath(projectDir, absolutePath);
      visitor(absolutePath, relativePath, entry.isDirectory());
      if (recursive && entry.isDirectory()) {
        walkEntries(absolutePath, visitor, true, skipDirs);
      }
    }
  };

  const markRead = (absPath: string): void => {
    workflow.markRead(normalizeRelativePath(projectDir, absPath));
  };

  const gitGuard = (tool: ToolName, target?: string) => checkGuard(guard, tool, target);

  const agentSettings = storage.loadAgentSettings();

  const lintAfterEdit = (filePath: string, msg: string): string => {
    if (!agentSettings.lintOnEdit) return msg;
    return `${msg}\n\n${runReadLints(projectRoot, filePath)}`;
  };

  return {
    readFile: {
      description: 'Read a file and return its contents with line numbers',
      inputSchema: z.object({
        path: z.string(),
        reasoning: z.string(),
      }),
      execute: async ({ path: filePath }: { path: string }): Promise<string> => {
        touchTool('readFile');
        const fullPath = resolveProjectPath(filePath);
        if (!fullPath) return `Error: Path escapes project directory: ${filePath}`;
        if (!fs.existsSync(fullPath)) return `Error: File not found: ${filePath}`;
        if (fs.statSync(fullPath).isDirectory()) return `Error: ${filePath} is a directory`;
        const rel = normalizeRelativePath(projectDir, fullPath);
        const blocked = await checkGuard(guard, 'readFile', rel);
        if (blocked) return blocked;
        const alreadyRead = workflow.hasRead(rel);
        if (!alreadyRead) markRead(fullPath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const numbered = content
          .split('\n')
          .map((line, index) => `${index + 1}: ${line}`)
          .join('\n');
        if (alreadyRead) {
          return `Note: Already read ${filePath} this session.\n\n${numbered}`;
        }
        return numbered;
      },
    },
    editFile: {
      description: 'Replace exact text in an existing file',
      inputSchema: z.object({
        path: z.string(),
        oldString: z.string(),
        newString: z.string(),
        replaceAll: z.boolean().optional(),
        reasoning: z.string(),
      }),
      execute: async ({
        path: filePath,
        oldString,
        newString,
        replaceAll,
      }: {
        path: string;
        oldString: string;
        newString: string;
        replaceAll?: boolean;
      }): Promise<string> => {
        touchTool('editFile');
        const fullPath = resolveProjectPath(filePath);
        if (!fullPath) return `Error: Path escapes project directory: ${filePath}`;
        if (!fs.existsSync(fullPath)) return `Error: File not found: ${filePath}`;
        const rel = normalizeRelativePath(projectDir, fullPath);
        const blocked = await checkGuard(guard, 'editFile', rel);
        if (blocked) return blocked;
        if (!workflow.canEdit(rel, true)) return 'Error: Read the file before editing it';

        const content = fs.readFileSync(fullPath, 'utf-8');
        const occurrences = content.split(oldString).length - 1;
        if (occurrences === 0) return 'Error: oldString not found in file';
        if (occurrences > 1 && !replaceAll) {
          return `Error: oldString appears ${occurrences} times. Use replaceAll or provide more context`;
        }

        checkpoints.saveBeforeEdit(sessionId, promptId, fullPath, content);
        const updated = replaceAll
          ? content.replaceAll(oldString, newString)
          : content.replace(oldString, newString);
        fs.writeFileSync(fullPath, updated, 'utf-8');
        const diffLines: string[] = [];
        const oldLines = content.split('\n');
        const newLines = updated.split('\n');
        const maxLen = Math.max(oldLines.length, newLines.length);
        for (let i = 0; i < maxLen; i++) {
          if (oldLines[i] !== newLines[i]) {
            if (oldLines[i] !== undefined) diffLines.push(`- ${oldLines[i]}`);
            if (newLines[i] !== undefined) diffLines.push(`+ ${newLines[i]}`);
          }
        }
        const diffText = diffLines.slice(0, 20).join('\n');
        const suffix = diffLines.length > 20 ? '\n...(diff truncated)' : '';
        return lintAfterEdit(filePath, `Updated ${filePath}\`\`\`diff\n${diffText}${suffix}\n\`\`\``);
      },
    },
    writeFile: {
      description: 'Write content to a file',
      inputSchema: z.object({
        path: z.string(),
        content: z.string(),
        reasoning: z.string(),
      }),
      execute: async ({ path: filePath, content }: { path: string; content: string }): Promise<string> => {
        touchTool('writeFile');
        const fullPath = resolveProjectPath(filePath);
        if (!fullPath) return `Error: Path escapes project directory: ${filePath}`;
        const rel = normalizeRelativePath(projectDir, fullPath);
        const blocked = await checkGuard(guard, 'writeFile', rel);
        if (blocked) return blocked;
        const exists = fs.existsSync(fullPath);
        if (exists && !workflow.canEdit(rel, true)) return 'Error: Read the file before overwriting it';
        if (exists) {
          checkpoints.saveBeforeEdit(sessionId, promptId, fullPath, fs.readFileSync(fullPath, 'utf-8'));
        }
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content, 'utf-8');
        markRead(fullPath);
        return lintAfterEdit(filePath, `Wrote ${filePath}`);
      },
    },
    searchFiles: {
      description: 'Search for files and directories by name',
      inputSchema: z.object({
        query: z.string(),
        skipDirs: z.array(z.string()).optional(),
        maxResults: z.number().optional(),
        reasoning: z.string(),
      }),
      execute: async ({
        query,
        skipDirs: extraSkipDirs,
        maxResults,
      }: {
        query: string;
        skipDirs?: string[];
        maxResults?: number;
      }): Promise<string> => {
        touchTool('searchFiles');
        const blocked = await checkGuard(guard, 'searchFiles');
        if (blocked) return blocked;
        const needle = query.toLowerCase();
        const limit = maxResults ?? 20;
        const matches: string[] = [];
        const skipDirs = new Set(extraSkipDirs ?? defaultSkipDirs);
        walkEntries(
          projectRoot,
          (_abs, rel, isDirectory) => {
            if (matches.length >= limit) return;
            if (rel.toLowerCase().includes(needle)) {
              matches.push(`${rel} (${isDirectory ? 'dir' : 'file'})`);
            }
          },
          true,
          skipDirs,
        );
        return matches.length > 0
          ? `Found ${matches.length} matches:\n${matches.join('\n')}`
          : `No matches found for: "${query}"`;
      },
    },
    glob: {
      description: 'Find files matching a glob pattern',
      inputSchema: z.object({
        pattern: z.string(),
        skipDirs: z.array(z.string()).optional(),
        maxResults: z.number().optional(),
        reasoning: z.string(),
      }),
      execute: async ({
        pattern,
        skipDirs,
        maxResults,
      }: {
        pattern: string;
        skipDirs?: string[];
        maxResults?: number;
      }): Promise<string> => {
        touchTool('glob');
        const blocked = await checkGuard(guard, 'glob');
        if (blocked) return blocked;
        const ignored = makeIgnorePatterns(skipDirs ?? defaultSkipDirs);
        const matches = globSync(pattern, {
          cwd: projectRoot,
          dot: true,
          nodir: true,
          ignore: ignored,
        })
          .slice(0, maxResults ?? 100)
          .map((match) => match.split(path.sep).join('/'));
        return matches.length > 0
          ? `Found ${matches.length} matches:\n${matches.join('\n')}`
          : `No files matched: "${pattern}"`;
      },
    },
    grep: {
      description: 'Search file contents (ripgrep when available)',
      inputSchema: z.object({
        pattern: z.string(),
        glob: z.string().optional(),
        skipDirs: z.array(z.string()).optional(),
        maxResults: z.number().optional(),
        outputMode: z.enum(['files_with_matches', 'content', 'count']).default('content'),
        caseInsensitive: z.boolean().optional().default(false),
        contextLines: z.number().optional().default(0),
        reasoning: z.string(),
      }),
      execute: async ({
        pattern,
        glob: globPattern,
        skipDirs,
        maxResults,
        outputMode,
        caseInsensitive,
        contextLines,
      }: {
        pattern: string;
        glob?: string;
        skipDirs?: string[];
        maxResults?: number;
        outputMode: 'files_with_matches' | 'content' | 'count';
        caseInsensitive?: boolean;
        contextLines?: number;
      }): Promise<string> => {
        touchTool('grep');
        const blocked = await checkGuard(guard, 'grep');
        if (blocked) return blocked;
        return runGrep({
          pattern,
          cwd: projectRoot,
          glob: globPattern,
          ignoreGlobs: skipDirs ?? defaultSkipDirs,
          maxResults: maxResults ?? 100,
          outputMode,
          caseInsensitive: caseInsensitive ?? false,
          contextLines: contextLines ?? 0,
        });
      },
    },
    runCommand: {
      description:
        'Run a shell command. Dev servers (npm run dev, next dev) run in background automatically. Output streams live in the Commands panel.',
      inputSchema: z.object({
        command: z.string(),
        background: z.boolean().optional(),
        timeoutMs: z.number().optional(),
        reasoning: z.string(),
      }),
      execute: async ({
        command,
        background,
        timeoutMs,
      }: {
        command: string;
        background?: boolean;
        timeoutMs?: number;
      }): Promise<string> => {
        touchTool('runCommand');
        const blocked = await checkGuard(guard, 'runCommand');
        if (blocked) return blocked;

        const bg = background ?? isLongRunningCommand(command);
        return runShellCommand(command, projectRoot, {
          background: bg,
          timeoutMs: bg ? 0 : (timeoutMs ?? shellSettings.defaultTimeoutMs),
          backgroundWaitMs: shellSettings.backgroundWaitMs,
        });
      },
    },
    createProject: {
      description: 'Scaffold a new project (next, vite, react, express, blank)',
      inputSchema: z.object({
        template: z.string(),
        projectName: z.string().default('my-app'),
        useTypeScript: z.boolean().default(true),
        useTailwind: z.boolean().default(false),
        useAppRouter: z.boolean().default(true),
        extraFlags: z.array(z.string()).optional().describe('Extra CLI flags like --turbopack'),
        reasoning: z.string(),
      }),
      execute: async ({
        template,
        projectName,
        useTypeScript,
        useTailwind,
        useAppRouter,
        extraFlags,
      }: {
        template: string;
        projectName: string;
        useTypeScript: boolean;
        useTailwind: boolean;
        useAppRouter: boolean;
        extraFlags?: string[];
      }): Promise<string> => {
        touchTool('runCommand');
        const blocked = await checkGuard(guard, 'runCommand');
        if (blocked) return blocked;

        const t = template.toLowerCase().replace(/\.js$/, '').replace(/\./g, '');
        const ts = useTypeScript ? '--typescript' : '';
        let cmd = '';

        if (t === 'next' || t === 'nextjs' || t === 'next app') {
          cmd = [
            'npx', '--yes', 'create-next-app@latest', projectName,
            '--use-npm',
            ts,
            useTailwind ? '--tailwind' : '',
            useAppRouter ? '--app' : '',
            '--no-src-dir',
            '--eslint',
            '--no-turbopack',
            ...(extraFlags ?? []),
          ].filter(Boolean).join(' ');
        } else if (t === 'vite' || t === 'vitejs') {
          cmd = `npm create vite@latest ${projectName} -- --template ${useTypeScript ? 'react-ts' : 'react'}`;
        } else if (t === 'react' || t === 'cra') {
          cmd = `npx --yes create-react-app ${projectName}${useTypeScript ? ' --template typescript' : ''}`;
        } else if (t === 'express') {
          cmd = `mkdir -p ${projectName} && cd ${projectName} && npm init -y && npm install express${useTypeScript ? ' typescript @types/node @types/express ts-node' : ''}`;
        } else if (t === 'blank') {
          cmd = `mkdir -p ${projectName} && cd ${projectName} && npm init -y`;
        } else {
          return `Unknown template "${template}". Common options: next, vite, react, express, blank`;
        }

        const result = await runShellCommand(cmd, projectRoot, {
          background: false,
          timeoutMs: shellSettings.installTimeoutMs,
          backgroundWaitMs: shellSettings.backgroundWaitMs,
        });

        const projectPath = path.join(projectRoot, projectName);
        if (!fs.existsSync(projectPath)) {
          return `Command: ${cmd}\n\n${result}\n\nProject "${projectName}" was not created.`;
        }

        let entries: string[] = [];
        try { entries = fs.readdirSync(projectPath); } catch { entries = []; }

        return `Command: ${cmd}\n\n${result}\n\nScaffolded ${projectName}/\nTop-level: ${entries.join(', ')}`;
      },
    },
    searchWeb: {
      description: 'Search the web for relevant results',
      inputSchema: z.object({
        query: z.string(),
        reasoning: z.string(),
      }),
      execute: async ({ query }: { query: string }): Promise<string> => {
        touchTool('searchWeb');
        const blocked = await checkGuard(guard, 'searchWeb');
        if (blocked) return blocked;
        try {
          const res = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, {
            headers: { 'user-agent': 'quak/1.0' },
          });
          const html = await res.text();
          const links = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
            .filter(([_, href]) => href && !href.startsWith('#') && !href.startsWith('/'))
            .slice(0, 5);
          if (links.length === 0) return `No results found for: ${query}`;
          return links
            .map(([_, href, text]) => `${text.replace(/<[^>]+>/g, '').trim()}\n${href}`)
            .join('\n\n');
        } catch (error) {
          return `Web search failed: ${error instanceof Error ? error.message : String(error)}`;
        }
      },
    },
    readLints: {
      description: 'Run TypeScript/ESLint on file or project',
      inputSchema: z.object({ path: z.string().optional(), reasoning: z.string() }),
      execute: async ({ path: filePath }: { path?: string }): Promise<string> => {
        touchTool('readLints');
        if (filePath) {
          const fullPath = resolveProjectPath(filePath);
          if (!fullPath) return `Error: Path escapes project: ${filePath}`;
          const blocked = await checkGuard(guard, 'readFile', normalizeRelativePath(projectDir, fullPath));
          if (blocked) return blocked;
        } else {
          const blocked = await checkGuard(guard, 'listFiles');
          if (blocked) return blocked;
        }
        return runReadLints(projectRoot, filePath);
      },
    },
    fetchUrl: {
      description: 'Fetch HTTP/HTTPS URL as text',
      inputSchema: z.object({ url: z.string(), reasoning: z.string() }),
      execute: async ({ url }: { url: string }): Promise<string> => {
        touchTool('fetchUrl');
        const blocked = await checkGuard(guard, 'fetchUrl');
        if (blocked) return blocked;
        return runFetchUrl(url);
      },
    },
    rememberFact: {
      description: 'Save fact to ~/.quak/memory/MEMORY.md',
      inputSchema: z.object({ fact: z.string(), reasoning: z.string() }),
      execute: async ({ fact }: { fact: string }): Promise<string> => {
        touchTool('rememberFact');
        const blocked = await checkGuard(guard, 'rememberFact');
        if (blocked) return blocked;
        storage.appendMemory(`- ${fact.trim()}`);
        return 'Saved to long-term memory.';
      },
    },
    executePlanStep: {
      description: 'Mark a plan step as in progress',
      inputSchema: z.object({ step: z.number(), reasoning: z.string() }),
      execute: async ({ step }: { step: number }): Promise<string> => {
        touchTool('createPlan');
        const blocked = await checkGuard(guard, 'createPlan');
        if (blocked) return blocked;
        return markPlanStep(sessionId, step);
      },
    },
    ...createGitTools(projectRoot, touchTool, gitGuard),
    restoreCheckpoint: {
      description: 'Restore the most recent checkpoint for a file edited this session',
      inputSchema: z.object({
        path: z.string().optional(),
        reasoning: z.string(),
      }),
      execute: async ({ path: filePath }: { path?: string }): Promise<string> => {
        touchTool('restoreCheckpoint');
        const blocked = await checkGuard(guard, 'restoreCheckpoint', filePath);
        if (blocked) return blocked;
        const restored = checkpoints.restoreLatest(sessionId, filePath);
        if (!restored) {
          return filePath ? `No checkpoint for ${filePath}` : 'No checkpoints for this session';
        }
        return `Restored ${restored.filePath} from checkpoint ${restored.id}`;
      },
    },
    parallelExecute: {
      description: 'Run multiple shell commands in parallel and return combined results',
      inputSchema: z.object({
        commands: z.array(z.string()),
        timeoutMs: z.number().optional(),
        reasoning: z.string(),
      }),
      execute: async ({ commands, timeoutMs }: { commands: string[]; timeoutMs?: number }): Promise<string> => {
        touchTool('runCommand');
        const results = await Promise.all(
          commands.map(async (cmd) => {
            const blocked = await checkGuard(guard, 'runCommand');
            if (blocked) return `[SKIPPED] ${cmd}: ${blocked}`;
            try {
              const output = await runShellCommand(cmd, projectRoot, {
                background: false,
                timeoutMs: timeoutMs ?? 60000,
                backgroundWaitMs: 5000,
              });
              return `$ ${cmd}\n${output}`;
            } catch (e) {
              return `$ ${cmd}\nError: ${e instanceof Error ? e.message : String(e)}`;
            }
          }),
        );
        return results.join('\n---\n');
      },
    },
    runLinter: {
      description: 'Run a specific linter/formatter on a file or directory (eslint, prettier, tsc, ruff, black)',
      inputSchema: z.object({
        tool: z.enum(['eslint', 'prettier', 'tsc', 'ruff', 'black']),
        target: z.string(),
        fix: z.boolean().optional(),
        reasoning: z.string(),
      }),
      execute: async ({ tool, target, fix }: { tool: string; target: string; fix?: boolean }): Promise<string> => {
        touchTool('readLints');
        const cmdMap: Record<string, string> = {
          eslint: `npx eslint '${target}'${fix ? ' --fix' : ''}`,
          prettier: `npx prettier --check '${target}'`,
          tsc: `npx tsc --noEmit`,
          ruff: `ruff check '${target}'${fix ? ' --fix' : ''}`,
          black: `black --check '${target}'`,
        };
        const cmd = cmdMap[tool];
        if (!cmd) return `Unknown tool: ${tool}`;
        return runShellCommand(cmd, projectRoot, {
          background: false,
          timeoutMs: 120000,
          backgroundWaitMs: 5000,
        });
      },
    },
    runTests: {
      description: 'Run test suite (vitest, jest, pytest, cargo test, go test)',
      inputSchema: z.object({
        framework: z.enum(['vitest', 'jest', 'pytest', 'cargo', 'go']).optional(),
        filter: z.string().optional(),
        watch: z.boolean().optional(),
        reasoning: z.string(),
      }),
      execute: async ({ framework, filter, watch }: { framework?: string; filter?: string; watch?: boolean }): Promise<string> => {
        touchTool('runCommand');
        const detect = framework ?? detectTestFramework(projectRoot);
        const cmd = buildTestCmd(detect, filter, watch);
        return runShellCommand(cmd, projectRoot, {
          background: watch ?? false,
          timeoutMs: watch ? 0 : 300000,
          backgroundWaitMs: 15000,
        });
      },
    },
    ...(await loadPluginTools(projectDir)),
  };
}

function detectTestFramework(root: string): string {
  if (fs.existsSync(path.join(root, 'vitest.config.ts')) || fs.existsSync(path.join(root, 'vitest.config.js'))) return 'vitest';
  if (fs.existsSync(path.join(root, 'jest.config.ts')) || fs.existsSync(path.join(root, 'jest.config.js'))) return 'jest';
  if (fs.existsSync(path.join(root, 'pytest.ini')) || fs.existsSync(path.join(root, 'pyproject.toml'))) return 'pytest';
  if (fs.existsSync(path.join(root, 'Cargo.toml'))) return 'cargo';
  if (fs.existsSync(path.join(root, 'go.mod'))) return 'go';
  return 'vitest';
}

function buildTestCmd(framework: string, filter?: string, watch?: boolean): string {
  const filterFlag = filter ? ` -- --grep "${filter}"` : '';
  const watchFlag = watch ? ' --watch' : '';
  switch (framework) {
    case 'vitest': return `npx vitest run${watchFlag}${filterFlag}`;
    case 'jest': return `npx jest${watchFlag}${filterFlag}`;
    case 'pytest': return `python -m pytest${watchFlag}${filter ? ` -k "${filter}"` : ''}`;
    case 'cargo': return `cargo test${filter ? ` ${filter}` : ''}`;
    case 'go': return `go test ./...${filter ? ` -run "${filter}"` : ''}`;
    default: return `npx vitest run${watchFlag}${filterFlag}`;
  }
}
