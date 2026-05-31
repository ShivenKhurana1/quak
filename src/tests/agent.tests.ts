// Agent behavior tests
import { describe, it, expect } from 'vitest';
import { runAgent } from '../agent.js';
import { Storage } from '../storage.js';

describe('Agent Behavior', () => {
  it.skip('should respect max steps limit (requires LLM)', async () => {
    const storage = new Storage();
    const messages = [{ role: 'user' as const, content: 'Do many things' }];
    
    const chunks: string[] = [];
    for await (const chunk of runAgent({
      storage,
      projectDir: process.cwd(),
      messages,
      mode: 'agent',
      sessionId: 'test-session',
      maxStepsOverride: 5,
    })) {
      chunks.push(chunk);
    }

    // Verify it stopped at max steps
    expect(chunks.some(c => c.includes('Reached 5 tool steps'))).toBe(true);
  });

  it.skip('should filter tools based on mode (requires LLM)', async () => {
    const storage = new Storage();
    const messages = [{ role: 'user' as const, content: 'Hello' }];
    
    const chunks: string[] = [];
    for await (const chunk of runAgent({
      storage,
      projectDir: process.cwd(),
      messages,
      mode: 'chat',
      sessionId: 'test-session',
    })) {
      chunks.push(chunk);
    }

    // Chat mode should not have certain tools
    // Verify tool filtering worked
  });
});