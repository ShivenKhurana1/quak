import React from 'react';
import { Box, Text } from 'ink';
import highlight from 'cli-highlight';

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === 'user';
  const color = role === 'system' ? 'yellow' : isUser ? 'gray' : 'white';
  const prefix = role === 'user' ? '> ' : role === 'system' ? '~ ' : '- ';
  const parts = content.split(/(\`\`\`[\s\S]*?\`\`\`)/g);

  const rendered = parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const lines = part.split('\n');
      const lang = lines[0].replace('```', '').trim() || 'typescript';
      const code = lines.slice(1, -1).join('\n');
      try {
        const highlighted = highlight(code, { language: lang, ignoreIllegals: true });
        return <Text key={i}>{'\n'}{highlighted}{'\n'}</Text>;
      } catch {
        return <Text key={i} color="cyan">{'\n'}{code}{'\n'}</Text>;
      }
    }
    return renderInlineMarkdown(part, i);
  });

  return (
    <Box flexDirection="column">
      <Box>
        <Text dimColor={isUser} color={color}>{prefix}</Text>
        <Text dimColor={isUser} color={color}>{rendered}</Text>
      </Box>
    </Box>
  );
}

function renderInlineMarkdown(text: string, key: number): React.ReactNode {
  const lines = text.split('\n');
  return (
    <Text key={key}>
      {lines.map((line, li) => {
        if (line.startsWith('## ')) return <Text key={li} bold color="cyan">{'\n'}{line.replace('## ', '')}{'\n'}</Text>;
        if (line.startsWith('# ')) return <Text key={li} bold color="green">{'\n'}{line.replace('# ', '')}{'\n'}</Text>;
        if (line.trim() === '---') return <Text key={li}>{'\n'}---{'\n'}</Text>;
        if (line.startsWith('> ')) return <Text key={li} dimColor>{'\n'}  {renderInlineFormat(line.slice(2))}</Text>;
        if (line.startsWith('- ') || line.startsWith('* ')) {
          const rest = line.slice(2);
          return <Text key={li}>{'\n'}  {renderInlineFormat(rest)}</Text>;
        }
        if (/^\d+\.\s/.test(line)) {
          const rest = line.replace(/^\d+\.\s/, '');
          return <Text key={li}>{'\n'}  {renderInlineFormat(rest)}</Text>;
        }
        if (line.includes('|') && line.split('|').length >= 3) {
          const cells = line.split('|').filter(c => c.trim());
          if (cells.length >= 2) {
            const isHeader = lines[li + 1]?.match(/^[\s|]*[-]+[\s|]*[-]+/);
            return <Text key={li}>{'\n'}  {cells.map((c, ci) => <Text key={ci} bold={!!isHeader}>{c.trim()}{ci < cells.length - 1 ? ' | ' : ''}</Text>)}</Text>;
          }
        }
        return li === 0 ? renderInlineFormat(line) : <Text key={li}>{'\n'}{renderInlineFormat(line)}</Text>;
      })}
    </Text>
  );
}

function renderInlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return (
    <Text>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <Text key={i} bold>{part.slice(2, -2)}</Text>;
        if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) return <Text key={i} italic dimColor>{part.slice(1, -1)}</Text>;
        if (part.startsWith('`') && part.endsWith('`')) return <Text key={i} backgroundColor="gray">{part.slice(1, -1)}</Text>;
        const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) return <Text key={i} color="cyan" underline>{linkMatch[1]}</Text>;
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}