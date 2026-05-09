import { Storage, ProviderConfig } from './storage.js';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGroq } from '@ai-sdk/groq';

let activeProvider: string = '';

export function setActiveProvider(name: string): void {
  activeProvider = name;
}

export function getActiveProviderName(): string {
  return activeProvider;
}

export function getLLM(storage: Storage) {
  const providers = storage.loadProviders();
  const provider = providers.find(p => p.name === activeProvider) || providers[0];

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
  if (!activeProvider) activeProvider = config.name;
}

export function removeProvider(storage: Storage, name: string): boolean {
  const providers = storage.loadProviders();
  const idx = providers.findIndex(p => p.name === name);
  if (idx < 0) return false;
  providers.splice(idx, 1);
  storage.saveProviders(providers);
  if (activeProvider === name && providers.length > 0) {
    activeProvider = providers[0].name;
  }
  return true;
}

export function listProviders(storage: Storage): string {
  const providers = storage.loadProviders();
  if (providers.length === 0) return 'No providers configured. Run /provider add';
  return providers.map(p => {
    const active = p.name === activeProvider ? ' ← active' : '';
    return `${p.name} (${p.type}/${p.model})${active}`;
  }).join('\n');
}