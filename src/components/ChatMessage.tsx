import React from 'react';
import { Box, Text } from 'ink';
import highlight from 'cli-highlight';

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === 'user';
  
  // Format code blocks with cli-highlight
  const formattedContent = content.split(/(\`\`\`[\s\S]*?\`\`\`)/g).map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const lines = part.split('\n');
      const lang = lines[0].replace('```', '').trim() || 'typescript';
      const code = lines.slice(1, -1).join('\n');
      
      try {
        const highlighted = highlight(code, { language: lang, ignoreIllegals: true });
        return <Text key={i}>{'\n'}{highlighted}{'\n'}</Text>;
      } catch (e) {
        return <Text key={i} color="cyan">{'\n'}{code}{'\n'}</Text>;
      }
    }
    
    // Handle duck *actions*
    const subParts = part.split(/(\*[^*]+\*)/g);
    return (
      <Text key={i}>
        {subParts.map((sub, j) => {
          if (sub.startsWith('*') && sub.endsWith('*') && sub.length > 2) {
            return <Text key={j} italic dimColor>{sub.slice(1, -1)}</Text>;
          }
          return <Text key={j}>{sub}</Text>;
        })}
      </Text>
    );
  });
  
  return (
    <Box>
      <Text dimColor={isUser} color={!isUser ? 'white' : undefined}>
        {role === 'user' ? '> ' : (role === 'system' ? '~ ' : '• ')}
      </Text>
      <Text dimColor={isUser} color={!isUser ? 'white' : undefined}>
        {formattedContent}
      </Text>
    </Box>
  );
}