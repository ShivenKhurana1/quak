export type ToolErrorCode =
  | 'permission_denied'
  | 'not_found'
  | 'invalid_path'
  | 'workflow'
  | 'command_failed'
  | 'unknown';

export function formatToolError(
  code: ToolErrorCode,
  message: string,
  extra?: Record<string, string | number | undefined>,
): string {
  const lines = [`error_code: ${code}`, `message: ${message}`];
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined) lines.push(`${k}: ${v}`);
    }
  }
  return lines.join('\n');
}