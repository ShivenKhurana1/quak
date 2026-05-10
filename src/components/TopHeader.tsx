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

  // Large ASCII text for QUAK
  const logoText = [
    " ██████╗ ██╗   ██╗ █████╗ ██╗  ██╗",
    "██╔═══██╗██║   ██║██╔══██╗██║ ██╔╝",
    "██║   ██║██║   ██║███████║█████╔╝ ",
    "██║▄▄ ██║██║   ██║██╔══██║██╔═██╗ ",
    "╚██████╔╝╚██████╔╝██║  ██║██║  ██╗",
    " ╚══▀▀═╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝"
  ];

  return (
    <Box flexDirection="row" justifyContent="space-between" width="100%" marginBottom={1}>
      {/* Top Left Info Box */}
      <Box borderStyle="round" borderColor="gray" paddingX={1} flexDirection="row" gap={2}>
        <Box flexDirection="column" marginRight={2}>
          <Text dimColor>{provider ? provider.model : 'no model'}</Text>
        </Box>
        <Box flexDirection="column">
          <Text color="red">getting started</Text>
          <Text dimColor>ctrl+t to switch mode</Text>
        </Box>
      </Box>

      {/* Top Right Logo & Duck */}
      <Box flexDirection="row" gap={2}>
        <Box flexDirection="column">
          {logoText.map((line, i) => (
            <Text key={i} color="yellow" bold>{line}</Text>
          ))}
        </Box>
        <Box flexDirection="column" justifyContent="center">
          {duckLines.map((line, i) => (
             <Text key={i} color="yellow">{line}</Text>
          ))}
        </Box>
      </Box>
    </Box>
  );
}