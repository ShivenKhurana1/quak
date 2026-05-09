import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Storage } from './storage.js';

export interface PondHealthReport {
  score: number; // 0-100
  lintErrors: number;
  testFailures: number;
  todoCount: number;
  deadCode: number;
  commitRecency: number; // hours since last commit
  details: string[];
}

export function calculatePondHealth(projectDir: string): PondHealthReport {
  let score = 100;
  const details: string[] = [];
  let lintErrors = 0;
  let testFailures = 0;
  let todoCount = 0;
  let deadCode = 0;
  let commitRecency = 0;

  // Check lint errors
  try {
    const result = execSync('npx eslint . --format json 2>/dev/null || true', {
      cwd: projectDir,
      timeout: 30000,
      encoding: 'utf-8',
    });
    const parsed = JSON.parse(result);
    lintErrors = parsed.reduce((acc: number, f: any) => acc + (f.errorCount || 0), 0);
    if (lintErrors > 0) {
      score -= Math.min(30, lintErrors * 2);
      details.push(`${lintErrors} lint errors (-${Math.min(30, lintErrors * 2)})`);
    }
  } catch {
    details.push('No linter configured');
  }

  // Check TODOs
  try {
    const result = execSync('grep -r "TODO\\|FIXME\\|HACK" --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" . 2>/dev/null || true', {
      cwd: projectDir,
      encoding: 'utf-8',
    });
    todoCount = result.trim().split('\n').filter(Boolean).length;
    if (todoCount > 0) {
      score -= Math.min(15, todoCount);
      details.push(`${todoCount} TODOs/FIXMEs (-${Math.min(15, todoCount)})`);
    }
  } catch {}

  // Check git recency
  try {
    const lastCommit = execSync('git log -1 --format=%ct', {
      cwd: projectDir,
      encoding: 'utf-8',
    }).trim();
    commitRecency = (Date.now() / 1000 - parseInt(lastCommit)) / 3600;
    if (commitRecency > 48) {
      score -= Math.min(20, Math.floor(commitRecency / 24) * 5);
      details.push(`Last commit ${Math.floor(commitRecency / 24)}d ago (-${Math.min(20, Math.floor(commitRecency / 24) * 5)})`);
    }
  } catch {}

  // Check for dead code (simple heuristic: unused exports)
  try {
    const srcDir = path.join(projectDir, 'src');
    if (fs.existsSync(srcDir)) {
      const files = execSync('find src -name "*.ts" -o -name "*.tsx" 2>/dev/null || true', {
        cwd: projectDir,
        encoding: 'utf-8',
      }).trim().split('\n').filter(Boolean);
      // Simple check: count files with no imports from other files
      deadCode = 0; // Placeholder — real impl would use ts-morph
    }
  } catch {}

  // Check test failures
  try {
    execSync('npm test 2>/dev/null', { cwd: projectDir, timeout: 60000, encoding: 'utf-8' });
    details.push('All tests passing ✅');
  } catch (e: any) {
    testFailures = 1;
    score -= 10;
    details.push('Test failures (-10)');
  }

  score = Math.max(0, Math.min(100, score));

  return { score, lintErrors, testFailures, todoCount, deadCode, commitRecency, details };
}

export function getPondLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Crystal Clear 🌊', color: 'cyan' };
  if (score >= 60) return { label: 'A Bit Murky 🌫️', color: 'yellow' };
  if (score >= 40) return { label: 'Swampy 🐸', color: 'red' };
  if (score >= 20) return { label: 'Toxic 💀', color: 'magenta' };
  return { label: 'Dead Pond 🪦', color: 'gray' };
}