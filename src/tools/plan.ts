import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import os from 'os';

const PLANS_DIR = path.join(os.homedir(), '.quak', 'plans');

export function getPlanPath(sessionId: string): string {
  return path.join(PLANS_DIR, `${sessionId}.md`);
}

export function getPlanContent(sessionId: string): string | null {
  const planPath = getPlanPath(sessionId);
  if (!fs.existsSync(planPath)) return null;
  return fs.readFileSync(planPath, 'utf-8');
}

export function markPlanStep(sessionId: string, stepNumber: number): string {
  const content = getPlanContent(sessionId);
  if (!content) return 'No plan file for this session.';
  const lines = content.split('\n');
  let n = 0;
  const updated = lines.map((line) => {
    const m = line.match(/^(\d+)\.\s+(.*)$/);
    if (!m) return line;
    n += 1;
    if (n === stepNumber) return `${m[1]}. [IN PROGRESS] ${m[2]}`;
    return line;
  });
  const body = updated.join('\n');
  fs.writeFileSync(getPlanPath(sessionId), body, 'utf-8');
  return `Marked step ${stepNumber} in plan. Switch to Agent mode to execute it.`;
}

export function createPlanTool(sessionId: string) {
  return {
    description: 'Write a structured implementation plan (Plan mode)',
    inputSchema: z.object({
      title: z.string(),
      summary: z.string(),
      steps: z.array(z.string()),
      risks: z.array(z.string()).optional(),
      files: z.array(z.string()).optional(),
      reasoning: z.string(),
    }),
    execute: async ({
      title,
      summary,
      steps,
      risks,
      files,
    }: {
      title: string;
      summary: string;
      steps: string[];
      risks?: string[];
      files?: string[];
    }): Promise<string> => {
      if (!fs.existsSync(PLANS_DIR)) fs.mkdirSync(PLANS_DIR, { recursive: true });

      const body = [
        `# ${title}`,
        '',
        summary,
        '',
        '## Steps',
        ...steps.map((s, i) => `${i + 1}. ${s}`),
        ...(risks?.length ? ['', '## Risks', ...risks.map((r) => `- ${r}`)] : []),
        ...(files?.length ? ['', '## Files', ...files.map((f) => `- ${f}`)] : []),
      ].join('\n');

      const planPath = getPlanPath(sessionId);
      fs.writeFileSync(planPath, body, 'utf-8');
      return `Plan saved to ${planPath}\n\n${body}`;
    },
  };
}
