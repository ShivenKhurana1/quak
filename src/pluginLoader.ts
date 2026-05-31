import fs from 'fs';
import path from 'path';
import os from 'os';
import { z } from 'zod';

const PLUGINS_DIR = path.join(os.homedir(), '.quak', 'plugins');

interface PluginManifest {
  name: string;
  version: string;
  description: string;
  tools: string[];
  entry: string;
}

interface ToolDefinition {
  description: string;
  inputSchema: z.ZodType<any>;
  execute: (args: any) => Promise<string>;
}

export function ensurePluginsDir(): void {
  if (!fs.existsSync(PLUGINS_DIR)) fs.mkdirSync(PLUGINS_DIR, { recursive: true });
}

export function getPluginManifests(): PluginManifest[] {
  ensurePluginsDir();
  const entries = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true });
  const manifests: PluginManifest[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const manifestPath = path.join(PLUGINS_DIR, entry.name, 'plugin.json');
      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as PluginManifest;
          manifests.push(manifest);
        } catch {}
      }
    }
  }
  return manifests;
}

export async function loadPluginTools(projectDir: string): Promise<Record<string, ToolDefinition>> {
  ensurePluginsDir();
  const manifests = getPluginManifests();
  const tools: Record<string, ToolDefinition> = {};

  for (const manifest of manifests) {
    const entryPath = path.join(PLUGINS_DIR, manifest.name, manifest.entry);
    if (!fs.existsSync(entryPath)) continue;
    try {
      const mod = await import(entryPath);
      for (const toolName of manifest.tools) {
        if (mod[toolName]) {
          tools[`plugin_${manifest.name}_${toolName}`] = mod[toolName];
        }
      }
    } catch (e) {
      console.error(`Plugin "${manifest.name}" failed to load:`, e);
    }
  }
  return tools;
}

export function scaffoldPlugin(name: string): string {
  ensurePluginsDir();
  const pluginDir = path.join(PLUGINS_DIR, name);
  if (fs.existsSync(pluginDir)) return `Plugin "${name}" already exists`;
  fs.mkdirSync(pluginDir, { recursive: true });

  const manifest: PluginManifest = {
    name,
    version: '0.1.0',
    description: 'Custom Quak plugin',
    tools: ['myTool'],
    entry: 'index.ts',
  };
  fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify(manifest, null, 2));

  const toolCode = `import { z } from 'zod';\n\nexport const myTool = {\n  description: 'My custom tool',\n  inputSchema: z.object({ input: z.string(), reasoning: z.string() }),\n  execute: async ({ input }: { input: string }): Promise<string> => {\n    return \`Processed: \${input}\`;\n  },\n};\n`;
  fs.writeFileSync(path.join(pluginDir, 'index.ts'), toolCode);

  return `Plugin "${name}" scaffolded at ${pluginDir}`;
}