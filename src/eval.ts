import fs from 'fs';
import path from 'path';
import os from 'os';

const EVAL_DIR = path.join(os.homedir(), '.quak', 'evals');

interface TestCase {
  id: string;
  name: string;
  prompt: string;
  expectedOutput?: string;
  expectedPattern?: string;
  expectedToolCalls?: string[];
  maxSteps?: number;
  tags: string[];
}

interface EvalResult {
  id: string;
  timestamp: number;
  model: string;
  actualOutput: string;
  toolCalls: string[];
  passed: boolean;
  score: number;
  reason: string;
  stepCount: number;
  latency: number;
  cost: number;
}

interface EvalRun {
  testId: string;
  results: EvalResult[];
  createdAt: number;
}

function ensureDir(): void {
  if (!fs.existsSync(EVAL_DIR)) fs.mkdirSync(EVAL_DIR, { recursive: true });
}

export function loadEvalCases(): TestCase[] {
  ensureDir();
  const defaultCases: TestCase[] = [
    { id: 'eval-001', name: 'File read', prompt: 'Read the file src/index.ts and tell me what it does', tags: ['basic'], maxSteps: 5 },
    { id: 'eval-002', name: 'Simple edit', prompt: 'Change "hello" to "goodbye" in src/greeting.ts', tags: ['basic', 'edit'], maxSteps: 10 },
    { id: 'eval-003', name: 'Web search', prompt: 'Search the web for the latest version of React', tags: ['web'], maxSteps: 5 },
  ];
  const casesPath = path.join(EVAL_DIR, 'cases.json');
  if (!fs.existsSync(casesPath)) {
    fs.writeFileSync(casesPath, JSON.stringify(defaultCases, null, 2));
    return defaultCases;
  }
  try {
    return JSON.parse(fs.readFileSync(casesPath, 'utf-8'));
  } catch {
    return defaultCases;
  }
}

export function saveEvalResult(result: EvalResult): void {
  ensureDir();
  const file = path.join(EVAL_DIR, `${result.id}.json`);
  const existing: EvalRun[] = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf-8'))
    : [];
  existing.push({ testId: result.id, results: [result], createdAt: Date.now() });
  fs.writeFileSync(file, JSON.stringify(existing.slice(-100), null, 2));
}

export function getEvalHistory(testId: string): EvalResult[] {
  const file = path.join(EVAL_DIR, `${testId}.json`);
  if (!fs.existsSync(file)) return [];
  try {
    const runs: EvalRun[] = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return runs.flatMap(r => r.results);
  } catch {
    return [];
  }
}

export function getEvalSummary(): string {
  const cases = loadEvalCases();
  const lines = cases.map(c => {
    const history = getEvalHistory(c.id);
    const lastRun = history[history.length - 1];
    const status = lastRun ? (lastRun.passed ? 'PASS' : 'FAIL') : 'UNTESTED';
    const score = lastRun ? `${(lastRun.score * 100).toFixed(0)}%` : '-';
    return `  ${c.id.padEnd(10)} ${status.padEnd(8)} ${score.padEnd(6)} ${c.name}`;
  });
  return `Eval Summary:\n${lines.join('\n')}`;
}

export function formatEvalHelp(): string {
  return 'Usage:\n  /eval           — run all cases\n  /eval list      — list cases\n  /eval run <id>  — run specific case\n  /eval history   — show last results';
}