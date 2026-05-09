import fs from 'fs';
import path from 'path';
import os from 'os';

const QUAK_DIR = path.join(os.homedir(), '.quak');
const STATE_FILE = path.join(QUAK_DIR, 'state.json');
const PROVIDERS_FILE = path.join(QUAK_DIR, 'providers.json');
const ACHIEVEMENTS_FILE = path.join(QUAK_DIR, 'achievements.json');
const MEMORY_DIR = path.join(QUAK_DIR, 'memory');
const MEMORY_FILE = path.join(MEMORY_DIR, 'MEMORY.md');
const PROJECTS_DIR = path.join(QUAK_DIR, 'projects');

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
}

export interface ProviderConfig {
  name: string;
  type: 'openai' | 'anthropic' | 'groq' | 'ollama';
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

export class Storage {
  exists(): boolean {
    return fs.existsSync(STATE_FILE);
  }

  // --- State ---
  loadState(): QuakState {
    if (!fs.existsSync(STATE_FILE)) {
      return this.defaultState();
    }
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
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

  // --- Providers ---
  loadProviders(): ProviderConfig[] {
    if (!fs.existsSync(PROVIDERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(PROVIDERS_FILE, 'utf-8'));
  }

  saveProviders(providers: ProviderConfig[]): void {
    this.ensureDir(QUAK_DIR);
    fs.writeFileSync(PROVIDERS_FILE, JSON.stringify(providers, null, 2));
  }

  getActiveProvider(): ProviderConfig | null {
    const providers = this.loadProviders();
    return providers.find(p => p.name === this.loadState().currentProject) || providers[0] || null;
  }

  // --- Achievements ---
  loadAchievements(): Achievement[] {
    if (!fs.existsSync(ACHIEVEMENTS_FILE)) return this.defaultAchievements();
    return JSON.parse(fs.readFileSync(ACHIEVEMENTS_FILE, 'utf-8'));
  }

  saveAchievements(achievements: Achievement[]): void {
    this.ensureDir(QUAK_DIR);
    fs.writeFileSync(ACHIEVEMENTS_FILE, JSON.stringify(achievements, null, 2));
  }

  defaultAchievements(): Achievement[] {
    return [
      { id: 'first_quack', name: 'First Quack', description: 'Run Quak for the first time', icon: '🐥', reward: 10 },
      { id: 'daily_dabbler', name: 'Daily Dabbler', description: 'Use Quak daily', icon: '📅', reward: 5 },
      { id: 'no_life_pond', name: 'No Life Pond', description: 'Run 100 commands', icon: '💀', reward: 20 },
      { id: 'midnight_waddler', name: 'Midnight Waddler', description: 'Use Quak after midnight', icon: '🌙', reward: 15 },
      { id: 'chronically_online', name: 'Chronically Online', description: 'Send 10 AI messages', icon: '🤖', reward: 10 },
      { id: 'flock_leader', name: 'Flock Leader', description: '7-day streak', icon: '👑', reward: 100 },
      { id: 'bread_giver', name: 'Bread Giver', description: 'Feed Quak', icon: '🍞', reward: 5 },
      { id: 'bold_duck', name: 'Bold Duck', description: 'Reach level 5', icon: '🦆', reward: 75 },
      { id: 'absolute_drake', name: 'Absolute Drake', description: 'Reach level 10', icon: '🪿', reward: 150 },
      { id: 'rubber_duck_debug', name: 'Rubber Duck Debug', description: 'Use /swim 10 times', icon: '🛁', reward: 25 },
      { id: 'pond_cleaner', name: 'Pond Cleaner', description: 'Delete 100 lines of dead code', icon: '🧹', reward: 30 },
      { id: 'bug_snack', name: 'Bug Snack', description: 'Fix 25 bugs', icon: '🐛', reward: 50 },
    ];
  }

  // --- Memory ---
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

  // --- Project State ---
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