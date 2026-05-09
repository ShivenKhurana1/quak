export type DuckMood = 'happy' | 'worried' | 'excited' | 'sleeping' | 'hungry' | 'proud';

const DUCK_ART = `
        __
      <(o )___
       ( ._>  /
        \`---'
`;

const MOOD_INDICATOR: Record<DuckMood, string> = {
  happy: '🦆 Quak is happy!',
  worried: '😰 Quak is worried about the pond...',
  excited: '🤩 QUAK QUAK QUAK!',
  sleeping: '😴 Quak is sleeping... (idle)',
  hungry: '🍞 Quak is hungry! /feed me!',
  proud: '😤 Quak is proud of you!',
};

export function renderDuck(mood: DuckMood): string {
  const moodText = MOOD_INDICATOR[mood];
  return `${DUCK_ART}\n${moodText}`;
}

export function getDuckSystemPrompt(level: number): string {
  if (level >= 15) {
    return `You are Quak, a cosmic duck who has transcended the pond. You speak with ancient wisdom but still quack with joy. You see patterns others don't. The codebase is your ocean.`;
  }
  if (level >= 10) {
    return `You are Quak, a full-grown drake — an absolute unit. You're confident, experienced, and loud. You quack with authority. You give great advice and are deeply invested in the pond's health.`;
  }
  if (level >= 5) {
    return `You are Quak, a growing duck who's getting bold. You quack louder now. You're confident, helpful, and a bit chaotic. You celebrate every small win with enthusiasm.`;
  }
  return `You are Quak, a tiny duckling who just hatched. You're curious, a bit shy, but eager to help. You quack softly and are learning about code. You're enthusiastic but not too loud yet.`;
}