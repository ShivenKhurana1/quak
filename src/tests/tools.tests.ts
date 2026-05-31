import { describe, it, expect } from 'vitest';
import { createTools } from '../tools/index.js';

describe('Tool Creation', () => {
  it('should create tool definitions', async () => {
    const mockStorage = {
      loadShellSettings: () => ({ defaultTimeoutMs: 120000, backgroundWaitMs: 12000, installTimeoutMs: 600000 }),
      loadState: () => ({ totalToolCalls: 0, lastActive: Date.now() }),
      saveState: () => {},
      loadAgentSettings: () => ({ lintOnEdit: false, maxSteps: 50, maxHistoryMessages: 40, maxHistoryTokens: 32000, subAgentMaxSteps: 15 }),
      appendMemory: () => {},
    } as any;
    const mockPermissions = { mode: 'acceptEdits', allow: [], ask: [], deny: [] } as any;
    const mockWorkflow = { markRead: () => {}, hasRead: () => false, canEdit: () => true } as any;
    const tools = await createTools(mockStorage, '/tmp', mockPermissions, 'test', 'p1', mockWorkflow);
    expect(tools.readFile).toBeDefined();
    expect(tools.editFile).toBeDefined();
    expect(tools.runCommand).toBeDefined();
  });
});