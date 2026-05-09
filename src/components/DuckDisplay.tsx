import React from 'react';
import { Box, Text } from 'ink';
import { renderDuck, DuckMood } from '../duck.js';
import { getXpProgress } from '../xp.js';
import { getHungerLevel } from '../bread.js';
import { QuakState } from '../storage.js';

interface DuckDisplayProps {
  state: QuakState;
  mood: DuckMood;
}

export function DuckDisplay({ state, mood }: DuckDisplayProps) {
  const duck = renderDuck(mood);
  const progress = getXpProgress(state);
  const hunger = Math.floor(getHungerLevel(state) * 100);

  const xpBar = '█'.repeat(Math.floor(progress.percent / 10)) + '░'.repeat(10 - Math.floor(progress.percent / 10));

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={0}>
      <Text color="yellow">{duck}</Text>
      <Box marginTop={0}>
        <Text dimColor>  Lvl {state.level} </Text>
        <Text dimColor>XP [{xpBar}] {progress.percent}% </Text>
        <Text dimColor>🍞 {state.bread} </Text>
        <Text color={hunger > 70 ? 'red' : 'dim'}>Hunger {hunger}%</Text>
      </Box>
    </Box>
  );
}