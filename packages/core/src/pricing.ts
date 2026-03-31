import type { ModelPricing } from './types';

/**
 * Built-in pricing data — microdollars per million tokens.
 * e.g. $2.50 per 1M tokens = 2_500_000 microdollars per 1M tokens
 */
const PRICING: Record<string, Record<string, ModelPricing>> = {
  openai: {
    'gpt-4o': {
      inputPricePerMToken: 2_500_000,
      outputPricePerMToken: 10_000_000,
      cachedInputPricePerMToken: 1_250_000,
    },
    'gpt-4o-mini': {
      inputPricePerMToken: 150_000,
      outputPricePerMToken: 600_000,
      cachedInputPricePerMToken: 75_000,
    },
    'gpt-4.1': {
      inputPricePerMToken: 2_000_000,
      outputPricePerMToken: 8_000_000,
      cachedInputPricePerMToken: 500_000,
    },
    'gpt-4.1-mini': {
      inputPricePerMToken: 400_000,
      outputPricePerMToken: 1_600_000,
      cachedInputPricePerMToken: 100_000,
    },
    o1: {
      inputPricePerMToken: 15_000_000,
      outputPricePerMToken: 60_000_000,
      reasoningPricePerMToken: 60_000_000,
      cachedInputPricePerMToken: 7_500_000,
    },
    'o3-mini': {
      inputPricePerMToken: 1_100_000,
      outputPricePerMToken: 4_400_000,
      reasoningPricePerMToken: 4_400_000,
      cachedInputPricePerMToken: 550_000,
    },
  },
  anthropic: {
    'claude-sonnet-4-20250514': {
      inputPricePerMToken: 3_000_000,
      outputPricePerMToken: 15_000_000,
      cachedInputPricePerMToken: 300_000,
    },
    'claude-haiku-4-5-20251001': {
      inputPricePerMToken: 800_000,
      outputPricePerMToken: 4_000_000,
      cachedInputPricePerMToken: 80_000,
    },
    'claude-opus-4-20250514': {
      inputPricePerMToken: 15_000_000,
      outputPricePerMToken: 75_000_000,
      cachedInputPricePerMToken: 1_500_000,
    },
  },
};

export function getModelPricing(
  provider: string,
  model: string,
): ModelPricing | undefined {
  const providerPricing = PRICING[provider];
  if (!providerPricing) return undefined;

  // Exact match first
  if (providerPricing[model]) return providerPricing[model];

  // Prefix match: e.g. "gpt-4o-mini-2024-07-18" → "gpt-4o-mini"
  for (const key of Object.keys(providerPricing)) {
    if (model.startsWith(key)) return providerPricing[key];
  }

  return undefined;
}
