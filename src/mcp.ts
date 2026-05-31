import fs from 'fs';
import path from 'path';
import os from 'os';

export interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
}

const MCP_FILE = path.join(os.homedir(), '.quak', 'mcp.json');

export function loadMcpConfig(): McpServerConfig[] {
  try {
    if (!fs.existsSync(MCP_FILE)) return [];
    const data = JSON.parse(fs.readFileSync(MCP_FILE, 'utf-8')) as {
      servers?: McpServerConfig[];
    };
    return data.servers ?? [];
  } catch {
    return [];
  }
}

export function loadMcpPrompt(): string {
  const servers = loadMcpConfig();
  if (servers.length === 0) return '';
  const lines = servers.map((s) => `- ${s.name}: ${s.command} ${(s.args ?? []).join(' ')}`);
  return `# MCP (configured, not yet connected)\n${lines.join('\n')}\nNote: MCP tools are not wired yet. Use built-in tools.`;
}
