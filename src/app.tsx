import React, { useState, useCallback, useEffect, useRef, useReducer } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';

import { notify } from './notifications.js';
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
import { PermissionPrompt } from './components/PermissionPrompt.js';
import { CommandStatusPanel } from './components/CommandStatusPanel.js';
import { AgentActivity } from './components/AgentActivity.js';
import { PlanPanel } from './components/PlanPanel.js';
import { createSessionId, clearSession } from './session.js';
import { getProjectDir } from './projectDir.js';
import { pruneByTokenBudget } from './utils/tokens.js';
import { summarizeDroppedMessages } from './utils/summarize.js';
import { syncPermissionModeForUi } from './modeSync.js';
import { persistSession, listRecentSessions, loadSession } from './sessionStore.js';
import {
  clearToolActivity,
  subscribeToolActivity,
  type ToolActivityEntry,
} from './agentEvents.js';
import { subscribeCommandStatus, clearCommandRuns } from './commandStatus.js';
import {
  setPermissionResolver,
  type PermissionRequest,
} from './permissionsPrompt.js';

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
  const [mode, setMode] = useState<'agent' | 'chat' | 'plan' | 'dontAsk'>('agent');
  const [state, setState] = useState<QuakState>(storage.loadState());
  const [provider, setProvider] = useState(storage.getActiveProvider());
  const [runState, setRunState] = useState<'idle' | 'thinking' | 'running' | 'done' | 'error'>('idle');
  const [runNote, setRunNote] = useState('Ready');
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null);
  const [permInput, setPermInput] = useState('');
  const [toolActivity, setToolActivity] = useState<ToolActivityEntry[]>([]);
  const [lastToolActivity, setLastToolActivity] = useState<ToolActivityEntry[]>([]);
  const [projectDir, setProjectDir] = useState(getProjectDir());
  const [planRevision, setPlanRevision] = useState(0);
  const [permissionMode, setPermissionMode] = useState(storage.loadPermissions().mode);
  const sessionIdRef = useRef(createSessionId());
  const abortRef = useRef<AbortController | null>(null);
  const permResolveRef = useRef<((allowed: boolean) => void) | null>(null);
  const permissionRequestRef = useRef<PermissionRequest | null>(null);
  const permInputRef = useRef('');
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredRef = useRef(false);
  const mood = getMoodFromHunger(state);
  const [, bumpCommandStatus] = useReducer((n: number) => n + 1, 0);

  permissionRequestRef.current = permissionRequest;
  permInputRef.current = permInput;

  const applyUiMode = useCallback(
    (nextMode: 'agent' | 'chat' | 'plan' | 'dontAsk') => {
      setMode(nextMode);
      syncPermissionModeForUi(storage, nextMode);
      setPermissionMode(storage.loadPermissions().mode);
    },
    [storage],
  );

  useEffect(() => {
    return () => {
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (messages.length > 0) {
        persistSession(sessionIdRef.current, messages);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [messages]);

  useEffect(() => subscribeCommandStatus(() => bumpCommandStatus()), []);

  useEffect(
    () =>
      subscribeToolActivity((entries) => {
        setToolActivity(entries);
        if (entries.length > 0) setLastToolActivity(entries);
      }),
    [],
  );

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const recent = listRecentSessions(1);
    if (recent.length === 0) return;
    const loaded = loadSession(recent[0].sessionId);
    if (!loaded || loaded.length === 0) return;
    sessionIdRef.current = recent[0].sessionId;
    setMessages([
      ...loaded,
      { role: 'system', content: `Restored session ${recent[0].sessionId}` },
    ]);
  }, []);

  const clearDoneTimer = () => {
    if (doneTimerRef.current) {
      clearTimeout(doneTimerRef.current);
      doneTimerRef.current = null;
    }
  };

  const pruneMessages = (msgs: Message[]): Message[] => {
    const settings = storage.loadAgentSettings();
    let result =
      msgs.length > settings.maxHistoryMessages
        ? msgs.slice(-settings.maxHistoryMessages)
        : msgs;
    const beforeLen = result.length;
    result = pruneByTokenBudget(result, settings.maxHistoryTokens, 4);
    if (result.length < beforeLen) {
      const droppedCount = beforeLen - result.length;
      const dropped = msgs.slice(0, droppedCount);
      const summary = summarizeDroppedMessages(dropped);
      return [{ role: 'system', content: summary }, ...result];
    }
    return result;
  };

  const resolvePermission = useCallback((allowed: boolean) => {
    permResolveRef.current?.(allowed);
    permResolveRef.current = null;
    setPermissionRequest(null);
    setPermInput('');
    permInputRef.current = '';
  }, []);

  useInput((inputChar, key) => {
    if (permissionRequestRef.current) {
      if (key.escape) {
        resolvePermission(false);
        return;
      }
      if (inputChar === 'y' || inputChar === 'Y') {
        resolvePermission(true);
        return;
      }
      if (inputChar === 'n' || inputChar === 'N') {
        resolvePermission(false);
        return;
      }
      if (key.return) {
        resolvePermission(/^\s*y(es)?\s*$/i.test(permInputRef.current));
        return;
      }
      if (key.backspace || key.delete) {
        const next = permInputRef.current.slice(0, -1);
        permInputRef.current = next;
        setPermInput(next);
        return;
      }
      if (inputChar && !key.ctrl && !key.meta) {
        const next = permInputRef.current + inputChar;
        permInputRef.current = next;
        setPermInput(next);
      }
      return;
    }

    if (key.ctrl && inputChar === 'c' && abortRef.current) {
      abortRef.current.abort();
      setRunNote('Cancelled');
      return;
    }
    if ((key.ctrl && inputChar === 'h') || inputChar === '?') {
      pushEvent('system', [
        'Keyboard Shortcuts:',
        '  Ctrl+T    — Cycle modes (agent/chat/plan/dontAsk)',
        '  Ctrl+C    — Cancel running agent',
        '  Ctrl+H/?  — Show this help',
        '  Ctrl+S    — Save session now',
        '  Ctrl+E    — Show eval commands',
        '  Ctrl+L    - Run linter on current file',
        '  Y/N/Esc   — Answer permission prompts',
        '  Up/Down   — Cycle input history (not yet implemented)',
      ].join('\n'));
      return;
    }
    if (key.ctrl && inputChar === 's') {
      persistSession(sessionIdRef.current, messages);
      pushEvent('system', 'Session saved');
      return;
    }
    if (key.ctrl && inputChar === 'e') {
      pushEvent('system', '/eval list — list cases. /eval run <id> — run case.');
      return;
    }
    if (key.ctrl && inputChar === 't') {
      const modes: Array<'agent' | 'chat' | 'plan' | 'dontAsk'> = ['agent', 'chat', 'plan', 'dontAsk'];
      const nextMode = modes[(modes.indexOf(mode) + 1) % modes.length];
      applyUiMode(nextMode);
      pushEvent('system', `Switched to ${nextMode} mode`);
      const modeMessages: Record<string, string> = {
        agent: 'Agent Mode: I have full access to tools and will execute actions.',
        chat: 'Chat Mode: I will answer questions and explain code only.',
        plan: 'Plan Mode: I will break this into a strategic plan.',
      };
      setMessages((prev) => [...prev, { role: 'system', content: modeMessages[nextMode] }]);
    }
  });

  const handleSubmit = useCallback(
    async (value: string) => {
      if (!value.trim() || permissionRequest) return;
      setInput('');

      const userMsg: Message = { role: 'user', content: value };
      setMessages((prev) => [...prev, userMsg]);

      if (value.startsWith('/')) {
        const parts = value.split(' ');
        const cmd = parts[0];
        const args = parts.slice(1).join(' ');

        if (cmd === '/mode' && ['agent', 'chat', 'plan', 'dontAsk'].includes(args)) {
          applyUiMode(args as 'agent' | 'chat' | 'plan');
          setMessages((prev) => [
            ...prev,
            { role: 'system', content: `Switched to ${args} mode` },
          ]);
          return;
        }

        const result = handleCommand(cmd, args, storage, projectDir, sessionIdRef.current);
        if (cmd === '/project') setProjectDir(getProjectDir());
        if (cmd === '/permissions') setPermissionMode(storage.loadPermissions().mode);
        if (result) {
          if (result.restoreMessages) {
            setMessages(result.restoreMessages);
            if (result.restoreSessionId) sessionIdRef.current = result.restoreSessionId;
          } else if (cmd === '/clear') {
            setMessages([]);
            clearSession(sessionIdRef.current);
            clearCommandRuns();
            sessionIdRef.current = createSessionId();
          } else {
            setMessages((prev) => [...prev, { role: 'system', content: result.output }]);
          }
          if (result.shouldExit) exit();
          setState(storage.loadState());
          setProvider(storage.getActiveProvider());
          return;
        }
      }

      clearDoneTimer();
      clearToolActivity();
      setRunState('thinking');
      setRunNote('Thinking');

      const controller = new AbortController();
      abortRef.current = controller;

      setPermissionResolver(
        (req) =>
          new Promise<boolean>((resolve) => {
            permResolveRef.current = resolve;
            setPermissionRequest(req);
          }),
      );

      try {
        const history = pruneMessages([...messages, userMsg]);
        const aiMessages = history.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

        let fullResponse = '';
        setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

        for await (const chunk of runAgent({
          storage,
          projectDir,
          messages: aiMessages,
          mode,
          sessionId: sessionIdRef.current,
          abortSignal: controller.signal,
        })) {
          setRunState('running');
          setRunNote('Working');
          fullResponse += chunk;
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: 'assistant', content: fullResponse };
            return next;
          });
        }

        persistSession(sessionIdRef.current, [
          ...messages,
          userMsg,
          { role: 'assistant', content: fullResponse },
        ]);

        setPlanRevision((n) => n + 1);

        const newState = addXP(storage, 1, 'ai_message');
        pushEvent('xp', '+1 XP for chatting with Quak');
        checkAchievements(storage, newState);
        setState(storage.loadState());
        setRunState('done');
        const channel = storage.loadSettings().notifications?.preferredChannel ?? 'auto';
        notify('Quak', 'Task complete!', channel as any);
        setRunNote('Done');
        doneTimerRef.current = setTimeout(() => {
          setRunState('idle');
          setRunNote('Ready');
          doneTimerRef.current = null;
        }, 1200);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.toLowerCase().includes('abort')) {
          const friendly =
            msg.includes('Bad Request') && provider?.type === 'huggingface'
              ? 'API error: Hugging Face rejected the request. Try again, or switch provider with /provider use <name>.'
              : `Error: ${msg}`;
          setMessages((prev) => [...prev, { role: 'system', content: friendly }]);
        }
        setRunState('error');
        setRunNote('Error');
      } finally {
        abortRef.current = null;
        setPermissionResolver(null);
        if (permResolveRef.current) {
          permResolveRef.current(false);
          permResolveRef.current = null;
        }
        setPermissionRequest(null);
        setPermInput('');
        permInputRef.current = '';
      }
    },
    [messages, mode, storage, exit, permissionRequest, provider, resolvePermission, projectDir, applyUiMode],
  );

  const visibleMessages = messages.slice(-15);
  const showActivity =
    runState === 'thinking' || runState === 'running' || runState === 'error';
  const showLastRun = runState === 'idle' && lastToolActivity.length > 0;

  return (
    <Box flexDirection="column" height="100%" padding={1}>
      <TopHeader state={state} mood={mood} provider={provider} />

      <Box flexDirection="column" flexGrow={1} marginY={1}>
        {visibleMessages.map((msg, i) => (
          <ChatMessage key={i} role={msg.role} content={msg.content} />
        ))}
        {permissionRequest && (
          <PermissionPrompt request={permissionRequest} typed={permInput} />
        )}
        {mode === 'plan' && (
          <PlanPanel sessionId={sessionIdRef.current} revision={planRevision} />
        )}
        {showActivity && !permissionRequest && (
          <AgentActivity
            runState={runState}
            runNote={runNote}
            tools={toolActivity}
            progress={{ total: toolActivity.length, completed: toolActivity.filter(t => t.status !== 'running').length }}
          />
        )}
        {showLastRun && !permissionRequest && (
          <AgentActivity
            runState="running"
            runNote="Last run"
            tools={lastToolActivity}
            progress={{ total: lastToolActivity.length, completed: lastToolActivity.filter(t => t.status !== 'running').length }}
          />
        )}
      </Box>

      <CommandStatusPanel />

      <Box borderStyle="single" borderColor="red" paddingTop={1} paddingBottom={1}>
        {permissionRequest ? (
          <Text color="yellow">Waiting for permission - press Y (allow) or N / Esc (deny)</Text>
        ) : (
          <>
            <Text color="red">{'> '}</Text>
            <TextInput
              value={input}
              onChange={setInput}
              onSubmit={handleSubmit}
              placeholder="ask quak anything..."
            />
          </>
        )}
      </Box>

      <StatusBar
        mode={mode}
        state={state}
        provider={provider}
        runState={runState}
        runNote={runNote}
        projectDir={projectDir}
        permissionMode={permissionMode}
      />
    </Box>
  );
}
