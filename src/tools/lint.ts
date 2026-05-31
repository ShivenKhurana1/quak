import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function hasFile(root: string, name: string): boolean {
  return fs.existsSync(path.join(root, name));
}

export function runReadLints(projectRoot: string, filePath?: string): string {
  const target = filePath ? path.resolve(projectRoot, filePath) : projectRoot;
  const lines: string[] = [];

  if (hasFile(projectRoot, 'tsconfig.json')) {
    try {
      const args = filePath
        ? ['--noEmit', '--pretty', 'false', target]
        : ['--noEmit', '--pretty', 'false'];
      const out = execSync(`npx tsc ${args.join(' ')}`, {
        cwd: projectRoot,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 60_000,
      }).trim();
      lines.push(out ? `TypeScript:\n${out.slice(0, 6000)}` : 'TypeScript: no errors');
    } catch (e: unknown) {
      const err = e as { stdout?: string; stderr?: string };
      lines.push(`TypeScript:\n${(err.stdout || err.stderr || '').trim().slice(0, 6000) || 'check failed'}`);
    }
  }

  const eslintConfigs = ['eslint.config.mjs', 'eslint.config.js', '.eslintrc.json', '.eslintrc.js'];
  if (eslintConfigs.some((f) => hasFile(projectRoot, f))) {
    try {
      const fileArg = filePath ? ` "${target}"` : ' .';
      const out = execSync(`npx eslint${fileArg} --max-warnings 0`, {
        cwd: projectRoot,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 60_000,
      }).trim();
      lines.push(out ? `ESLint:\n${out.slice(0, 4000)}` : 'ESLint: no issues');
    } catch (e: unknown) {
      const err = e as { stdout?: string; stderr?: string };
      lines.push(`ESLint:\n${(err.stdout || err.stderr || '').trim().slice(0, 4000) || 'lint failed'}`);
    }
  }

  return lines.length > 0 ? lines.join('\n\n') : 'No TypeScript or ESLint config found.';
}