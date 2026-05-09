import { Storage, Achievement, QuakState } from './storage.js';

export function checkAchievements(storage: Storage, state: QuakState): Achievement[] {
  const achievements = storage.loadAchievements();
  const newlyUnlocked: Achievement[] = [];

  const checks: Record<string, () => boolean> = {
    first_quack: () => state.name !== '',
    daily_dabbler: () => {
      const today = new Date().toISOString().split('T')[0];
      return state.lastStreakDate === today;
    },
    no_life_pond: () => state.totalToolCalls >= 100,
    midnight_waddler: () => new Date().getHours() >= 0 && new Date().getHours() < 5,
    chronically_online: () => state.totalToolCalls >= 10,
    flock_leader: () => state.streak >= 7,
    bread_giver: () => state.lastFed !== state.createdAt,
    bold_duck: () => state.level >= 5,
    absolute_drake: () => state.level >= 10,
  };

  for (const achievement of achievements) {
    if (achievement.unlockedAt) continue;
    const check = checks[achievement.id];
    if (check && check()) {
      achievement.unlockedAt = Date.now();
      state.bread += achievement.reward;
      newlyUnlocked.push(achievement);
    }
  }

  if (newlyUnlocked.length > 0) {
    storage.saveAchievements(achievements);
    storage.saveState(state);
  }

  return newlyUnlocked;
}

export function formatAchievements(achievements: Achievement[]): string {
  return achievements.map(a => {
    const status = a.unlockedAt ? `✅ Unlocked (${new Date(a.unlockedAt).toLocaleDateString()})` : ' Locked';
    return `${a.icon} ${a.name} — ${a.description} | ${status} | +$${a.reward} bread`;
  }).join('\n');
}