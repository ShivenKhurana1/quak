import { runAgent } from './agent.js';
import { Storage } from './storage.js';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

type AgentExpertise = 'bug-fix' | 'refactor' | 'test' | 'plan';

interface SubAgentTask {
  expertise: AgentExpertise;
  task: string;
  context?: string;
  parentTranscriptTail?: string;
}

const EXPERTISE_PROMPTS: Record<AgentExpertise, string> = {
  'bug-fix': 'You specialize in identifying and fixing bugs. No sub-agents. No createProject.',
  refactor: 'You specialize in clean structure and maintainability. No sub-agents.',
  test: 'You specialize in tests, edge cases, and coverage. No sub-agents.',
  plan: 'You specialize in ordered steps. No sub-agents.',
};

export async function* spawnSubAgent(
  storage: Storage,
  projectDir: string,
  task: SubAgentTask,
  parentSessionId: string,
): AsyncGenerator<string> {
  const settings = storage.loadAgentSettings();

  const messages: Message[] = [
    {
      role: 'user',
      content: `[Sub-agent: ${task.expertise}]
${EXPERTISE_PROMPTS[task.expertise]}

Task: ${task.task}
${task.context ? `\nContext:\n${task.context}` : ''}
${task.parentTranscriptTail ? `\nRecent conversation:\n${task.parentTranscriptTail}` : ''}

Complete this task only. Short summary when done.`,
    },
  ];

  for await (const chunk of runAgent({
    storage,
    projectDir,
    messages,
    mode: 'agent',
    sessionId: `${parentSessionId}-sub-${task.expertise}-${Date.now()}`,
    allowSubAgents: false,
    maxStepsOverride: settings.subAgentMaxSteps,
  })) {
    yield chunk;
  }
}
