import type { PrunableMessage } from './tokens.js';

export function summarizeDroppedMessages<T extends PrunableMessage>(
  dropped: T[],
  maxChars = 2000,
): string {
  if (dropped.length === 0) return '';
  const lines: string[] = [`Summary of ${dropped.length} earlier turn(s):`];
  for (const msg of dropped.slice(-8)) {
    const role = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : 'System';
    const body = msg.content.replace(/\s+/g, ' ').trim().slice(0, 220);
    lines.push(`- ${role}: ${body}${msg.content.length > 220 ? '…' : ''}`);
  }
  let out = lines.join('\n');
  if (out.length > maxChars) out = out.slice(0, maxChars) + '\n…';
  return out;
}
