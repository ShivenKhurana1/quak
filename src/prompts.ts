import fs from 'fs';
import path from 'path';
import os from 'os';

const PROMPTS_DIR = path.join(os.homedir(), '.quak', 'prompts');

function readIfExists(filename: string): string {
  const file = path.join(PROMPTS_DIR, filename);
  if (!fs.existsSync(file)) return '';
  return fs.readFileSync(file, 'utf-8').trim();
}

/** Optional base identity / instructions: ~/.quak/prompts/system.md */
export function loadSystemPromptBase(): string {
  return readIfExists('system.md');
}

/** Mode-specific instructions: ~/.quak/prompts/agent.md | chat.md | plan.md */
export function loadModePrompt(mode: string): string {
  return readIfExists(`${mode}.md`) || readIfExists('default.md');
}

/** Workflow bullets (plain text or markdown list): ~/.quak/prompts/workflow.md */
export function loadWorkflowPrompt(): string {
  return readIfExists('workflow.md');
}

export function getPromptsDir(): string {
  return PROMPTS_DIR;
}
