import React from 'react';
import { Box, Text } from 'ink';
import {
  getActiveCommandRuns,
  getRecentCommandRuns,
  getCommandOutputTail,
  type CommandRun,
} from '../commandStatus.js';

function statusColor(status: CommandRun['status']): string {
  switch (status) {
    case 'running':
      return 'yellow';
    case 'background':
      return 'cyan';
    case 'success':
      return 'green';
    case 'failed':
      return 'red';
    case 'timeout':
      return 'magenta';
    default:
      return 'white';
  }
}

function statusLabel(run: CommandRun): string {
  if (run.status === 'running') return 'RUN';
  if (run.status === 'background') return 'BG';
  if (run.status === 'timeout') return 'TIMEOUT';
  if (run.exitCode === 0) return 'OK';
  return `EXIT ${run.exitCode ?? '?'}`;
}

function truncate(cmd: string, max = 64): string {
  const oneLine = cmd.replace(/\s+/g, ' ').trim();
  return oneLine.length <= max ? oneLine : oneLine.slice(0, max - 3) + '...';
}

function OutputBlock({ run }: { run: CommandRun }) {
  const tail = getCommandOutputTail(run.id, 12);
  if (!tail) return null;
  return (
    <Box flexDirection="column" marginLeft={2} marginBottom={1}>
      {tail.split('\n').map((line, i) => (
        <Text key={`${run.id}-${i}`} dimColor wrap="truncate">
          {line}
        </Text>
      ))}
    </Box>
  );
}

export function CommandStatusPanel() {
  const active = getActiveCommandRuns();
  const recent = getRecentCommandRuns()
    .filter((r) => r.status !== 'running' && r.status !== 'background')
    .slice(-2);

  if (active.length === 0 && recent.length === 0) return null;

  return (
    <Box flexDirection="column" marginBottom={1} borderStyle="single" borderColor="gray" paddingX={1}>
      <Text dimColor bold>
        Commands
      </Text>
      {active.map((run) => (
        <Box key={run.id} flexDirection="column">
          <Box>
            <Text color="yellow">&gt; </Text>
            <Text color={statusColor(run.status)}>[{statusLabel(run)}]</Text>
            <Text> {truncate(run.command)}</Text>
            {run.pid != null && <Text dimColor> pid={run.pid}</Text>}
          </Box>
          <OutputBlock run={run} />
        </Box>
      ))}
      {recent.map((run) => (
        <Box key={run.id} flexDirection="column">
          <Box>
            <Text dimColor>- </Text>
            <Text color={statusColor(run.status)}>[{statusLabel(run)}]</Text>
            <Text dimColor> {truncate(run.command)}</Text>
          </Box>
          <OutputBlock run={run} />
        </Box>
      ))}
    </Box>
  );
}