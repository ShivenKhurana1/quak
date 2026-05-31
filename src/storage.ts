import fs from 'fs';
import path from 'path';
import os from 'os';
import type { PermissionSettings } from './permissions.js';
import { stripEmoji } from './utils/ascii.js';
const STATE_VERSION = 2;
const QUAK_DIR = path.join(os.homedir(), '.quak');
const STATE_FILE = path.join(QUAK_DIR, 'state.json');
const PROVIDERS_FILE = path.join(QUAK_DIR, 'providers.json');
const ACHIEVEMENTS_FILE = path.join(QUAK_DIR, 'achievements.json');
const MEMORY_DIR = path.join(QUAK_DIR, 'memory');
const MEMORY_FILE = path.join(MEMORY_DIR, 'MEMORY.md');
const PROJECTS_DIR = path.join(QUAK_DIR, 'projects');
const SETTINGS_FILE = path.join(QUAK_DIR, 'settings.json');
export interface QuakState {
  name: string;
  github?: string;
  xp: number;
  level: number;
  bread: number;
  lastFed: number;
  lastActive: number;
  streak: number;
  lastStreakDate: string;
  totalToolCalls: number;
  currentProject?: string;
  createdAt: number;
  version?: number;
}

export interface ProviderConfig {
  name: string;
  type: 'openai' | 'anthropic' | 'groq' | 'ollama' | 'huggingface';
  apiKey?: string;
  baseUrl?: string;
  model: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: number;
  reward: number;
}
export interface QuakSettings {
  permissions: {
    mode: 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions';
    allow: { pattern: string }[];
    ask: { pattern: string }[];
    deny: { pattern: string }[];
  };
  notifications: {
    preferredChannel: 'auto' | 'terminal_bell' | 'notifications_disabled';
  };
  statusLine: {
    enabled: boolean;
  };
  agent: {
    maxSteps: number;
    maxHistoryMessages: number;
    maxHistoryTokens: number;
    subAgentMaxSteps: number;
    lintOnEdit: boolean;
    fastProvider?: string;
  };
  shell?: {
    defaultTimeoutMs: number;
    backgroundWaitMs: number;
    installTimeoutMs: number;
  };
}
function migrateState(state: any): QuakState {
  const currentVersion = state.version ?? 1;
  if (currentVersion >= STATE_VERSION) return state as QuakState;
  let migrated = { ...state };
  if (currentVersion < 2) {
    if (!migrated.streak) migrated.streak = 0;
    if (!migrated.lastStreakDate) migrated.lastStreakDate = '';
    if (!migrated.totalToolCalls) migrated.totalToolCalls = 0;
  }
  migrated.version = STATE_VERSION;
  return migrated;
}
export class Storage {
  loadState(): QuakState {
    if (!fs.existsSync(STATE_FILE)) return this.defaultState();
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    return migrateState(raw);
  }

  exists(): boolean {
    return fs.existsSync(STATE_FILE);
  }

  saveState(state: QuakState): void {
    this.ensureDir(QUAK_DIR);
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  }

  defaultState(): QuakState {
    return {
      name: '',
      xp: 0,
      level: 1,
      bread: 5,
      lastFed: Date.now(),
      lastActive: Date.now(),
      streak: 0,
      lastStreakDate: '',
      totalToolCalls: 0,
      createdAt: Date.now(),
    };
  }

  loadProviders(): ProviderConfig[] {
    if (!fs.existsSync(PROVIDERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(PROVIDERS_FILE, 'utf-8'));
  }
  loadSettings(): QuakSettings {
    if (!fs.existsSync(SETTINGS_FILE)) return this.defaultSettings();
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
  }

  loadPermissions(): PermissionSettings {
    return this.loadSettings().permissions;
  }

  saveSettings(settings: QuakSettings): void {
    this.ensureDir(QUAK_DIR);
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  }

  defaultSettings(): QuakSettings {
    return {
      permissions: {
        mode: 'acceptEdits',
        allow: [],
        ask: [],
        deny: [],
      },
      notifications: {
        preferredChannel: 'auto',
      },
      statusLine: {
        enabled: true,
      },
      agent: {
        maxSteps: 50,
        maxHistoryMessages: 40,
        maxHistoryTokens: 32_000,
        subAgentMaxSteps: 15,
        lintOnEdit: true,
      },
      shell: {
        defaultTimeoutMs: 120_000,
        backgroundWaitMs: 12_000,
        installTimeoutMs: 600_000,
      },
    };
  }
  loadAgentSettings(): {
    maxSteps: number;
    maxHistoryMessages: number;
    maxHistoryTokens: number;
    subAgentMaxSteps: number;
    lintOnEdit: boolean;
    fastProvider?: string;
  } {
    const s = this.loadSettings();
    const agent = s.agent ?? {
      maxSteps: 50,
      maxHistoryMessages: 40,
      maxHistoryTokens: 32_000,
      subAgentMaxSteps: 15,
      lintOnEdit: true,
    };
    return {
      maxSteps: agent.maxSteps,
      maxHistoryMessages: agent.maxHistoryMessages,
      maxHistoryTokens: agent.maxHistoryTokens ?? 32_000,
      subAgentMaxSteps: agent.subAgentMaxSteps ?? 15,
      lintOnEdit: agent.lintOnEdit ?? true,
      fastProvider: agent.fastProvider,
    };
  }

  /** Active provider name (stored in state.currentProject for backward compat). */
  getActiveProviderId(): string | undefined {
    return this.loadState().currentProject;
  }

  loadShellSettings(): {
    defaultTimeoutMs: number;
    backgroundWaitMs: number;
    installTimeoutMs: number;
  } {
    const s = this.loadSettings();
    return (
      s.shell ?? {
        defaultTimeoutMs: 120_000,
        backgroundWaitMs: 12_000,
        installTimeoutMs: 600_000,
      }
    );
  }
  saveProviders(providers: ProviderConfig[]): void {
    this.ensureDir(QUAK_DIR);
    fs.writeFileSync(PROVIDERS_FILE, JSON.stringify(providers, null, 2));
  }

  getActiveProvider(): ProviderConfig | null {
    const providers = this.loadProviders();
    return providers.find(p => p.name === this.loadState().currentProject) || providers[0] || null;
  }

  loadAchievements(): Achievement[] {
    if (!fs.existsSync(ACHIEVEMENTS_FILE)) return this.defaultAchievements();
    const loaded = JSON.parse(fs.readFileSync(ACHIEVEMENTS_FILE, 'utf-8')) as Achievement[];
    return loaded.map((a) => ({
      ...a,
      icon: stripEmoji(a.icon || '') || '*',
    }));
  }

  saveAchievements(achievements: Achievement[]): void {
    this.ensureDir(QUAK_DIR);
    fs.writeFileSync(ACHIEVEMENTS_FILE, JSON.stringify(achievements, null, 2));
  }

  defaultAchievements(): Achievement[] {
    return [
      { id: 'first_quack', name: 'First Quack', description: 'Run Quak for the first time', icon: '*', reward: 10 },
      { id: 'daily_dabbler', name: 'Daily Dabbler', description: 'Use Quak daily', icon: '*', reward: 5 },
      { id: 'no_life_pond', name: 'No Life Pond', description: 'Run 100 commands', icon: '*', reward: 20 },
      { id: 'midnight_waddler', name: 'Midnight Waddler', description: 'Use Quak after midnight', icon: '*', reward: 15 },
      { id: 'chronically_online', name: 'Chronically Online', description: 'Send 10 AI messages', icon: '*', reward: 10 },
      { id: 'flock_leader', name: 'Flock Leader', description: '7-day streak', icon: '*', reward: 100 },
      { id: 'bread_giver', name: 'Bread Giver', description: 'Feed Quak', icon: '*', reward: 5 },
      { id: 'bold_duck', name: 'Bold Duck', description: 'Reach level 5', icon: '*', reward: 75 },
      { id: 'absolute_drake', name: 'Absolute Drake', description: 'Reach level 10', icon: '*', reward: 150 },
      { id: 'rubber_duck_debug', name: 'Rubber Duck Debug', description: 'Use /swim 10 times', icon: '*', reward: 25 },
      { id: 'pond_cleaner', name: 'Pond Cleaner', description: 'Delete 100 lines of dead code', icon: '*', reward: 30 },
      { id: 'bug_snack', name: 'Bug Snack', description: 'Fix 25 bugs', icon: '*', reward: 50 },
    ];
  }

  loadMemory(): string {
    if (!fs.existsSync(MEMORY_FILE)) return '';
    return fs.readFileSync(MEMORY_FILE, 'utf-8');
  }

  saveMemory(content: string): void {
    this.ensureDir(MEMORY_DIR);
    fs.writeFileSync(MEMORY_FILE, content);
  }

  appendMemory(content: string): void {
    this.ensureDir(MEMORY_DIR);
    fs.appendFileSync(MEMORY_FILE, content + '\n');
  }

  loadProjectState(projectPath: string): { pondHealth: number; lastVisit: number; visits: number } {
    const hash = Buffer.from(projectPath).toString('base64').replace(/[/=+]/g, '');
    const file = path.join(PROJECTS_DIR, `${hash}.json`);
    if (!fs.existsSync(file)) {
      return { pondHealth: 50, lastVisit: Date.now(), visits: 0 };
    }
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  }

  saveProjectState(projectPath: string, data: { pondHealth: number; lastVisit: number; visits: number }): void {
    this.ensureDir(PROJECTS_DIR);
    const hash = Buffer.from(projectPath).toString('base64').replace(/[/=+]/g, '');
    fs.writeFileSync(path.join(PROJECTS_DIR, `${hash}.json`), JSON.stringify(data, null, 2));
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}