import React from 'react';
import { Box, Text } from 'ink';
import { renderDuck, DuckMood } from '../duck.js';
import { QuakState } from '../storage.js';

interface TopHeaderProps {
  state: QuakState;
  mood: DuckMood;
  provider: { name: string; model: string } | null;
}

export function TopHeader({ state, mood, provider }: TopHeaderProps) {
  const duck = renderDuck(mood);
  const duckLines = duck.split('\n');

  return (
    <Box flexDirection="row" justifyContent="space-between" width="100%" marginBottom={1}>
      <Box borderStyle="round" borderColor="gray" paddingX={1} flexDirection="row" gap={2}>
        <Box flexDirection="column" marginRight={2}>
          <Text dimColor>{provider ? provider.model : 'no model'}</Text>
        </Box>
        <Box flexDirection="column">
          <Text color="red">getting started</Text>
          <Text dimColor>ctrl+t to switch mode</Text>
        </Box>
      </Box>

      <Box flexDirection="row" gap={2}>
        <Box flexDirection="column" justifyContent="center">
          <Text color="yellow" bold>
            Q U A K
          </Text>
        </Box>
        <Box flexDirection="column" justifyContent="center">
          {duckLines.map((line, i) => (
            <Text key={i} color="yellow">
              {line}
            </Text>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
