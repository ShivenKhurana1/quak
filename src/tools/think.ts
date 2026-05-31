import { z } from 'zod';

export const thinkTool = {
  description: 'Pause and think through the problem step-by-step before taking action',
  inputSchema: z.object({
    analysis: z.string().describe('What you understand about the situation'),
    keyDecisions: z.array(z.string()).describe('Key decisions needed (max 3)'),
    plan: z.array(z.string()).describe('Your planned next steps'),
    risks: z.array(z.string()).optional().describe('Potential issues or blockers'),
  }),
  execute: async ({
    analysis,
    keyDecisions,
    plan,
    risks,
  }: {
    analysis: string;
    keyDecisions: string[];
    plan: string[];
    risks?: string[];
  }) => {
    const riskText = risks?.length ? `\nRisks: ${risks.join(', ')}` : '';
    return `Quak thinks:\n${analysis}\n\nKey decisions: ${keyDecisions.join(' -> ')}\nPlan: ${plan.join(' -> ')}${riskText}`;
  },
};