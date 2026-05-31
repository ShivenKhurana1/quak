import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { QuakState } from '../storage.js';
import { getXpProgress } from '../xp.js';

interface StatusBarProps {
  mode: 'agent' | 'chat' | 'plan' | 'dontAsk';
  state: QuakState;
  provider: { name: string; model: string } | null;
  runState: 'idle' | 'thinking' | 'running' | 'done' | 'error';
  runNote: string;
  projectDir: string;
  permissionMode: string;
}

function shortPath(p: string, max = 28): string {
  if (p.length <= max) return p;
  return '…' + p.slice(-(max - 1));
}

export function StatusBar({
  mode,
  state,
  provider,
  runState,
  runNote,
  projectDir,
  permissionMode,
}: StatusBarProps) {
  const progress = getXpProgress(state);
  const modeColors: Record<string, string> = { agent: 'yellow', chat: 'blue', plan: 'cyan' };
  const runColors: Record<string, string> = {
    idle: 'gray',
    thinking: 'yellow',
    running: 'cyan',
    done: 'green',
    error: 'red',
  };

  return (
    <Box flexDirection="column" width="100%" paddingTop={1}>
      <Box flexDirection="row" justifyContent="space-between" width="100%">
        <Box flexDirection="row" gap={1}>
          <Text color="yellow" bold>lv.{state.level}</Text>
          <Text color="yellow">{progress.current}/{progress.needed}xp</Text>
        </Box>
        <Box flexDirection="row" gap={1}>
          <Text dimColor>{provider ? `${provider.name} · ${provider.model}` : 'no provider'}</Text>
          <Text backgroundColor={runColors[runState]} color="black" bold>
            {(runState === 'thinking' || runState === 'running') && <Spinner type="dots" />}
            {runNote}{' '}
          </Text>
        </Box>
        <Text backgroundColor={modeColors[mode]} color="black" bold>{` ${mode} `}</Text>
      </Box>
      <Box flexDirection="row" gap={2}>
        <Text dimColor>{shortPath(projectDir)}</Text>
        <Text dimColor>perm:{permissionMode}</Text>
      </Box>
    </Box>
  );
}
