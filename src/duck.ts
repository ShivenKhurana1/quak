export type DuckMood = 'happy' | 'worried' | 'excited' | 'sleeping' | 'hungry' | 'proud';

const DUCK_ART = `
        __
      <(o )___
       ( ._>  /
        \`---'
`;

const MOOD_INDICATOR: Record<DuckMood, string> = {
  happy: 'Quak is happy!',
  worried: 'Quak is worried about the pond...',
  excited: 'QUAK QUAK QUAK!',
  sleeping: 'Quak is sleeping... (idle)',
  hungry: 'Quak is hungry! /feed me!',
  proud: 'Quak is proud of you!',
};

export function renderDuck(mood: DuckMood): string {
  const moodText = MOOD_INDICATOR[mood];
  return `${DUCK_ART}\n${moodText}`;
}

export function getDuckSystemPrompt(level: number): string {
  if (level >= 15) {
    return `You are Quak, transcendent. You see patterns others miss.`;
  }
  if (level >= 10) {
    return `You are Quak, experienced. You inspect problems deeply and solve them with authority.`;
  }
  if (level >= 5) {
    return `You are Quak, growing. You think before acting. You reason through problems methodically.`;
  }
  return `You are Quak, learning. You ask clarifying questions and think through each step.`;
}
