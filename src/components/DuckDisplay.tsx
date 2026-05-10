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
    <Box flexDirection="row" justifyContent="space-between" paddingX={1}>
      <Box flexDirection="column">
        <Text color="yellow">{duck}</Text>
      </Box>
      <Box flexDirection="column" justifyContent="center">
        <Box flexDirection="row" gap={2}>
          <Text color="cyan">Level</Text>
          <Text>{state.level}</Text>
        </Box>
        <Box flexDirection="row" gap={2}>
          <Text color="cyan">XP</Text>
          <Text>[{xpBar}] {progress.percent}%</Text>
        </Box>
        <Box flexDirection="row" gap={2}>
          <Text color="cyan">Bread</Text>
          <Text>🍞 {state.bread}</Text>
        </Box>
        <Box flexDirection="row" gap={2}>
          <Text color="cyan">Hunger</Text>
          <Text color={hunger > 70 ? 'red' : 'gray'}>{hunger}%</Text>
        </Box>
      </Box>
    </Box>
  );
}