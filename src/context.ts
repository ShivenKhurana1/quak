import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { Storage } from './storage.js';

const MAX_SECTION_CHARS = 8000;

function truncate(text: string, max = MAX_SECTION_CHARS): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '\n\n...(truncated)';
}

export function loadProjectContext(projectDir: string, storage: Storage): string {
  const sections: string[] = [];
  const provider = storage.getActiveProvider();

  const quakMd = path.join(projectDir, 'QUAK.md');
  if (fs.existsSync(quakMd)) {
    sections.push(`## Project (QUAK.md)\n${truncate(fs.readFileSync(quakMd, 'utf-8'))}`);
  }

  const memory = storage.loadMemory().trim();
  if (memory) {
    sections.push(`## Long-term memory\n${truncate(memory)}`);
  }

  try {
    const branch = execSync('git branch --show-current', {
      cwd: projectDir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (branch) sections.push(`## Git branch\n${branch}`);

    const gitStatus = execSync('git status --short', {
      cwd: projectDir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (gitStatus) {
      sections.push(`## Git status\n\`\`\`\n${truncate(gitStatus, 2000)}\n\`\`\``);
    }
  } catch {
    // not a git repo
  }

  sections.push('## Environment');
  sections.push(`- cwd: ${projectDir}`);
  if (provider) {
    sections.push(`- provider: ${provider.name} (${provider.type})`);
    sections.push(`- model: ${provider.model}`);
  }
  sections.push(`- permission mode: ${storage.loadPermissions().mode}`);

  return sections.join('\n\n');
}
