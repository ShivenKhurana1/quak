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
      pushEvent('system', `Switched to ${nextMode} mode`);
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
      for await (const chunk of runAgent(storage, aiMessages, process.cwd(), mode)) {
        fullResponse += chunk;
      }

      const assistantMsg: Message = { role: 'assistant', content: fullResponse };
      setMessages(prev => [...prev, assistantMsg]);

      const newState = addXP(storage, 1, 'ai_message');
      pushEvent('xp', '+1 XP for chatting with Quak');
      checkAchievements(storage, newState);
      setState(storage.loadState());
    } catch (e: any) {
      const errorMsg: Message = { role: 'system', content: `❌ Error: ${e.message}` };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, mode, storage, exit]);

  const visibleMessages = messages.slice(-15);

  return (
    <Box flexDirection="column" height="100%" padding={1}>
      <TopHeader state={state} mood={mood} provider={provider} />

      {/* Main chat area */}
      <Box flexDirection="column" flexGrow={1} marginY={1}>
        {visibleMessages.map((msg, i) => (
          <ChatMessage key={i} role={msg.role} content={msg.content} />
        ))}
        {isLoading && <Text color="yellow"> Quak is thinking...</Text>}
      </Box>

      {/* Input area */}
      <Box borderTopStyle="single" borderTopColor="red" borderBottomColor="red" borderBottomStyle="single" borderLeftStyle="none" borderRightStyle="none" paddingTop={1} paddingBottom={1}>
        <Text color="red">{'> '} </Text>
        <TextInput value={input} onChange={setInput} onSubmit={handleSubmit} placeholder="ask quak anything..." dimPlaceholder />
      </Box>

      {/* Bottom status bar */}
      <StatusBar mode={mode} state={state} provider={provider} />
    </Box>
  );
}