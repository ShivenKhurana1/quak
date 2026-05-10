import React from 'react';
import { Box, Text } from 'ink';

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === 'user';
  
  return (
    <Box>
      <Text dimColor={isUser} color={!isUser ? 'white' : undefined}>
        {role === 'user' ? '> ' : (role === 'system' ? '~ ' : '• ')}
      </Text>
      <Text dimColor={isUser} color={!isUser ? 'white' : undefined}>
        {content}
      </Text>
    </Box>
  );
}