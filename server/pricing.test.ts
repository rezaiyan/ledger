import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getPricing, calculateCost, ALL_MODELS } from './pricing.js';
import type { UsageData } from '../src/types.js';

describe('getPricing', () => {
  it('should return exact pricing for known models', () => {
    const opusPricing = getPricing('claude-opus-4-6');
    expect(opusPricing.inputPerMToken).toBe(15.00);
    expect(opusPricing.outputPerMToken).toBe(75.00);
  });

  it('should return sonnet pricing for claude-sonnet-4-6', () => {
    const sonnetPricing = getPricing('claude-sonnet-4-6');
    expect(sonnetPricing.inputPerMToken).toBe(3.00);
    expect(sonnetPricing.outputPerMToken).toBe(15.00);
  });

  it('should return haiku pricing for claude-haiku-4-5', () => {
    const haikuPricing = getPricing('claude-haiku-4-5');
    expect(haikuPricing.inputPerMToken).toBe(0.80);
    expect(haikuPricing.outputPerMToken).toBe(4.00);
  });

  it('should support prefix matching for versioned models', () => {
    const versionedPricing = getPricing('claude-sonnet-4-6-20250326');
    expect(versionedPricing.inputPerMToken).toBe(3.00);
    expect(versionedPricing.outputPerMToken).toBe(15.00);
  });

  it('should return fallback pricing for unknown models', () => {
    const unknownPricing = getPricing('unknown-model-xyz');
    expect(unknownPricing.inputPerMToken).toBe(3.00); // sonnet-level fallback
    expect(unknownPricing.outputPerMToken).toBe(15.00);
  });

  it('should calculate cache write 1h multiplier correctly', () => {
    const pricing = getPricing('claude-opus-4-6');
    expect(pricing.cacheWrite1hPerMToken).toBe(15.00 * 3.75);
  });

  it('should calculate cache write 5m multiplier correctly', () => {
    const pricing = getPricing('claude-opus-4-6');
    expect(pricing.cacheWrite5mPerMToken).toBe(15.00 * 1.25);
  });

  it('should calculate cache read multiplier correctly', () => {
    const pricing = getPricing('claude-opus-4-6');
    expect(pricing.cacheReadPerMToken).toBe(15.00 * 0.10);
  });

  it('should have all expected base models in ALL_MODELS', () => {
    expect(ALL_MODELS).toContain('claude-opus-4-6');
    expect(ALL_MODELS).toContain('claude-sonnet-4-6');
    expect(ALL_MODELS).toContain('claude-haiku-4-5');
  });
});

describe('calculateCost', () => {
  it('should calculate basic input/output costs', () => {
    const usage: UsageData = {
      input_tokens: 1_000_000,      // 1M tokens
      output_tokens: 1_000_000,     // 1M tokens
      cache_creation: undefined,
      cache_creation_input_tokens: undefined,
      cache_read_input_tokens: 0,
    };

    const cost = calculateCost(usage, 'claude-opus-4-6');
    // 1M input @ $15/M + 1M output @ $75/M = $90
    expect(cost).toBe(90.00);
  });

  it('should calculate cost for haiku model', () => {
    const usage: UsageData = {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_creation: undefined,
      cache_creation_input_tokens: undefined,
      cache_read_input_tokens: 0,
    };

    const cost = calculateCost(usage, 'claude-haiku-4-5');
    // 1M input @ $0.80/M + 1M output @ $4.00/M = $4.80
    expect(cost).toBe(4.80);
  });

  it('should handle zero tokens', () => {
    const usage: UsageData = {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation: undefined,
      cache_creation_input_tokens: undefined,
      cache_read_input_tokens: 0,
    };

    const cost = calculateCost(usage, 'claude-opus-4-6');
    expect(cost).toBe(0);
  });

  it('should include cache read costs', () => {
    const usage: UsageData = {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation: undefined,
      cache_creation_input_tokens: undefined,
      cache_read_input_tokens: 1_000_000, // 1M cache read tokens
    };

    const cost = calculateCost(usage, 'claude-opus-4-6');
    // 1M @ (15 * 0.10) = $1.50
    expect(cost).toBe(1.50);
  });

  it('should include cache write costs with 1h breakdown', () => {
    const usage: UsageData = {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation: {
        ephemeral_1h_input_tokens: 1_000_000,
        ephemeral_5m_input_tokens: 0,
      },
      cache_creation_input_tokens: undefined,
      cache_read_input_tokens: 0,
    };

    const cost = calculateCost(usage, 'claude-opus-4-6');
    // 1M @ (15 * 3.75) = $56.25
    expect(cost).toBe(56.25);
  });

  it('should include cache write costs with 5m breakdown', () => {
    const usage: UsageData = {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation: {
        ephemeral_1h_input_tokens: 0,
        ephemeral_5m_input_tokens: 1_000_000,
      },
      cache_creation_input_tokens: undefined,
      cache_read_input_tokens: 0,
    };

    const cost = calculateCost(usage, 'claude-opus-4-6');
    // 1M @ (15 * 1.25) = $18.75
    expect(cost).toBe(18.75);
  });

  it('should handle mixed 1h and 5m cache writes', () => {
    const usage: UsageData = {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation: {
        ephemeral_1h_input_tokens: 1_000_000,
        ephemeral_5m_input_tokens: 1_000_000,
      },
      cache_creation_input_tokens: undefined,
      cache_read_input_tokens: 0,
    };

    const cost = calculateCost(usage, 'claude-opus-4-6');
    // (1M * 15 * 3.75) + (1M * 15 * 1.25) = $56.25 + $18.75 = $75
    expect(cost).toBe(75.00);
  });

  it('should fallback to cache_creation_input_tokens when cache_creation is undefined', () => {
    const usage: UsageData = {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation: undefined,
      cache_creation_input_tokens: 1_000_000, // old field
      cache_read_input_tokens: 0,
    };

    const cost = calculateCost(usage, 'claude-opus-4-6');
    // 1M @ (15 * 3.75) = $56.25 (treated as 1h)
    expect(cost).toBe(56.25);
  });

  it('should include all cost components together', () => {
    const usage: UsageData = {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_creation: {
        ephemeral_1h_input_tokens: 1_000_000,
        ephemeral_5m_input_tokens: 0,
      },
      cache_creation_input_tokens: undefined,
      cache_read_input_tokens: 1_000_000,
    };

    const cost = calculateCost(usage, 'claude-opus-4-6');
    // Input: 1M @ $15 = $15
    // Output: 1M @ $75 = $75
    // Cache write 1h: 1M @ $56.25 = $56.25
    // Cache read: 1M @ $1.50 = $1.50
    // Total: $147.75
    expect(cost).toBe(147.75);
  });

  it('should work with small token counts', () => {
    const usage: UsageData = {
      input_tokens: 100,
      output_tokens: 50,
      cache_creation: undefined,
      cache_creation_input_tokens: undefined,
      cache_read_input_tokens: 0,
    };

    const cost = calculateCost(usage, 'claude-haiku-4-5');
    // Input: 100/1M @ $0.80 = $0.00008
    // Output: 50/1M @ $4.00 = $0.0002
    // Total: $0.00028
    expect(cost).toBeCloseTo(0.00028, 8);
  });

  it('should handle large token counts', () => {
    const usage: UsageData = {
      input_tokens: 100_000_000, // 100M
      output_tokens: 50_000_000,  // 50M
      cache_creation: undefined,
      cache_creation_input_tokens: undefined,
      cache_read_input_tokens: 0,
    };

    const cost = calculateCost(usage, 'claude-opus-4-6');
    // Input: 100M @ $15/M = $1500
    // Output: 50M @ $75/M = $3750
    // Total: $5250
    expect(cost).toBe(5250);
  });
});
