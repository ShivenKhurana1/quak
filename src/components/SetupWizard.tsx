import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

import { Storage, QuakState } from '../storage.js';
import { pushEvent } from '../current.js';
import { renderDuck } from '../duck.js';

interface SetupWizardProps {
  storage: Storage;
}

export function SetupWizard({ storage }: SetupWizardProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [github, setGithub] = useState('');
  const [done, setDone] = useState(false);

  const handleNameSubmit = () => {
    if (name.trim()) setStep(1);
  };

  const handleGithubSubmit = () => {
    setStep(2);
  };

  const handleDone = () => {
    const state: QuakState = {
      ...storage.defaultState(),
      name: name.trim(),
      github: github.trim() || undefined,
    };
    storage.saveState(state);
    pushEvent('system', `Welcome, ${name}! Quak has hatched! 🐥`);
    setDone(true);
  };

  const duckArt = renderDuck('happy');

  if (done) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="yellow" bold>{duckArt}</Text>
        <Text color="cyan" bold>QUACK! Quak has hatched! 🐥</Text>
        <Text>Hey {name}! I'm Quak, your terminal duck buddy.</Text>
        <Text dimColor>Run /provider add to set up your AI provider, then start coding!</Text>
        <Text dimColor>Use /help to see all commands.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text color="yellow" bold>{duckArt}</Text>
      <Text color="cyan" bold>Welcome to Quak! 🐥</Text>
      <Text dimColor>Let's get you set up.</Text>

      {step === 0 && (
        <Box marginTop={1}>
          <Text>What's your name? </Text>
          <TextInput value={name} onChange={setName} onSubmit={handleNameSubmit} />
        </Box>
      )}

      {step === 1 && (
        <Box marginTop={1}>
          <Text>GitHub username (optional): </Text>
          <TextInput value={github} onChange={setGithub} onSubmit={handleGithubSubmit} />
        </Box>
      )}

      {step === 2 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="green"> Name: {name}</Text>
          {github && <Text color="green"> GitHub: {github}</Text>}
          <Text marginTop={1}>Press Enter to hatch Quak!</Text>
          <TextInput value="" onChange={() => {}} onSubmit={handleDone} />
        </Box>
      )}
    </Box>
  );
}