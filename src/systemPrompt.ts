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

  if (mode === 'chat') {
    sections.push('# Guidelines\nYou are in chat mode. Answer questions conversationally. Do not call any tools unless explicitly asked.');
  } else if (mode === 'agent' || mode === 'dontAsk') {
    sections.push('# Guidelines\nYou are an AI coding assistant with access to tools. You should use tools as needed to satisfy the user\'s request, whether it is a question, a task, or a command.');
  } else if (mode === 'plan') {
    sections.push('# Guidelines\nYou are in planning mode. Use planning tools to create and manage plans. Do not execute arbitrary tools.');
  }

  return sections.join('\n\n');
}
