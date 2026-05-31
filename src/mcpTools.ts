import { spawn } from 'child_process';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import os from 'os';

const MCP_CONFIG = path.join(os.homedir(), '.quak', 'mcp.json');

interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface McpToolDef {
  name: string;
  description: string;
  inputSchema: z.ZodType<any>;
  execute: (args: any) => Promise<string>;
}

export async function loadMcpTools(): Promise<McpToolDef[]> {
  if (!fs.existsSync(MCP_CONFIG)) return [];
  const config: Record<string, McpServerConfig> = JSON.parse(fs.readFileSync(MCP_CONFIG, 'utf-8'));
  const tools: McpToolDef[] = [];

  for (const [serverName, serverConfig] of Object.entries(config)) {
    try {
      const toolDefs = await negotiateTools(serverName, serverConfig);
      tools.push(...toolDefs);
    } catch (e) {
      console.error(`MCP server "${serverName}" failed:`, e);
    }
  }
  return tools;
}

async function negotiateTools(name: string, config: McpServerConfig): Promise<McpToolDef[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(config.command, config.args ?? [], {
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let buffer = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('MCP handshake timed out'));
    }, 10000);

    child.stdout?.on('data', (data) => {
      buffer += data.toString();
      try {
        const msg = JSON.parse(buffer);
        if (msg.type === 'tools/list') {
          child.stdin?.write(JSON.stringify({
            type: 'tools/list/result',
            tools: msg.tools.map((t: any) => ({
              name: `${name}_${t.name}`,
              description: t.description ?? '',
              inputSchema: z.object(
                Object.fromEntries(
                  (t.inputSchema?.properties ? Object.entries(t.inputSchema.properties) : []).map(
                    ([k, v]) => [k, z.any()]
                  )
                )
              ),
              execute: async (args: any) => {
                return new Promise((res) => {
                  child.stdin?.write(JSON.stringify({
                    type: 'tool/call',
                    name: t.name,
                    arguments: args,
                  }) + '\n');
                  child.stdout?.once('data', (d) => {
                    const r = JSON.parse(d.toString());
                    res(r.result ?? String(r.error ?? 'no result'));
                  });
                });
              },
            })),
          }) + '\n');
          clearTimeout(timeout);
        }
      } catch {}
    });

    child.stdin?.write(JSON.stringify({ type: 'tools/list' }) + '\n');
  });
}