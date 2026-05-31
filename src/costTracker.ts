interface CostRow {
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  timestamp: number;
}

interface CostConfig {
  inputPerMillion: number;
  outputPerMillion: number;
}

const MODEL_COSTS: Record<string, CostConfig> = {
  'gpt-4o': { inputPerMillion: 2.50, outputPerMillion: 10.00 },
  'gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.60 },
  'gpt-4-turbo': { inputPerMillion: 10.00, outputPerMillion: 30.00 },
  'claude-3-5-sonnet-20241022': { inputPerMillion: 3.00, outputPerMillion: 15.00 },
  'claude-3-haiku-20240307': { inputPerMillion: 0.25, outputPerMillion: 1.25 },
  'claude-3-opus-20240229': { inputPerMillion: 15.00, outputPerMillion: 75.00 },
  'llama-3.1-8b': { inputPerMillion: 0.05, outputPerMillion: 0.25 },
  'llama-3.1-70b': { inputPerMillion: 0.59, outputPerMillion: 0.79 },
  'mixtral-8x7b': { inputPerMillion: 0.24, outputPerMillion: 0.24 },
  'gemma-2-9b': { inputPerMillion: 0.06, outputPerMillion: 0.06 },
};

const SESSION_LOG: CostRow[] = [];

function getConfig(model: string): CostConfig {
  for (const [key, cfg] of Object.entries(MODEL_COSTS)) {
    if (model.includes(key)) return cfg;
  }
  return { inputPerMillion: 0.50, outputPerMillion: 1.50 };
}

export function recordCost(
  model: string,
  provider: string,
  inputTokens: number,
  outputTokens: number,
): CostRow {
  const cfg = getConfig(model);
  const inputCost = (inputTokens / 1_000_000) * cfg.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * cfg.outputPerMillion;
  const row: CostRow = {
    model,
    provider,
    inputTokens,
    outputTokens,
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    timestamp: Date.now(),
  };
  SESSION_LOG.push(row);
  return row;
}

export function getSessionCost(): number {
  return SESSION_LOG.reduce((sum, r) => sum + r.totalCost, 0);
}

export function getSessionTokens(): { input: number; output: number } {
  return {
    input: SESSION_LOG.reduce((sum, r) => sum + r.inputTokens, 0),
    output: SESSION_LOG.reduce((sum, r) => sum + r.outputTokens, 0),
  };
}

export function formatSessionCost(): string {
  const cost = getSessionCost();
  const tokens = getSessionTokens();
  const calls = SESSION_LOG.length;
  return [
    `  Cost: $${cost.toFixed(4)}`,
    `  Input tokens: ${tokens.input.toLocaleString()}`,
    `  Output tokens: ${tokens.output.toLocaleString()}`,
    `  API calls: ${calls}`,
  ].join('\n');
}

export function resetSessionCost(): void {
  SESSION_LOG.length = 0;
}
