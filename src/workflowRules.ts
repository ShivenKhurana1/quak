import { loadWorkflowPrompt } from './prompts.js';

/** @deprecated Use ~/.quak/prompts/workflow.md - kept for imports that expect formatRules() */
export function formatRules(): string {
  return loadWorkflowPrompt();
}
