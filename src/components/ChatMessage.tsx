import React from 'react';
import { Box, Text } from 'ink';

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === 'user';
  
  // Split the content by text wrapped in asterisks
  // Example: "Hello *world*!" -> ["Hello ", "*world*", "!"]
  const parts = content.split(/(\*[^*]+\*)/g);
  
  return (
    <Box>
      <Text dimColor={isUser} color={!isUser ? 'white' : undefined}>
        {role === 'user' ? '> ' : (role === 'system' ? '~ ' : '• ')}
      </Text>
      <Text dimColor={isUser} color={!isUser ? 'white' : undefined}>
        {parts.map((part, i) => {
          // If the part is wrapped in asterisks (*), render it as italic and dim
          if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
            return (
              <Text key={i} italic dimColor>
                {part.slice(1, -1)}
              </Text>
            );
          }
          // Otherwise, render normally
          return <Text key={i}>{part}</Text>;
        })}
      </Text>
    </Box>
  );
}