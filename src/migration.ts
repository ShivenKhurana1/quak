import fs from 'fs';
import path from 'path';
import os from 'os';
import { Storage } from './storage.js';
import { asciiBar } from './utils/ascii.js';

export interface ProjectRecord {
  path: string;
  name: string;
  pondHealth: number;
  lastVisit: number;
  visits: number;
}

export function getCurrentProject(): string {
  return process.cwd();
}

export function recordVisit(storage: Storage): void {
  const projectDir = getCurrentProject();
  const state = storage.loadProjectState(projectDir);
  state.lastVisit = Date.now();
  state.visits += 1;
  storage.saveProjectState(projectDir, state);
}

export function getProjectList(storage: Storage): ProjectRecord[] {
  const projectsDir = path.join(os.homedir(), '.quak', 'projects');
  if (!fs.existsSync(projectsDir)) return [];
  const files = fs.readdirSync(projectsDir);
  return files.map(f => {
    const data = JSON.parse(fs.readFileSync(path.join(projectsDir, f), 'utf-8'));
    return data;
  }).sort((a, b) => b.lastVisit - a.lastVisit);
}

export function formatMigration(storage: Storage): string {
  const projects = getProjectList(storage);
  if (projects.length === 0) return 'No projects visited yet. Start coding!';

  return projects.map(p => {
    const daysSince = Math.floor((Date.now() - p.lastVisit) / (1000 * 60 * 60 * 24));
    const healthBar = asciiBar(p.pondHealth);
    const warning = daysSince > 7 ? ' [neglected]' : '';
    return ` ${p.name} - Health: [${healthBar}] ${p.pondHealth}% - ${daysSince}d ago${warning}`;
  }).join('\n');
}