import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { ToolActivityEntry } from '../agentEvents.js';
import { ProgressTracker } from '../progress.js';

interface AgentActivityProps {
  runState: 'thinking' | 'running' | 'error';
  runNote: string;
  tools: ToolActivityEntry[];
  progress?: {
    total: number;
    completed: number;
  };
  eta?: number;
}

export function AgentActivity({ runState, runNote, tools, progress, eta }: AgentActivityProps) {
  const color = runState === 'error' ? 'red' : runState === 'thinking' ? 'yellow' : 'cyan';
  const phase = runState === 'thinking' ? 'Thinking' : runState === 'running' ? 'Running' : 'Error';
  const recent = tools.slice(-6);

  const progressTracker = progress && progress.total > 0 ? new ProgressTracker(progress.total) : null;
  const progressInfo = progressTracker?.getProgress();

  return (
    <Box flexDirection="column" marginY={1}>
      <Text color={color}><Spinner type="dots" /> {phase}: {runNote}</Text>
      
      {progressInfo && (
        <Text dimColor>
          Progress: {progressInfo.percentage}% ({progressInfo.completed}/{progressInfo.total})
          {eta && ` • ETA: ${progressTracker?.formatETA(eta)}`}
        </Text>
      )}
      
      {recent.map((t, i) => (
        <Text key={i} dimColor>
          {t.status === 'running' ? '…' : t.status === 'error' ? '✗' : '✓'} {t.tool}
          {t.target ? ` ${t.target}` : ''}{t.ms != null ? ` (${t.ms}ms)` : ''}
          {t.preview ? ` — ${t.preview}` : ''}
        </Text>
      ))}
    </Box>
  );
}