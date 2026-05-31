import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';

function hasRipgrep(): boolean {
  const r = spawnSync('rg', ['--version'], { encoding: 'utf-8' });
  return r.status === 0;
}

export interface GrepOptions {
  pattern: string;
  cwd: string;
  glob?: string;
  ignoreGlobs?: string[];
  maxResults?: number;
  outputMode: 'files_with_matches' | 'content' | 'count';
  caseInsensitive?: boolean;
  contextLines?: number;
}

export function runGrep(options: GrepOptions): string {
  const {
    pattern,
    cwd,
    glob: globPattern,
    ignoreGlobs = [],
    maxResults = 100,
    outputMode,
    caseInsensitive = false,
    contextLines = 0,
  } = options;

  if (hasRipgrep()) {
    const args = ['--regexp', pattern, '--max-count', String(maxResults)];
    if (caseInsensitive) args.push('--ignore-case');
    if (outputMode === 'files_with_matches') args.push('--files-with-matches');
    if (outputMode === 'count') args.push('--count-matches');
    if (contextLines > 0) args.push('-C', String(contextLines));
    if (globPattern) args.push('--glob', globPattern);
    for (const ig of ignoreGlobs) {
      args.push('--glob', `!${ig}`);
    }
    args.push('.');

    try {
      const out = execFileSync('rg', args, { cwd, encoding: 'utf-8', maxBuffer: 4 * 1024 * 1024 });
      return out.trim() || `No matches found for: "${pattern}"`;
    } catch (e: unknown) {
      const err = e as { status?: number; stdout?: string; stderr?: string };
      if (err.status === 1) return `No matches found for: "${pattern}"`;
      return `grep failed: ${err.stderr ?? String(e)}`;
    }
  }

  // JS fallback
  const regex = new RegExp(pattern, caseInsensitive ? 'gi' : 'g');
  const ignored = ignoreGlobs.flatMap((dir) => [`**/${dir}`, `**/${dir}/**`]);
  const files = globPattern
    ? globSync(globPattern, { cwd, dot: true, nodir: true, ignore: ignored })
    : globSync('**/*', { cwd, dot: true, nodir: true, ignore: ignored });

  const rows: string[] = [];
  const counts = new Map<string, number>();

  for (const relPath of files.slice(0, maxResults * 10)) {
    const absPath = path.join(cwd, relPath);
    let content = '';
    try {
      content = fs.readFileSync(absPath, 'utf-8');
    } catch {
      continue;
    }
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      regex.lastIndex = 0;
      if (regex.test(lines[i])) {
        counts.set(relPath, (counts.get(relPath) ?? 0) + 1);
        if (outputMode === 'content') rows.push(`${relPath}:${i + 1}: ${lines[i]}`);
        if (rows.length >= maxResults) break;
      }
    }
    if (rows.length >= maxResults) break;
  }

  if (outputMode === 'count') {
    return String([...counts.values()].reduce((s, n) => s + n, 0));
  }
  if (outputMode === 'files_with_matches') {
    return counts.size > 0
      ? `Found ${counts.size} files:\n${[...counts.keys()].join('\n')}`
      : `No matches found for: "${pattern}"`;
  }
  return rows.length > 0 ? rows.join('\n') : `No matches found for: "${pattern}"`;
}