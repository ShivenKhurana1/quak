import fs from 'fs';
import path from 'path';
import { Storage } from '../storage.js';
import { addXP } from '../xp.js';
import { feedQuak, getHungerLevel, spendBread, getCleanCost } from '../bread.js';
import { checkAchievements, formatAchievements } from '../achievements.js';
import { listProviders, addProvider, removeProvider, setActiveProvider } from '../providers.js';
import { calculatePondHealth, getPondLabel } from '../pond.js';
import { formatCurrent, pushEvent } from '../current.js';
import { formatMigration, recordVisit } from '../migration.js';
import { CheckpointStore } from '../checkpoints.js';
import { killAllBackgroundCommands } from '../shell.js';
import { getActiveCommandRuns } from '../commandStatus.js';
import { setProjectDir, getProjectDir } from '../projectDir.js';
import type { PermissionMode } from '../permissions.js';
import { listRecentSessions, loadSession, searchSessions, exportSession } from '../sessionStore.js';
import { getPlanContent } from '../tools/plan.js';
import { loadEvalCases, formatEvalHelp } from '../eval.js';
import { formatSessionCost } from '../costTracker.js';

export interface CommandResult {
  output: string;
  shouldExit?: boolean;
  restoreMessages?: { role: 'user' | 'assistant' | 'system'; content: string }[];
  restoreSessionId?: string;
}

export function handleCommand(
  command: string,
  args: string,
  storage: Storage,
  projectDir: string,
  sessionId?: string,
): CommandResult | null {
  const state = storage.loadState();

  switch (command) {
    case '/help':
      return { output: formatHelp(state.level) };

    case '/pet':
      return {
        output: ` Quak quak! You pet Quak.\n  Level: ${state.level}\n  XP: ${state.xp}\n  Bread:  ${state.bread}\n  Hunger: ${Math.floor(getHungerLevel(state) * 100)}%\n  Streak: ${state.streak} days`,
      };

    case '/feed': {
      const result = feedQuak(storage);
      pushEvent('bread', result.message);
      const newState = storage.loadState();
      checkAchievements(storage, newState);
      return { output: result.message };
    }

    case '/bread':
      return { output: ` Bread: ${state.bread}` };

    case '/stats':
      return {
        output: ` Quak Stats:\n  Level: ${state.level}\n  XP: ${state.xp}\n  Bread:  ${state.bread}\n  Hunger: ${Math.floor(getHungerLevel(state) * 100)}%\n  Streak: ${state.streak} days\n  Tool calls: ${state.totalToolCalls}`,
      };

    case '/pond': {
      if (state.level < 7) return { output: ' Unlocks at level 7' };
      const report = calculatePondHealth(projectDir);
      const label = getPondLabel(report.score);
      return {
        output: ` Pond Health: ${report.score}/100 - ${label.label}\n\n${report.details.join('\n')}`,
      };
    }

    case '/current':
      return { output: formatCurrent(10) };

    case '/quack': {
      if (state.level < 3) return { output: ' Unlocks at level 3' };
      const quacks = [
        'QUACK! Your code could use a bath ',
        'QUAK QUAK! That function is longer than my neck!',
        'QUACK! I see a bug from here and I don\'t even have eyes!',
        'QUAK! Who wrote this? ...oh wait, you did.',
        'QUACK! This pond is getting murky...',
      ];
      return { output: ` ${quacks[Math.floor(Math.random() * quacks.length)]}` };
    }

    case '/vibe': {
      if (state.level < 5) return { output: ' Unlocks at level 5' };
      const vibes = [
        ' The vibes are immaculate. Ship it.',
        ' vibes... concerning. Maybe refactor first?',
        ' Absolute fire vibes. You\'re cooking.',
        ' Mid vibes. Not terrible, not great.',
        ' The vibes are DEAD. Take a break.',
        ' The pond vibes are flowing. Keep going.',
      ];
      const report = calculatePondHealth(projectDir);
      const vibeIndex = report.score >= 80 ? 0 : report.score >= 60 ? 2 : report.score >= 40 ? 3 : 4;
      return { output: ` Vibe check: ${vibes[vibeIndex]}\n  Pond health: ${report.score}/100` };
    }

    case '/crimes': {
      if (state.level < 10) return { output: ' Unlocks at level 10' };
      const report = calculatePondHealth(projectDir);
      const crimes: string[] = [];
      if (report.lintErrors > 0) crimes.push(`   ${report.lintErrors} lint errors - CRIME AGAINST STYLE`);
      if (report.todoCount > 5) crimes.push(`   ${report.todoCount} TODOs - PROCRASTINATION IS A CRIME`);
      if (report.commitRecency > 48) crimes.push(`   Last commit ${Math.floor(report.commitRecency / 24)}d ago - ABANDONMENT`);
      if (report.testFailures > 0) crimes.push(`   Failing tests - CRIME AGAINST QUALITY`);
      if (crimes.length === 0) crimes.push('   No crimes detected. You\'re a model citizen.');
      return { output: ` QUAK'S RAP SHEET:\n${crimes.join('\n')}` };
    }

    case '/swim': {
      if (state.level < 6) return { output: ' Unlocks at level 6' };
      addXP(storage, 2, '/swim');
      pushEvent('xp', '+2 XP for rubber duck debugging');
      return { output: ' Rubber duck debug mode activated!\n  Explain your problem to Quak. Quak listens. Quak understands.\n  (Just talk to Quak like you would a rubber duck)' };
    }

    case '/migrate': {
      recordVisit(storage);
      return { output: formatMigration(storage) };
    }

    case '/achievements':
    case '/ach': {
      const achievements = storage.loadAchievements();
      return { output: formatAchievements(achievements) };
    }

    case '/provider': {
      if (args === 'list' || !args) return { output: listProviders(storage) };
      if (args === 'add') return { output: 'Use /provider add <type> <name> <model> [apiKey] [baseUrl]\nTypes: openai, anthropic, groq, ollama, huggingface\nExample: /provider add huggingface myhf meta-llama/Llama-3.1-8B-Instruct hf_...' };
      const parts = args.split(' ');
      if (parts[0] === 'add' && parts.length >= 4) {
        addProvider(storage, {
          type: parts[1] as any,
          name: parts[2],
          model: parts[3],
          apiKey: parts[4],
          baseUrl: parts[5],
        });
        return { output: ` Provider "${parts[2]}" added!` };
      }
      if (parts[0] === 'remove' && parts[1]) {
        const removed = removeProvider(storage, parts[1]);
        return { output: removed ? ` Provider "${parts[1]}" removed` : ` Provider "${parts[1]}" not found` };
      }
      if (parts[0] === 'use' && parts[1]) {
        setActiveProvider(storage, parts[1]);
        return { output: ` Switched to provider "${parts[1]}"` };
      }
      return { output: 'Unknown provider command. Use: /provider list|add|remove|use' };
    }

    case '/mode':
      return { output: `Use /mode <agent|chat|plan|dontAsk> to switch modes` };

    case '/init': {
      const quakMd = `# QUAK.md - Project Context\n\nThis file helps Quak understand your project.\n\n## Overview\n- Project: ${projectDir.split('/').pop()}\n- Type: (describe your project type)\n\n## Structure\n- src/ - main source code\n- tests/ - test files\n\n## Conventions\n- (add your coding conventions here)\n\n## Notes\n- (add any project-specific notes here)\n`;
      fs.writeFileSync(path.join(projectDir, 'QUAK.md'), quakMd);
      return { output: ' Generated QUAK.md in your project root!' };
    }

    case '/genz': {
      if (state.level < 4) return { output: ' Unlocks at level 4' };
      const genz = [
        'no cap this code is giving main character energy fr fr ',
        'bestie this function is doing the MOST and I\'m here for it slay ',
        'this code is giving... it\'s giving... I\'mma be real it\'s giving mid ',
        'the way this variable is named is giving ick ngl ',
        'rent free in my head how clean this refactor is ',
      ];
      return { output: ` ${genz[Math.floor(Math.random() * genz.length)]}` };
    }

    case '/clean': {
      if (state.level < 12) return { output: ' Unlocks at level 12' };
      const cost = getCleanCost();
      const { success } = spendBread(storage, cost);
      if (!success) return { output: `Need ${cost} bread to clean. You have ${state.bread}.` };
      return { output: ' Quak is tidying the pond... (auto-fix minor issues coming soon!)' };
    }

    case '/dive': {
      if (state.level < 10) return { output: ' Unlocks at level 10' };
      if (!args) return { output: 'Usage: /dive <file path>' };
      return { output: ` Quak is diving deep into ${args}... (ask Quak to analyze this file in chat)` };
    }
    case '/search': {
      if (!args) return { output: 'Usage: /search <query>' };
      const results = searchSessions(args);
      if (results.length === 0) return { output: 'No sessions matched.' };
      return { output: results.map(r => `  ${r.sessionId.slice(0, 12)}... ${r.match.slice(0, 80)}`).join('\n') };
    }
    case '/export': {
      if (!args) return { output: 'Usage: /export <sessionId>' };
      const output = exportSession(args);
      if (!output) return { output: `Session not found: ${args}` };
      return { output: output.slice(0, 4000) };
    }
    case '/clear':
      return { output: '', shouldExit: false };
    case '/continue':
      return { output: 'Continuing from where you left off.' };
    case '/cost':
      return { output: `Session Cost:\n${formatSessionCost()}` };
    case '/undo': {
      if (!sessionId) return { output: 'No active session' };
      const store = new CheckpointStore();
      const restored = store.restoreLatest(sessionId, args || undefined);
      if (!restored) return { output: 'No checkpoints to undo' };
      return { output: `Restored ${restored.filePath}` };
    }

    case '/project': {
      if (!args) {
        return { output: `Project directory: ${getProjectDir()}\nUsage: /project <path>` };
      }
      const result = setProjectDir(args.trim());
      return { output: result.message };
    }

    case '/permissions': {
      const settings = storage.loadSettings();
      if (!args) {
        const p = settings.permissions;
        return {
          output: `Permission mode: ${p.mode}\nallow: ${p.allow.length}  ask: ${p.ask.length}  deny: ${p.deny.length}\nUsage: /permissions <default|acceptEdits|plan|dontAsk|bypassPermissions>`,
        };
      }
      const modes: PermissionMode[] = [
        'default',
        'acceptEdits',
        'plan',
        'dontAsk',
        'bypassPermissions',
      ];
      if (!modes.includes(args as PermissionMode)) {
        return { output: `Unknown mode. Use: ${modes.join(', ')}` };
      }
      settings.permissions.mode = args as PermissionMode;
      storage.saveSettings(settings);
      return { output: `Permission mode set to ${args}` };
    }

    case '/memory': {
      if (!args) {
        const mem = storage.loadMemory().trim();
        return { output: mem || '(memory empty — use /memory add <fact>)' };
      }
      if (args.startsWith('add ')) {
        storage.appendMemory(`- ${args.slice(4).trim()}`);
        return { output: 'Added to MEMORY.md' };
      }
      return { output: 'Usage: /memory  |  /memory add <fact>' };
    }

    case '/plan': {
      if (!sessionId) return { output: 'No active session' };
      const plan = getPlanContent(sessionId);
      return {
        output: plan ?? 'No plan for this session yet. Use Plan mode and ask Quak to plan.',
      };
    }

    case '/resume': {
      const recent = listRecentSessions(8);
      if (!args) {
        if (recent.length === 0) return { output: 'No saved sessions.' };
        const lines = recent.map(
          (s) => `  ${s.sessionId}  (${new Date(s.updatedAt).toLocaleString()})`,
        );
        return { output: `Recent sessions:\n${lines.join('\n')}\nUsage: /resume <sessionId>` };
      }
      const loaded = loadSession(args.trim());
      if (!loaded) return { output: `Session not found: ${args}` };
      return {
        output: `Restored ${loaded.length} messages.`,
        restoreMessages: loaded,
        restoreSessionId: args.trim(),
      };
    }

    case '/eval': {
      if (!args || args === 'list') {
        const cases = loadEvalCases();
        return {
          output: cases.length
            ? cases.map((c) => `${c.id}: ${c.prompt}`).join('\n')
            : formatEvalHelp(),
        };
      }
      if (args.startsWith('run ')) {
        const id = args.slice(4).trim();
        const c = loadEvalCases().find((x) => x.id === id);
        if (!c) return { output: `Unknown eval: ${id}` };
        return { output: `Run in chat:\n${c.prompt}` };
      }
      return { output: formatEvalHelp() };
    }

    case '/stop': {
      const active = getActiveCommandRuns();
      const killed = killAllBackgroundCommands();
      if (killed === 0 && active.length === 0) {
        return { output: 'No background commands running.' };
      }
      return {
        output: `Stopped ${killed} background process(es). ${active.length} command(s) were listed in the panel.`,
      };
    }

    default:
      return null;
  }
}

function formatHelp(level: number): string {
  const allCommands = [
    { cmd: '/help', desc: 'List all commands', minLevel: 1 },
    { cmd: '/pet', desc: 'Check Quak\'s stats', minLevel: 1 },
    { cmd: '/feed', desc: 'Feed Quak bread ', minLevel: 1 },
    { cmd: '/bread', desc: 'Check bread balance', minLevel: 1 },
    { cmd: '/stats', desc: 'Detailed stats', minLevel: 1 },
    { cmd: '/current', desc: 'Activity stream', minLevel: 1 },
    { cmd: '/achievements', desc: 'Browse achievements', minLevel: 1 },
    { cmd: '/init', desc: 'Generate QUAK.md', minLevel: 1 },
    { cmd: '/undo [file]', desc: 'Restore last file checkpoint', minLevel: 1 },
    { cmd: '/stop', desc: 'Stop background dev servers', minLevel: 1 },
    { cmd: '/cost', desc: 'Show session token/cost', minLevel: 1 },
    { cmd: '/search <q>', desc: 'Search past sessions', minLevel: 1 },
    { cmd: '/export <id>', desc: 'Export session as markdown', minLevel: 1 },
    { cmd: '/mode', desc: 'Switch agent/chat/plan/dontAsk', minLevel: 1 },
    { cmd: '/project [path]', desc: 'Show or set project directory', minLevel: 1 },
    { cmd: '/permissions [mode]', desc: 'Show or set permission mode', minLevel: 1 },
    { cmd: '/memory', desc: 'View or add long-term memory', minLevel: 1 },
    { cmd: '/plan', desc: 'Show session plan file', minLevel: 1 },
    { cmd: '/resume [id]', desc: 'List or restore saved session', minLevel: 1 },
    { cmd: '/eval [list|run id]', desc: 'Agent eval harness', minLevel: 1 },
    { cmd: '/provider', desc: 'Manage AI providers', minLevel: 1 },
    { cmd: '/quack', desc: 'Quak quacks at your code', minLevel: 3 },
    { cmd: '/genz', desc: 'You don\'t want to know', minLevel: 4 },
    { cmd: '/vibe', desc: 'Vibe check on project', minLevel: 5 },
    { cmd: '/swim', desc: 'Rubber duck debug mode', minLevel: 6 },
    { cmd: '/pond', desc: 'Pond health breakdown', minLevel: 7 },
    { cmd: '/migrate', desc: 'Project map', minLevel: 8 },
    { cmd: '/dive <file>', desc: 'Deep file analysis', minLevel: 10 },
    { cmd: '/crimes', desc: 'Rap sheet on your code', minLevel: 10 },
    { cmd: '/clean', desc: 'Tidy the pond', minLevel: 12 },
  ];

  const unlocked = allCommands.filter(c => level >= c.minLevel);
  const locked = allCommands.filter(c => level < c.minLevel);

  let output = ' Quak Commands:\n\n';
  for (const c of unlocked) {
    output += `  ${c.cmd.padEnd(20)} ${c.desc}\n`;
  }
  if (locked.length > 0) {
    output += '\n Locked:\n';
    for (const c of locked) {
      output += `  ${c.cmd.padEnd(20)} ${c.desc} (Lvl ${c.minLevel})\n`;
    }
  }
  return output.trimEnd();
}