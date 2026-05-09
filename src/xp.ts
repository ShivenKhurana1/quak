import { Storage, QuakState } from './storage.js';

export function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += xpForLevel(i);
  }
  return total;
}

export function getLevelFromXp(xp: number): number {
  let level = 1;
  let remaining = xp;
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level++;
  }
  return level;
}

export function getXpProgress(state: QuakState): { current: number; needed: number; percent: number } {
  const totalForCurrentLevel = xpForLevel(state.level);
  let xpInCurrentLevel = state.xp - totalXpForLevel(state.level);
  if (xpInCurrentLevel < 0) xpInCurrentLevel = state.xp;
  const percent = Math.min(100, Math.floor((xpInCurrentLevel / totalForCurrentLevel) * 100));
  return { current: xpInCurrentLevel, needed: totalForCurrentLevel, percent };
}

export function addXP(storage: Storage, amount: number, reason: string): QuakState {
  const state = storage.loadState();
  const oldLevel = state.level;
  state.xp += amount;
  state.level = getLevelFromXp(state.xp);
  state.lastActive = Date.now();
  state.totalToolCalls += 1;

  state.bread += Math.max(1, Math.floor(amount / 2));

  storage.saveState(state);

  if (state.level > oldLevel) {
    state.bread += state.level * 2;
    storage.saveState(state);
  }

  return state;
}

export function getUnlocksForLevel(level: number): string[] {
  const unlocks: string[] = [];
  if (level >= 3) unlocks.push('/quack — Quak quacks at your code');
  if (level >= 4) unlocks.push('/genz — you don\'t want to know');
  if (level >= 5) unlocks.push('/vibe — vibe check on your project');
  if (level >= 6) unlocks.push('/swim — rubber duck debug mode');
  if (level >= 7) unlocks.push('/pond — detailed pond health breakdown');
  if (level >= 8) unlocks.push('/migrate — project switching and map');
  if (level >= 10) unlocks.push('/crimes — Quak files a rap sheet on your code');
  if (level >= 10) unlocks.push('/dive — deep analysis of a file');
  if (level >= 12) unlocks.push('/clean — Quak tidies the pond');
  return unlocks;
}