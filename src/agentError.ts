export class AgentError extends Error {
  constructor(
    message: string,
    public readonly category: 'provider' | 'permission' | 'tool' | 'timeout' | 'system' | 'budget',
    public readonly recoverable: boolean,
    public readonly retryAction?: () => Promise<string>,
    public readonly suggestion?: string,
  ) {
    super(message);
    this.name = 'AgentError';
  }

  static provider(message: string, retry?: () => Promise<string>): AgentError {
    return new AgentError(message, 'provider', true, retry, 'Try switching providers with /provider use <name>');
  }

  static permission(message: string): AgentError {
    return new AgentError(message, 'permission', false, undefined, 'Use /permissions to adjust mode');
  }

  static tool(message: string, recoverable = true): AgentError {
    return new AgentError(message, 'tool', recoverable, undefined, 'Try a different approach or check the file path');
  }

  static timeout(message = 'Agent timed out'): AgentError {
    return new AgentError(message, 'timeout', true, undefined, 'Run again with a higher maxSteps setting');
  }

  static budget(message: string): AgentError {
    return new AgentError(message, 'budget', true, undefined, 'Increase the cost budget in settings');
  }
}

export function classifyError(error: unknown): AgentError {
  if (error instanceof AgentError) return error;
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.toLowerCase().includes('permission')) return AgentError.permission(msg);
  if (msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('timed out')) return AgentError.timeout(msg);
  if (msg.toLowerCase().includes('api key') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('rate limit')) {
    return AgentError.provider(msg);
  }
  if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('enoent')) return AgentError.tool(msg);
  if (msg.toLowerCase().includes('budget') || msg.toLowerCase().includes('cost')) return AgentError.budget(msg);
  return new AgentError(msg, 'system', false, undefined, 'Try again or report this issue');
}