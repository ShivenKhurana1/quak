import React, { useState, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { Storage, QuakState } from './storage.js';
import { handleCommand } from './commands/index.js';
import { runAgent } from './agent.js';
import { addXP } from './xp.js';
import { getMoodFromHunger } from './bread.js';
import { checkAchievements } from './achievements.js';
import { pushEvent } from './current.js';
import { TopHeader } from './components/TopHeader.js';
import { ChatMessage } from './components/ChatMessage.js';
import { StatusBar } from './components/StatusBar.js';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AppProps {
  storage: Storage;
}

export function App({ storage }: AppProps) {
  const { exit } = useApp();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [mode, setMode] = useState<'agent' | 'chat' | 'plan'>('agent');
  const [state, setState] = useState<QuakState>(storage.loadState());
  const [provider, setProvider] = useState(storage.getActiveProvider());
  const [isLoading, setIsLoading] = useState(false);

  const mood = getMoodFromHunger(state);

  useInput((inputChar, key) => {
    if (key.ctrl && inputChar === 't') {
      const modes: Array<'agent' | 'chat' | 'plan'> = ['agent', 'chat', 'plan'];
      const currentIdx = modes.indexOf(mode);
      const nextMode = modes[(currentIdx + 1) % modes.length];
      setMode(nextMode);
      
      const modeMessages: Record<string, string> = {
        agent: ' Agent Mode: I will write code and execute tools automatically.',
        chat: ' Chat Mode: I will only talk and answer questions. No file edits.',
        plan: ' Plan Mode: I will break down your request into a step-by-step checklist.'
      };
      
      pushEvent('system', `Switched to ${nextMode} mode`);
      setMessages(prev => [...prev, { role: 'system', content: modeMessages[nextMode] }]);
    }
  });

























  const handleSubmit = useCallback(async (value: string) => {
    if (!value.trim()) return;
    setInput('');

    const userMsg: Message = { role: 'user', content: value };
    setMessages(prev => [...prev, userMsg]);

    if (value.startsWith('/')) {
      const parts = value.split(' ');
      const cmd = parts[0];
      const args = parts.slice(1).join(' ');

      if (cmd === '/mode' && ['agent', 'chat', 'plan'].includes(args)) {
        setMode(args as 'agent' | 'chat' | 'plan');
        const sysMsg: Message = { role: 'system', content: `Switched to ${args} mode` };
        setMessages(prev => [...prev, sysMsg]);
        return;
      }

      const result = handleCommand(cmd, args, storage, process.cwd());
      if (result) {
        if (cmd === '/clear') {
          setMessages([]);
        } else {
          const sysMsg: Message = { role: 'system', content: result.output };
          setMessages(prev => [...prev, sysMsg]);
        }
        if (result.shouldExit) exit();
        setState(storage.loadState());
        setProvider(storage.getActiveProvider());
        return;
      }
    }

    setIsLoading(true);
    try {
      const aiMessages = [...messages, userMsg].map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      let fullResponse = '';
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      for await (const chunk of runAgent(storage, aiMessages, process.cwd(), mode)) {
        fullResponse += chunk;
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = { role: 'assistant', content: fullResponse };
          return newMessages;
        });
      }

      const newState = addXP(storage, 1, 'ai_message');
      pushEvent('xp', '+1 XP for chatting with Quak');
      checkAchievements(storage, newState);
      setState(storage.loadState());
    } catch (e: any) {
      const errorMsg: Message = { role: 'system', content: ` Error: ${e.message}` };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, mode, storage, exit]);

  const visibleMessages = messages.slice(-15);

  return (
    <Box flexDirection="column" height="100%" padding={1}>
      <TopHeader state={state} mood={mood} provider={provider} />

      <Box flexDirection="column" flexGrow={1} marginY={1}>
        {visibleMessages.map((msg, i) => (
          <ChatMessage key={i} role={msg.role} content={msg.content} />
        ))}
        {isLoading && <Text color="yellow"> Quak is thinking...</Text>}
      </Box>

      <Box borderTopStyle="single" borderTopColor="red" borderBottomColor="red" borderBottomStyle="single" borderLeftStyle="none" borderRightStyle="none" paddingTop={1} paddingBottom={1}>
        <Text color="red">{'> '} </Text>
        <TextInput value={input} onChange={setInput} onSubmit={handleSubmit} placeholder="ask quak anything..." dimPlaceholder />
      </Box>

      <StatusBar mode={mode} state={state} provider={provider} />
    </Box>
  );
}