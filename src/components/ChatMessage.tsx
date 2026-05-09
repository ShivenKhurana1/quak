import React from 'react';
import { Box, Text } from 'ink';

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const colors: Record<string, string> = {
    user: 'green',
    assistant: 'cyan',
    system: 'yellow',
  };

  const prefixes: Record<string, string> = {
    user: 'You',
    assistant: '🦆 Quak',
    system: '⚡',
  };

  return (
    <Box marginBottom={0}>
      <Text color={colors[role]} bold>
        {prefixes[role]}:{' '}
      </Text>
      <Text>{content}</Text>
    </Box>
  );
}