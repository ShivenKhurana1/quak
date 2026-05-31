import { Storage } from './storage.js';
import type { PermissionMode } from './permissions.js';

export type UiMode = 'agent' | 'chat' | 'plan' | 'dontAsk';

const UI_TO_PERMISSION: Record<UiMode, PermissionMode> = {
  agent: 'acceptEdits',
  chat: 'default',
  plan: 'plan',
  dontAsk: 'dontAsk',
};

export function syncPermissionModeForUi(storage: Storage, uiMode: UiMode): void {
  const settings = storage.loadSettings();
  settings.permissions.mode = UI_TO_PERMISSION[uiMode];
  storage.saveSettings(settings);
}

export function getPermissionModeLabel(storage: Storage): string {
  return storage.loadPermissions().mode;
}
