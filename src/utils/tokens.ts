export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface PrunableMessage {
  role: string;
  content: string;
}

export function pruneByTokenBudget<T extends PrunableMessage>(
  messages: T[],
  maxTokens: number,
  minMessages = 4,
): T[] {
  if (messages.length <= minMessages) return messages;

  const kept: T[] = [];
  let total = 0;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const cost = estimateTokens(messages[i].content) + 4;
    if (kept.length >= minMessages || total + cost <= maxTokens) {
      kept.unshift(messages[i]);
      total += cost;
    } else {
      break;
    }
  }

  return kept.length > 0 ? kept : messages.slice(-minMessages);
}