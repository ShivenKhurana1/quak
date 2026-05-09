import { streamText } from 'ai';
import { z } from 'zod';
import { Storage } from './storage.js';
import { getLLM } from './providers.js';
import { addXP } from './xp.js';
import { earnBread } from './bread.js';
import { checkAchievements } from './achievements.js';
import { getDuckSystemPrompt } from './duck.js';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export function createTools(storage: Storage, projectDir: string) {
  return {
    readFile: {
      description: 'Read a file from the project',
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path: filePath }) => {
        onToolCall(storage);
        const fullPath = path.join(projectDir, filePath);
        if (!fs.existsSync(fullPath)) return `File not found: ${filePath}`;
        return fs.readFileSync(fullPath, 'utf-8');
      },
    },
    writeFile: {
      description: 'Write content to a file in the project',
      inputSchema: z.object({ path: z.string(), content: z.string() }),
      execute: async ({ path: filePath, content }) => {
        onToolCall(storage);
        const fullPath = path.join(projectDir, filePath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content);
        return `Wrote ${content.length} chars to ${filePath}`;
      },
    },
    listFiles: {
      description: 'List files in a directory',
      inputSchema: z.object({ path: z.string().default('.'), recursive: z.boolean().default(false) }),
      execute: async ({ path: dirPath, recursive }) => {
        onToolCall(storage);
        const fullPath = path.join(projectDir, dirPath);
        if (!fs.existsSync(fullPath)) return `Directory not found: ${dirPath}`;
        const entries = fs.readdirSync(fullPath, { withFileTypes: true, recursive });
        return entries.map(e => `${e.isDirectory() ? '📁' : '📄'} ${e.name}`).join('\n');
      },
    },
    runCommand: {
      description: 'Run a shell command',
      inputSchema: z.object({ command: z.string() }),
      execute: async ({ command }) => {
        onToolCall(storage);
        try {
          const result = execSync(command, { cwd: projectDir, encoding: 'utf-8', timeout: 30000 });
          return result || '(no output)';
        } catch (e: any) {
          return `Error: ${e.message}`;
        }
      },
    },
    searchWeb: {
      description: 'Search the web for information',
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        onToolCall(storage);
        return `Search results for "${query}" — (implement with your preferred search API)`;
      },
    },
  };
}

function onToolCall(storage: Storage) {
  const state = addXP(storage, 1, 'tool_call');
  earnBread(storage, 1);
  checkAchievements(storage, state);
}

export async function* runAgent(
  storage: Storage,
  messages: any[],
  projectDir: string,
  mode: 'agent' | 'chat' | 'plan' = 'agent'
) {
  const state = storage.loadState();
  const systemPrompt = getDuckSystemPrompt(state.level);
  const memory = storage.loadMemory();
  const fullSystem = `${systemPrompt}\n\nYou are Quak, a duck that lives in the terminal.\nProject directory: ${projectDir}\n\nUser memory:\n${memory}\n\nMode: ${mode}. ${mode === 'chat' ? 'Read-only. Do NOT modify files. Only answer questions.' : mode === 'plan' ? 'Plan mode. Outline what you would do but do NOT execute.' : 'Full agent mode. You can read, write, and run commands.'}`;

  const tools = mode === 'agent' ? createTools(storage, projectDir) : {};

  const model = getLLM(storage);

  const result = streamText({
    model,
    system: fullSystem,
    messages,
    tools,
    maxSteps: mode === 'agent' ? 10 : 0,
  });

  for await (const chunk of result.textStream) {
    yield chunk;
  }
}