import type { ModelPricing } from './types';
import pricingData from './pricing-data.json' with { type: 'json' };

/**
 * Pricing data — microdollars per million tokens.
 *
 * The bulk of entries are auto-synced from LiteLLM's canonical catalog
 * (packages/core/src/pricing-data.json, regenerated via `pnpm sync:pricing`).
 * Manual overrides below take precedence when a model needs a custom price
 * (e.g. enterprise contract pricing, correction ahead of upstream sync).
 */
const MANUAL_OVERRIDES: Record<string, Record<string, ModelPricing>> = {
  // Add entries here to override the synced catalog.
  // Example:
  // openai: {
  //   'gpt-4o': { inputPricePerMToken: 2_500_000, outputPricePerMToken: 10_000_000 },
  // },
};

type PricingData = {
  _meta: { source: string; generatedAt: string; modelCount: number };
  pricing: Record<string, Record<string, ModelPricing>>;
};

const SYNCED = (pricingData as PricingData).pricing;

function mergeProvider(provider: string): Record<string, ModelPricing> {
  return {
    ...(SYNCED[provider] ?? {}),
    ...(MANUAL_OVERRIDES[provider] ?? {}),
  };
}

const PRICING: Record<string, Record<string, ModelPricing>> = {
  openai: mergeProvider('openai'),
  anthropic: mergeProvider('anthropic'),
  google: mergeProvider('google'),
  groq: mergeProvider('groq'),
  mistral: mergeProvider('mistral'),
};

export function getModelPricing(
  provider: string,
  model: string,
): ModelPricing | undefined {
  const providerPricing = PRICING[provider];
  if (!providerPricing) return undefined;

  // Exact match first
  if (providerPricing[model]) return providerPricing[model];

  // Longest-prefix match: e.g. "gpt-4o-mini-2024-07-18" → "gpt-4o-mini"
  // Sort keys by length desc so "gpt-4o-mini" wins over "gpt-4o".
  const keys = Object.keys(providerPricing).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (model.startsWith(key)) return providerPricing[key];
  }

  return undefined;
}

export const _pricingMeta = (pricingData as PricingData)._meta;
