import fs from 'fs';
import path from 'path';
import os from 'os';

const MAX_SKILLS_CHARS = 12_000;

function readSkillFile(filePath: string): string | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const name = path.basename(path.dirname(filePath));
    return `### Skill: ${name}\n${raw.trim()}`;
  } catch {
    return null;
  }
}

function collectFromDir(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillMd = path.join(dir, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillMd)) continue;
    const block = readSkillFile(skillMd);
    if (block) out.push(block);
  }
}

export function loadSkillsPrompt(): string {
  const blocks: string[] = [];
  collectFromDir(path.join(os.homedir(), '.quak', 'skills'), blocks);
  collectFromDir(path.join(os.homedir(), '.claude', 'skills'), blocks);
  if (blocks.length === 0) return '';
  let combined = blocks.join('\n\n');
  if (combined.length > MAX_SKILLS_CHARS) {
    combined = combined.slice(0, MAX_SKILLS_CHARS) + '\n\n...(skills truncated)';
  }
  return `# Available Skills\n\n${combined}`;
}