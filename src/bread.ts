import { Storage, QuakState } from './storage.js';
import { DuckMood } from './duck.js';

const HUNGER_DECAY_MS = 2 * 60 * 60 * 1000; // 2 hours

export function getHungerLevel(state: QuakState): number {
  const elapsed = Date.now() - state.lastFed;
  return Math.min(1, elapsed / HUNGER_DECAY_MS);
}

export function getMoodFromHunger(state: QuakState): DuckMood {
  const hunger = getHungerLevel(state);
  if (hunger >= 0.9) return 'hungry';
  if (hunger >= 0.5) return 'worried';
  return 'happy';
}

export function feedQuak(storage: Storage): { success: boolean; message: string; state: QuakState } {
  const state = storage.loadState();
  if (state.bread < 1) {
    return { success: false, message: 'No bread! Earn more by coding 🍞', state };
  }
  state.bread -= 1;
  state.lastFed = Date.now();
  storage.saveState(state);
  return { success: true, message: 'Quak ate the bread! 🍞😊 QUAK!', state };
}

export function earnBread(storage: Storage, amount: number): QuakState {
  const state = storage.loadState();
  state.bread += amount;
  storage.saveState(state);
  return state;
}

export function spendBread(storage: Storage, amount: number): { success: boolean; state: QuakState } {
  const state = storage.loadState();
  if (state.bread < amount) {
    return { success: false, state };
  }
  state.bread -= amount;
  storage.saveState(state);
  return { success: true, state };
}

export function getHatchCost(): number {
  return 10;
}

export function getCleanCost(): number {
  return 5;
}