import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  mode: 'agent' | 'chat' | 'plan';
  pondHealth?: number;
}

export function StatusBar({ mode, pondHealth }: StatusBarProps) {
  const modeColors: Record<string, string> = {
    agent: 'green',
    chat: 'blue',
    plan: 'yellow',
  };

  const modeIcons: Record<string, string> = {
    agent: '🔧',
    chat: '💬',
    plan: '📋',
  };

  return (
    <Box>
      <Text color={modeColors[mode]} bold>
        {modeIcons[mode]} {mode.toUpperCase()}
      </Text>
      {pondHealth !== undefined && (
        <Text dimColor> | 🌊 Pond: {pondHealth}%</Text>
      )}
      <Text dimColor> | ctrl+t switch mode | /help commands</Text>
    </Box>
  );
}