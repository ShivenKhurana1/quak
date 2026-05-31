import { Storage, ProviderConfig } from './storage.js';

export interface ModelProvider {
  name: string;
  type: string;
  createModel: (config: ProviderConfig) => any;
}

const registry = new Map<string, ModelProvider>();

export function registerProvider(provider: ModelProvider): void {
  registry.set(provider.type, provider);
}

export function getProvider(type: string): ModelProvider | undefined {
  return registry.get(type);
}

export function listRegisteredProviders(): string[] {
  return [...registry.keys()];
}

export function setActiveProvider(storage: Storage, name: string): void {
  const state = storage.loadState();
  state.currentProject = name;
  storage.saveState(state);
}

export function getActiveProviderName(storage: Storage): string {
  const provider = storage.getActiveProvider();
  return provider ? provider.name : '';
}

export function getLLM(storage: Storage) {
  const config = storage.getActiveProvider();
  if (!config) throw new Error('No provider configured. Run /provider add first!');

  const provider = registry.get(config.type);
  if (!provider) throw new Error(`Unknown provider type: ${config.type}. Registered: ${listRegisteredProviders().join(', ')}`);

  return provider.createModel(config);
}

export function addProvider(storage: Storage, config: ProviderConfig): void {
  const providers = storage.loadProviders();
  const existing = providers.findIndex(p => p.name === config.name);
  if (existing >= 0) providers[existing] = config;
  else providers.push(config);
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
  if (active === name && providers.length > 0) setActiveProvider(storage, providers[0].name);
  return true;
}

export function listProviders(storage: Storage): string {
  const providers = storage.loadProviders();
  if (providers.length === 0) return 'No providers configured. Run /provider add';
  const active = getActiveProviderName(storage);
  return providers.map(p => {
    const reg = registry.get(p.type);
    const status = reg ? '' : ' (unsupported type)';
    const isActive = p.name === active ? ' (active)' : '';
    return `${p.name} (${p.type}/${p.model})${isActive}${status}`;
  }).join('\n');
}

export function getLLMForRole(storage: Storage, role: 'main' | 'fast') {
  if (role === 'main') return getLLM(storage);
  const settings = storage.loadSettings() as any;
  const fastName = settings.agent?.fastProvider;
  if (!fastName) return getLLM(storage);
  const providers = storage.loadProviders();
  const fast = providers.find(p => p.name === fastName);
  if (!fast) return getLLM(storage);
  // Temporarily switch active provider
  const state = storage.loadState();
  const prev = state.currentProject;
  state.currentProject = fast.name;
  storage.saveState(state);
  const model = getLLM(storage);
  state.currentProject = prev;
  storage.saveState(state);
  return model;
}

// Register built-in providers
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGroq } from '@ai-sdk/groq';
import { createHuggingFace } from './huggingface.js';

registerProvider({
  name: 'OpenAI',
  type: 'openai',
  createModel: (config) => createOpenAI({ apiKey: config.apiKey })(config.model),
});

registerProvider({
  name: 'Anthropic',
  type: 'anthropic',
  createModel: (config) => createAnthropic({ apiKey: config.apiKey })(config.model),
});

registerProvider({
  name: 'Groq',
  type: 'groq',
  createModel: (config) => createGroq({ apiKey: config.apiKey })(config.model),
});

registerProvider({
  name: 'Ollama',
  type: 'ollama',
  createModel: (config) => createOpenAI({
    baseURL: config.baseUrl || 'http://localhost:11434/v1',
    apiKey: 'dummy',
  }).chat(config.model),
});

registerProvider({
  name: 'Hugging Face',
  type: 'huggingface',
  createModel: (config) => createHuggingFace({ apiKey: config.apiKey, baseUrl: config.baseUrl }).chat(config.model),
});