import React from 'react';
import { Box, Text } from 'ink';
import { QuakState } from '../storage.js';
import { getXpProgress } from '../xp.js';

interface StatusBarProps {
  mode: 'agent' | 'chat' | 'plan';
  state: QuakState;
  provider: { name: string; model: string } | null;
}

export function StatusBar({ mode, state, provider }: StatusBarProps) {
  const progress = getXpProgress(state);
  
  const modeColors: Record<string, string> = {
    agent: 'yellow',
    chat: 'blue',
    plan: 'cyan',
  };

  return (
    <Box flexDirection="row" justifyContent="space-between" width="100%" paddingTop={1}>
      {/* Left side: Level and XP */}
      <Box flexDirection="row" gap={2}>
        <Text color="yellow" bold> lv.{state.level}</Text>
        <Text color="yellow"> {progress.currentXp}/{progress.nextLevelXp}xp</Text>
      </Box>

      {/* Center: Model info */}
      <Box flexDirection="row">
        <Text dimColor>
          {provider ? `${provider.name} - ${provider.model}` : 'no provider - no model'}
        </Text>
      </Box>

      {/* Right side: Mode */}
      <Box flexDirection="row">
        <Text backgroundColor={modeColors[mode]} color="black" bold>
          {'  ' + mode + ' mode '}
        </Text>
      </Box>
    </Box>
  );
}