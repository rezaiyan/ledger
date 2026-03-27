import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { parseConversation } from './jsonl.js';
import type { RawEntry, AssistantEntry } from '../../src/types.js';

describe('parseConversation Integration Tests', () => {
  let tempDir: string;
  let testFile: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ledger-test-'));
    testFile = path.join(tempDir, 'test-session.jsonl');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should parse a single conversation with basic usage', async () => {
    const entries = [
      {
        type: 'user',
        message: { content: 'Hello' },
        timestamp: new Date('2026-03-27T10:00:00Z').toISOString(),
      },
      {
        type: 'assistant',
        message: {
          model: 'claude-opus-4-6',
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_creation: undefined,
            cache_creation_input_tokens: undefined,
            cache_read_input_tokens: 0,
          },
        },
        timestamp: new Date('2026-03-27T10:00:05Z').toISOString(),
      },
    ];

    await fs.writeFile(testFile, entries.map((e) => JSON.stringify(e)).join('\n'));

    const result = await parseConversation(testFile, tempDir);

    expect(result).not.toBeNull();
    expect(result!.inputTokens).toBe(100);
    expect(result!.outputTokens).toBe(50);
    expect(result!.model).toBe('claude-opus-4-6');
    // Cost: 100/1M * 15 + 50/1M * 75 = 0.0015 + 0.00375 = 0.00525
    expect(result!.totalCost).toBeCloseTo(0.00525, 6);
  });

  it('should aggregate costs across multiple assistant messages', async () => {
    const entries = [
      {
        type: 'user',
        message: { content: 'Message 1' },
        timestamp: new Date('2026-03-27T10:00:00Z').toISOString(),
      },
      {
        type: 'assistant',
        message: {
          model: 'claude-opus-4-6',
          usage: {
            input_tokens: 1_000_000,
            output_tokens: 500_000,
            cache_creation: undefined,
            cache_creation_input_tokens: undefined,
            cache_read_input_tokens: 0,
          },
        },
        timestamp: new Date('2026-03-27T10:00:05Z').toISOString(),
      },
      {
        type: 'user',
        message: { content: 'Message 2' },
        timestamp: new Date('2026-03-27T10:01:00Z').toISOString(),
      },
      {
        type: 'assistant',
        message: {
          model: 'claude-opus-4-6',
          usage: {
            input_tokens: 500_000,
            output_tokens: 250_000,
            cache_creation: undefined,
            cache_creation_input_tokens: undefined,
            cache_read_input_tokens: 0,
          },
        },
        timestamp: new Date('2026-03-27T10:01:05Z').toISOString(),
      },
    ];

    await fs.writeFile(testFile, entries.map((e) => JSON.stringify(e)).join('\n'));

    const result = await parseConversation(testFile, tempDir);

    expect(result).not.toBeNull();
    expect(result!.inputTokens).toBe(1_500_000);
    expect(result!.outputTokens).toBe(750_000);
    expect(result!.messages).toBe(4);
    // First call: 1M * 15 + 0.5M * 75 = 15 + 37.5 = 52.5
    // Second call: 0.5M * 15 + 0.25M * 75 = 7.5 + 18.75 = 26.25
    // Total: 78.75
    expect(result!.totalCost).toBeCloseTo(78.75, 2);
  });

  it('should calculate cache hit rate correctly', async () => {
    const entries = [
      {
        type: 'user',
        message: { content: 'Test' },
        timestamp: new Date('2026-03-27T10:00:00Z').toISOString(),
      },
      {
        type: 'assistant',
        message: {
          model: 'claude-haiku-4-5',
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_creation: undefined,
            cache_creation_input_tokens: 1_000_000, // write 1M
            cache_read_input_tokens: 2_000_000,     // read 2M
          },
        },
        timestamp: new Date('2026-03-27T10:00:05Z').toISOString(),
      },
    ];

    await fs.writeFile(testFile, entries.map((e) => JSON.stringify(e)).join('\n'));

    const result = await parseConversation(testFile, tempDir);

    expect(result).not.toBeNull();
    expect(result!.cacheCreationTokens).toBe(1_000_000);
    expect(result!.cacheReadTokens).toBe(2_000_000);
    // Hit rate: 2M / (1M + 2M) = 0.667
    expect(result!.cacheHitRate).toBeCloseTo(0.667, 2);
  });

  it('should handle mixed model usage', async () => {
    const entries = [
      {
        type: 'user',
        message: { content: 'Test' },
        timestamp: new Date('2026-03-27T10:00:00Z').toISOString(),
      },
      {
        type: 'assistant',
        message: {
          model: 'claude-haiku-4-5',
          usage: {
            input_tokens: 1_000_000,
            output_tokens: 1_000_000,
            cache_creation: undefined,
            cache_creation_input_tokens: undefined,
            cache_read_input_tokens: 0,
          },
        },
        timestamp: new Date('2026-03-27T10:00:05Z').toISOString(),
      },
      {
        type: 'user',
        message: { content: 'Continue' },
        timestamp: new Date('2026-03-27T10:01:00Z').toISOString(),
      },
      {
        type: 'assistant',
        message: {
          model: 'claude-opus-4-6',
          usage: {
            input_tokens: 1_000_000,
            output_tokens: 1_000_000,
            cache_creation: undefined,
            cache_creation_input_tokens: undefined,
            cache_read_input_tokens: 0,
          },
        },
        timestamp: new Date('2026-03-27T10:01:05Z').toISOString(),
      },
    ];

    await fs.writeFile(testFile, entries.map((e) => JSON.stringify(e)).join('\n'));

    const result = await parseConversation(testFile, tempDir);

    expect(result).not.toBeNull();
    // Model should be the last one used
    expect(result!.model).toBe('claude-opus-4-6');
    // Cost: Haiku (0.80 + 4.00 = 4.80) + Opus (15 + 75 = 90) = 94.80
    expect(result!.totalCost).toBeCloseTo(94.80, 2);
  });

  it('should handle cache creation with 1h/5m breakdown', async () => {
    const entries = [
      {
        type: 'user',
        message: { content: 'Test' },
        timestamp: new Date('2026-03-27T10:00:00Z').toISOString(),
      },
      {
        type: 'assistant',
        message: {
          model: 'claude-sonnet-4-6',
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_creation: {
              ephemeral_1h_input_tokens: 500_000,
              ephemeral_5m_input_tokens: 500_000,
            },
            cache_creation_input_tokens: undefined,
            cache_read_input_tokens: 0,
          },
        },
        timestamp: new Date('2026-03-27T10:00:05Z').toISOString(),
      },
    ];

    await fs.writeFile(testFile, entries.map((e) => JSON.stringify(e)).join('\n'));

    const result = await parseConversation(testFile, tempDir);

    expect(result).not.toBeNull();
    expect(result!.cacheCreationTokens).toBe(1_000_000);
    // Cost: input 100, output 50, cache write 1h (0.5M * 3.00 * 3.75 = 5.625),
    // cache write 5m (0.5M * 3.00 * 1.25 = 1.875)
    // Total: 100/1M * 3 + 50/1M * 15 + 5.625 + 1.875 = 0.0003 + 0.00075 + 7.5 = ~7.5
    expect(result!.totalCost).toBeCloseTo(7.5, 1);
  });

  it('should extract title from first user message', async () => {
    const entries = [
      {
        type: 'user',
        message: { content: 'Fix the authentication bug in the login flow' },
        timestamp: new Date('2026-03-27T10:00:00Z').toISOString(),
      },
      {
        type: 'assistant',
        message: {
          model: 'claude-haiku-4-5',
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_creation: undefined,
            cache_creation_input_tokens: undefined,
            cache_read_input_tokens: 0,
          },
        },
        timestamp: new Date('2026-03-27T10:00:05Z').toISOString(),
      },
    ];

    await fs.writeFile(testFile, entries.map((e) => JSON.stringify(e)).join('\n'));

    const result = await parseConversation(testFile, tempDir);

    expect(result).not.toBeNull();
    expect(result!.title).toBe('Fix the authentication bug in the login flow');
  });

  it('should truncate long titles', async () => {
    const longTitle = 'a'.repeat(150);
    const entries = [
      {
        type: 'user',
        message: { content: longTitle },
        timestamp: new Date('2026-03-27T10:00:00Z').toISOString(),
      },
      {
        type: 'assistant',
        message: {
          model: 'claude-haiku-4-5',
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_creation: undefined,
            cache_creation_input_tokens: undefined,
            cache_read_input_tokens: 0,
          },
        },
        timestamp: new Date('2026-03-27T10:00:05Z').toISOString(),
      },
    ];

    await fs.writeFile(testFile, entries.map((e) => JSON.stringify(e)).join('\n'));

    const result = await parseConversation(testFile, tempDir);

    expect(result).not.toBeNull();
    expect(result!.title.length).toBeLessThanOrEqual(120);
    expect(result!.title).toMatch(/…$/); // Should end with ellipsis
  });

  it('should handle malformed JSON lines gracefully', async () => {
    const entries = [
      {
        type: 'user',
        message: { content: 'Test' },
        timestamp: new Date('2026-03-27T10:00:00Z').toISOString(),
      },
      'this is not valid JSON',
      {
        type: 'assistant',
        message: {
          model: 'claude-haiku-4-5',
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_creation: undefined,
            cache_creation_input_tokens: undefined,
            cache_read_input_tokens: 0,
          },
        },
        timestamp: new Date('2026-03-27T10:00:05Z').toISOString(),
      },
    ];

    await fs.writeFile(
      testFile,
      entries.map((e) => (typeof e === 'string' ? e : JSON.stringify(e))).join('\n')
    );

    const result = await parseConversation(testFile, tempDir);

    // Should still parse successfully, skipping the malformed line
    expect(result).not.toBeNull();
    expect(result!.inputTokens).toBe(100);
  });

  it('should return null for files with no assistant messages', async () => {
    const entries = [
      {
        type: 'user',
        message: { content: 'Just a question' },
        timestamp: new Date('2026-03-27T10:00:00Z').toISOString(),
      },
    ];

    await fs.writeFile(testFile, entries.map((e) => JSON.stringify(e)).join('\n'));

    const result = await parseConversation(testFile, tempDir);

    expect(result).toBeNull();
  });

  it('should return null for non-existent files', async () => {
    const nonExistentFile = path.join(tempDir, 'does-not-exist.jsonl');

    const result = await parseConversation(nonExistentFile, tempDir);

    expect(result).toBeNull();
  });

  it('should calculate correct duration in minutes', async () => {
    const entries = [
      {
        type: 'user',
        message: { content: 'Start' },
        timestamp: new Date('2026-03-27T10:00:00Z').toISOString(),
      },
      {
        type: 'assistant',
        message: {
          model: 'claude-haiku-4-5',
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_creation: undefined,
            cache_creation_input_tokens: undefined,
            cache_read_input_tokens: 0,
          },
        },
        // 30 minutes later
        timestamp: new Date('2026-03-27T10:30:00Z').toISOString(),
      },
    ];

    await fs.writeFile(testFile, entries.map((e) => JSON.stringify(e)).join('\n'));

    const result = await parseConversation(testFile, tempDir);

    expect(result).not.toBeNull();
    expect(result!.durationMin).toBe(30);
  });

  it('should extract project slug from file path', async () => {
    const projectDir = path.join(tempDir, '-home-ali-projects-myapp');
    await fs.mkdir(projectDir, { recursive: true });
    const sessionFile = path.join(projectDir, 'session-uuid.jsonl');

    const entries = [
      {
        type: 'user',
        message: { content: 'Test' },
        timestamp: new Date('2026-03-27T10:00:00Z').toISOString(),
      },
      {
        type: 'assistant',
        message: {
          model: 'claude-haiku-4-5',
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_creation: undefined,
            cache_creation_input_tokens: undefined,
            cache_read_input_tokens: 0,
          },
        },
        timestamp: new Date('2026-03-27T10:00:05Z').toISOString(),
      },
    ];

    await fs.writeFile(sessionFile, entries.map((e) => JSON.stringify(e)).join('\n'));

    const result = await parseConversation(sessionFile, tempDir);

    expect(result).not.toBeNull();
    expect(result!.projectSlug).toBe('-home-ali-projects-myapp');
  });
});
