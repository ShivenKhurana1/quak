import fs from 'fs';
import path from 'path';
import os from 'os';

const CWD_FILE = path.join(os.homedir(), '.quak', 'cwd.json');

let cachedCwd: string | null = null;

function readSaved(): string | null {
  try {
    if (!fs.existsSync(CWD_FILE)) return null;
    const data = JSON.parse(fs.readFileSync(CWD_FILE, 'utf-8')) as { cwd?: string };
    if (data.cwd && fs.existsSync(data.cwd)) return path.resolve(data.cwd);
  } catch {
    // ignore
  }
  return null;
}

export function getProjectDir(): string {
  if (cachedCwd) return cachedCwd;
  cachedCwd = readSaved() ?? process.cwd();
  return cachedCwd;
}

export function setProjectDir(next: string): { ok: boolean; message: string } {
  const resolved = path.resolve(next.replace(/^~/, os.homedir()));
  if (!fs.existsSync(resolved)) {
    return { ok: false, message: `Directory does not exist: ${resolved}` };
  }
  if (!fs.statSync(resolved).isDirectory()) {
    return { ok: false, message: `Not a directory: ${resolved}` };
  }
  cachedCwd = resolved;
  fs.mkdirSync(path.dirname(CWD_FILE), { recursive: true });
  fs.writeFileSync(CWD_FILE, JSON.stringify({ cwd: resolved }, null, 2));
  return { ok: true, message: `Working directory: ${resolved}` };
}