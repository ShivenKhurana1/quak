import { Storage, ProviderConfig } from './storage.js';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGroq } from '@ai-sdk/groq';

export function setActiveProvider(storage: Storage, name: string): void {
  const state = storage.loadState();
  state.currentProject = name; // reusing currentProject for active provider for now
  storage.saveState(state);
}

export function getActiveProviderName(storage: Storage): string {
  const provider = storage.getActiveProvider();
  return provider ? provider.name : '';
}

export function getLLM(storage: Storage) {
  const provider = storage.getActiveProvider();

  if (!provider) {
    throw new Error('No provider configured. Run /provider add first!');
  }

  switch (provider.type) {
    case 'openai':
      return createOpenAI({ apiKey: provider.apiKey })(provider.model);
    case 'anthropic':
      return createAnthropic({ apiKey: provider.apiKey })(provider.model);
    case 'groq':
      return createGroq({ apiKey: provider.apiKey })(provider.model);
    case 'ollama':
      return createOpenAI({
        baseURL: provider.baseUrl || 'http://localhost:11434/v1',
        apiKey: 'dummy',
      })(provider.model);
    default:
      throw new Error(`Unknown provider type: ${provider.type}`);
  }
}

export function addProvider(storage: Storage, config: ProviderConfig): void {
  const providers = storage.loadProviders();
  const existing = providers.findIndex(p => p.name === config.name);
  if (existing >= 0) {
    providers[existing] = config;
  } else {
    providers.push(config);
  }
  storage.saveProviders(providers);
  const active = getActiveProviderName(storage);
  if (!active) setActiveProvider(storage, config.name);
}

export function removeProvider(storage: Storage, name: string): boolean {
  const providers = storage.loadProviders();
  const idx = providers.findIndex(p => p.name === name);
  if (idx < 0) return false;
  providers.splice(idx, 1);
  storage.saveProviders(providers);
  const active = getActiveProviderName(storage);
  if (active === name && providers.length > 0) {
    setActiveProvider(storage, providers[0].name);
  }
  return true;
}

export function listProviders(storage: Storage): string {
  const providers = storage.loadProviders();
  if (providers.length === 0) return 'No providers configured. Run /provider add';
  const active = getActiveProviderName(storage);
  return providers.map(p => {
    const isActive = p.name === active ? ' ← active' : '';
    return `${p.name} (${p.type}/${p.model})${isActive}`;
  }).join('\n');
}