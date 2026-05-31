export class AgentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly suggestions: string[],
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

export function getErrorGuidance(error: Error): string {
  const guidance: Record<string, string> = {
    'TIMEOUT': 'The operation timed out. Try breaking the task into smaller steps or increasing the timeout.',
    'PERMISSION_DENIED': 'Permission denied. Check your file permissions or adjust the permission settings.',
    'FILE_NOT_FOUND': 'File not found. Verify the file path is correct.',
    'COMMAND_FAILED': 'Command failed. Check the command syntax and ensure all dependencies are installed.',
    'NETWORK_ERROR': 'Network error. Check your internet connection and try again.',
    'API_ERROR': 'API error. Check your API key and rate limits.',
  };

  if (error instanceof AgentError) {
    const suggestion = guidance[error.code] || '';
    return `${error.message}\n\nSuggestions:\n${error.suggestions.map(s => `- ${s}`).join('\n')}\n${suggestion ? `\n${suggestion}` : ''}`;
  }

  return error.message;
}