import React from 'react';
import { Box, Text } from 'ink';
import { getPlanContent } from '../tools/plan.js';

interface Props {
  sessionId: string;
  revision: number;
}

export function PlanPanel({ sessionId, revision }: Props) {
  void revision;
  const plan = getPlanContent(sessionId);
  if (!plan) return null;
  const lines = plan.split('\n').slice(0, 14);
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1} marginBottom={1}>
      <Text bold color="magenta">Plan</Text>
      {lines.map((line, i) => (
        <Text key={i} dimColor={line.startsWith('##')}>{line}</Text>
      ))}
    </Box>
  );
}
