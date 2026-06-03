import { streamText, stepCountIs, type ToolSet, type LanguageModelUsage } from 'ai';
import { z } from 'zod';
import { Storage } from './storage.js';
import { getLLM } from './providers.js';
import { buildSystemPrompt } from './systemPrompt.js';
import { thinkTool } from './tools/think.js';
import { createTools } from './tools/index.ts';
import { createPlanTool } from './tools/plan.js';
import { spawnSubAgent } from './subagent.js';
import { ToolWorkflow } from './tools/workflow.js';
import { screenshotTool } from './tools/screenshot.js';
import { loadMcpTools } from './mcpTools.js';
import {
  clearToolActivity,
  finishToolActivity,
  pushSubAgentChunk,
  startToolActivity,
} from './agentEvents.js';
import { recordCost, formatSessionCost, resetSessionCost } from './costTracker.js';
import { searchMemory, addToMemory, loadIndex } from './vectorMemory.js';
import { fileWatcher } from './watcher.js';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AgentOptions {
  storage: Storage;
  projectDir: string;
  messages: Message[];
  mode: 'agent' | 'chat' | 'plan' | 'dontAsk';
  sessionId: string;
  abortSignal?: AbortSignal;
  allowSubAgents?: boolean;
  maxStepsOverride?: number;
}

const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

const CHAT_TOOLS = new Set([
  'ThinkTool', 'readFile', 'listFiles', 'glob', 'grep', 'searchFiles', 'fetchUrl', 'readLints',
]);

const PLAN_TOOLS = new Set([
  'ThinkTool', 'readFile', 'listFiles', 'glob', 'grep', 'searchFiles', 'createPlan', 'fetchUrl', 'executePlanStep',
]);

function toolTarget(input: Record<string, unknown>): string | undefined {
  const v = input.path ?? input.command ?? input.url ?? input.from ?? input.query;
  return typeof v === 'string' ? v : undefined;
}

function filterTools(
  tools: Record<string, unknown>,
  mode: AgentOptions['mode'],
  allowSubAgents: boolean,
): Record<string, unknown> {
  const allowed = mode === 'chat' ? CHAT_TOOLS : mode === 'plan' ? PLAN_TOOLS : null;
  const out: Record<string, unknown> = {};
  for (const [name, tool] of Object.entries(tools)) {
    if (name === 'SubAgentTool' && !allowSubAgents) continue;
    if (allowed && !allowed.has(name)) continue;
    out[name] = tool;
  }
  return out;
}

export async function* runAgent(options: AgentOptions): AsyncGenerator<string> {
  const {
    storage,
    projectDir,
    messages,
    mode,
    sessionId,
    abortSignal,
    allowSubAgents = true,
    maxStepsOverride,
  } = options;

  const llm = getLLM(storage);
  const agentSettings = storage.loadAgentSettings();
  const maxSteps = maxStepsOverride ?? agentSettings.maxSteps;
  const workflow = new ToolWorkflow();

  clearToolActivity();
  resetSessionCost();
  loadIndex();

  const promptId = `agent-${Date.now()}`;
  const baseTools = await createTools(storage, projectDir, storage.loadPermissions(), sessionId, 'main', workflow);
  const mcpTools = await loadMcpTools();
  const allTools: Record<string, unknown> = {
    ThinkTool: thinkTool,
    ...baseTools,
    createPlan: createPlanTool(sessionId),
    screenshot: screenshotTool,
  };
  for (const t of mcpTools) {
    allTools[t.name] = { description: t.description, inputSchema: t.inputSchema, execute: t.execute };
  }
  if (allowSubAgents && (mode === 'agent' || mode === 'dontAsk')) {
    allTools.SubAgentTool = {
      description: 'Delegate a focused task to a specialized sub-agent',
      inputSchema: z.object({
        expertise: z.enum(['bug-fix', 'refactor', 'test', 'plan']),
        task: z.string(),
        context: z.string().optional(),
      }),
      execute: async ({ expertise, task, context }: { expertise: string; task: string; context?: string }) => {
        const tail = messages
          .slice(-4)
          .map((m) => `${m.role}: ${m.content.slice(0, 300)}`)
          .join('\n');
        let result = '';
        for await (const chunk of spawnSubAgent(
          storage,
          projectDir,
          {
            expertise: expertise as 'bug-fix' | 'refactor' | 'test' | 'plan',
            task,
            context,
            parentTranscriptTail: tail,
          },
          sessionId,
        )) {
          pushSubAgentChunk(expertise, chunk);
          result += chunk;
        }
        return `Sub-agent (${expertise}) completed:\n${result}`;
      },
    };
  }

  const toolsForCall = filterTools(allTools, mode, allowSubAgents);
  const recentChanges = fileWatcher.getRecentChanges(30000);
  const memoryHints = searchMemory(messages.map(m => m.content).join(' '), 3);
  const systemPrompt = await buildSystemPrompt({
    mode, storage, projectDir,
    memoryHints,
    recentChanges: recentChanges.map(c => `[${c.type}] ${c.path}`),
  });

  const prepareMessages = () =>
    messages.map((m) => {
      if (m.role !== 'user') return { role: m.role as 'user' | 'assistant' | 'system', content: m.content };
      if (m.content.startsWith('data:image')) {
        return { role: 'user' as const, content: [{ type: 'image' as const, image: m.content }] };
      }
      return { role: 'user' as const, content: m.content };
    });

  const streamWithTools = async (tools: Record<string, unknown> | undefined, promptOverride?: string) => {
    return streamText({
      model: llm,
      system: promptOverride ?? systemPrompt,
      messages: prepareMessages(),
      tools: (tools ? tools : undefined) as ToolSet | undefined,
      stopWhen: stepCountIs(maxSteps),
      maxRetries: 2,
      abortSignal,
    });
  };

  let toolStepCount = 0;
  const stepNotes: string[] = [];
  let finishUsage: LanguageModelUsage | null = null;
  let retriedWithoutTools = false;

  const iterateStream = async function* (response: any): AsyncGenerator<string> {
    for await (const event of response.fullStream) {
      if (event.type === 'text-delta') {
        yield event.text;
      } else if (event.type === 'tool-call') {
        toolStepCount++;
        const input =
          'input' in event && event.input && typeof event.input === 'object'
            ? (event.input as Record<string, unknown>)
            : {};
        startToolActivity(event.toolName, toolTarget(input));
        yield `\n${CYAN}[tool] ${event.toolName}${RESET}\n`;
      } else if (event.type === 'tool-result') {
        const resultText = typeof event.output === 'string' ? event.output : String(event.output);
        stepNotes.push(`${event.toolName}: ${resultText.slice(0, 120)}`);
        finishToolActivity(event.toolName, { preview: resultText, ok: !resultText.startsWith('Error:') });
        const preview = resultText.length > 200 ? resultText.slice(0, 200) + '...' : resultText;
        yield `${CYAN}${preview}${RESET}\n`;
      } else if (event.type === 'error') {
        const errMsg = event.error instanceof Error ? event.error.message : typeof event.error === 'string' ? event.error : JSON.stringify(event.error);
        if (!retriedWithoutTools && errMsg.includes('Failed to call a function')) {
          yield `${CYAN}Retrying without tools...${RESET}\n`;
          retriedWithoutTools = true;
          const retryResponse = await streamWithTools(undefined, 'You are Quak, a friendly terminal assistant. Respond conversationally and naturally. Do not mention or suggest creating projects unless the user explicitly asks.');
          yield* iterateStream(retryResponse);
          return;
        }
        throw new Error(`Model error: ${errMsg}`);
      } else if (event.type === 'finish') {
        finishUsage = event.totalUsage ?? null;
        if (toolStepCount >= maxSteps) {
          const progress = stepNotes.slice(-10).join('\n');
          yield `\n${CYAN}Reached ${maxSteps} tool steps.\nProgress:\n${progress}\nSend "continue" to resume.${RESET}\n`;
        }
      }
    }
  };

  const response = await streamWithTools(toolsForCall);
  yield* iterateStream(response);

  const usage = finishUsage!;
  if (usage) {
    const provider = storage.getActiveProvider();
    recordCost(
      provider?.model ?? 'unknown',
      provider?.type ?? 'unknown',
      usage.inputTokens ?? 0,
      usage.outputTokens ?? 0,
    );
    const tokens = usage.inputTokens ?? 0;
    addToMemory(
      messages.slice(-1)[0]?.content ?? '',
      `conversation (${tokens} prompt tokens)`,
    );
  }
}
