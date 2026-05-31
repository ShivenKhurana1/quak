import React from 'react';
import { Box, Text } from 'ink';
import type { PermissionRequest } from '../permissionsPrompt.js';

interface Props {
  request: PermissionRequest;
  typed: string;
}

/** Display-only; keyboard handling lives in App.useInput (Ink passes one char per event). */
export function PermissionPrompt({ request, typed }: Props) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1} marginBottom={1}>
      <Text color="yellow" bold>
        Permission required
      </Text>
      <Text>
        Allow <Text color="cyan">{request.tool}</Text>
        {request.target ? ` on ${request.target}` : ''}?
      </Text>
      <Text dimColor>{request.reason}</Text>
      <Text color="green">Press Y to allow</Text>
      <Text color="red">Press N or Esc to deny</Text>
      {typed.length > 0 && <Text dimColor>You typed: {typed}</Text>}
    </Box>
  );
}
