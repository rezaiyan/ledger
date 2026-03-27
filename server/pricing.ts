import type { ModelPricing, UsageData } from '../src/types.js';

// Base input/output prices per 1M tokens (USD)
const BASE_PRICES: Record<string, { input: number; output: number }> = {
  'claude-opus-4-6':           { input: 15.00, output: 75.00 },
  'claude-opus-4-5':           { input: 15.00, output: 75.00 },
  'claude-sonnet-4-6':         { input: 3.00,  output: 15.00 },
  'claude-sonnet-4-5':         { input: 3.00,  output: 15.00 },
  'claude-haiku-4-5':          { input: 0.80,  output: 4.00  },
  'claude-haiku-4-5-20251001': { input: 0.80,  output: 4.00  },
};

// Fallback pricing (sonnet-level) for unknown models
const FALLBACK: { input: number; output: number } = { input: 3.00, output: 15.00 };

// Cache pricing multipliers
const CACHE_WRITE_1H_MULTIPLIER = 3.75;
const CACHE_WRITE_5M_MULTIPLIER = 1.25;
const CACHE_READ_MULTIPLIER = 0.10;

export const ALL_MODELS: string[] = Object.keys(BASE_PRICES);

export function getPricing(model: string): ModelPricing {
  // Try exact match first
  let base = BASE_PRICES[model];

  // Try prefix match (e.g. "claude-sonnet-4-6-20251031" → "claude-sonnet-4-6")
  if (!base) {
    const matchedKey = Object.keys(BASE_PRICES).find((key) =>
      model.startsWith(key)
    );
    if (matchedKey) {
      base = BASE_PRICES[matchedKey];
    }
  }

  if (!base) {
    base = FALLBACK;
  }

  return {
    inputPerMToken:        base.input,
    outputPerMToken:       base.output,
    cacheWrite1hPerMToken: base.input * CACHE_WRITE_1H_MULTIPLIER,
    cacheWrite5mPerMToken: base.input * CACHE_WRITE_5M_MULTIPLIER,
    cacheReadPerMToken:    base.input * CACHE_READ_MULTIPLIER,
  };
}

export function calculateCost(usage: UsageData, model: string): number {
  const pricing = getPricing(model);

  const inputCost =
    (usage.input_tokens / 1_000_000) * pricing.inputPerMToken;

  const outputCost =
    (usage.output_tokens / 1_000_000) * pricing.outputPerMToken;

  // Cache creation — prefer the detailed breakdown, fall back to the
  // rolled-up `cache_creation_input_tokens` field (treated as 1h).
  let cacheWriteCost = 0;
  if (usage.cache_creation) {
    const { ephemeral_1h_input_tokens, ephemeral_5m_input_tokens } =
      usage.cache_creation;
    cacheWriteCost =
      (ephemeral_1h_input_tokens / 1_000_000) *
        pricing.cacheWrite1hPerMToken +
      (ephemeral_5m_input_tokens / 1_000_000) *
        pricing.cacheWrite5mPerMToken;
  } else if (usage.cache_creation_input_tokens) {
    cacheWriteCost =
      (usage.cache_creation_input_tokens / 1_000_000) *
      pricing.cacheWrite1hPerMToken;
  }

  const cacheReadCost =
    ((usage.cache_read_input_tokens ?? 0) / 1_000_000) *
    pricing.cacheReadPerMToken;

  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}
