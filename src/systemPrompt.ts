import { Storage } from './storage.js';
import { loadProjectContext } from './context.js';
import { loadModePrompt, loadSystemPromptBase, loadWorkflowPrompt } from './prompts.js';
import { loadSkillsPrompt } from './skills.js';
import { loadMcpPrompt } from './mcp.js';

interface SystemPromptOptions {
  mode: 'agent' | 'chat' | 'plan' | 'dontAsk';
  storage: Storage;
  projectDir: string;
  memoryHints?: string[];
  recentChanges?: string[];
}

export async function buildSystemPrompt(options: SystemPromptOptions): Promise<string> {
  const { mode, storage, projectDir, memoryHints, recentChanges } = options;

  const sections: string[] = [];

  const base = loadSystemPromptBase();
  if (base) sections.push(base);

  const modePrompt = loadModePrompt(mode);
  if (modePrompt) sections.push(`# Mode\n${modePrompt}`);

  const workflow = loadWorkflowPrompt();
  if (workflow) sections.push(`# Workflow\n${workflow}`);

  const contextBlock = loadProjectContext(projectDir, storage);
  if (contextBlock) sections.push(`# Project Context\n${contextBlock}`);

  if (recentChanges && recentChanges.length > 0) {
    sections.push(`# Recent File Changes\n${recentChanges.join('\n')}`);
  }

  if (memoryHints && memoryHints.length > 0) {
    sections.push(`# Relevant Memory\n${memoryHints.map(m => `- ${m}`).join('\n')}`);
  }

  const skills = loadSkillsPrompt();
  if (skills) sections.push(skills);

  const mcp = loadMcpPrompt();
  if (mcp) sections.push(mcp);

  return sections.join('\n\n');
}
