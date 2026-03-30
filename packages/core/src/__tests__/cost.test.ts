import { describe, it, expect } from 'vitest';
import { calculateCostMicrodollars } from '../cost';
import type { ModelPricing, TokenUsage } from '../types';

describe('calculateCostMicrodollars', () => {
  const gpt4oPricing: ModelPricing = {
    inputPricePerMToken: 2_500_000, // $2.50 per 1M tokens
    outputPricePerMToken: 10_000_000, // $10.00 per 1M tokens
    cachedInputPricePerMToken: 1_250_000, // $1.25 per 1M tokens
  };

  it('calculates cost for basic input/output tokens', () => {
    const usage: TokenUsage = {
      inputTokens: 1000,
      outputTokens: 500,
    };

    // input: 1000 * 2_500_000 / 1_000_000 = 2500 microdollars
    // output: 500 * 10_000_000 / 1_000_000 = 5000 microdollars
    // total = 7500 microdollars = $0.0075
    const result = calculateCostMicrodollars(usage, gpt4oPricing);
    expect(result).toBe(7500);
  });

  it('handles zero tokens', () => {
    const usage: TokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
    };
    expect(calculateCostMicrodollars(usage, gpt4oPricing)).toBe(0);
  });

  it('applies cached token discount', () => {
    const usage: TokenUsage = {
      inputTokens: 1000,
      outputTokens: 0,
      cachedTokens: 800,
    };

    // effective input = 1000 - 800 = 200
    // input cost: 200 * 2_500_000 / 1_000_000 = 500
    // cached cost: 800 * 1_250_000 / 1_000_000 = 1000
    // total = 1500
    const result = calculateCostMicrodollars(usage, gpt4oPricing);
    expect(result).toBe(1500);
  });

  it('handles reasoning tokens', () => {
    const o1Pricing: ModelPricing = {
      inputPricePerMToken: 15_000_000,
      outputPricePerMToken: 60_000_000,
      reasoningPricePerMToken: 60_000_000,
    };

    const usage: TokenUsage = {
      inputTokens: 100,
      outputTokens: 50,
      reasoningTokens: 200,
    };

    // input: 100 * 15_000_000 / 1_000_000 = 1500
    // output: 50 * 60_000_000 / 1_000_000 = 3000
    // reasoning: 200 * 60_000_000 / 1_000_000 = 12000
    // total = 16500
    const result = calculateCostMicrodollars(usage, o1Pricing);
    expect(result).toBe(16500);
  });

  it('uses integer arithmetic (no floating point drift)', () => {
    // This test ensures we don't have floating point issues
    // e.g., 0.1 + 0.2 !== 0.3 in floating point
    const usage: TokenUsage = {
      inputTokens: 333,
      outputTokens: 777,
    };

    const result = calculateCostMicrodollars(usage, gpt4oPricing);

    // input: 333 * 2_500_000 = 832_500_000 / 1_000_000 = 833 (rounded)
    // output: 777 * 10_000_000 = 7_770_000_000 / 1_000_000 = 7770
    // total = 8603
    expect(result).toBe(8603);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('calculates claude-sonnet-4 correctly', () => {
    const pricing: ModelPricing = {
      inputPricePerMToken: 3_000_000,
      outputPricePerMToken: 15_000_000,
      cachedInputPricePerMToken: 300_000,
    };

    const usage: TokenUsage = {
      inputTokens: 2000,
      outputTokens: 1000,
    };

    // input: 2000 * 3_000_000 / 1_000_000 = 6000
    // output: 1000 * 15_000_000 / 1_000_000 = 15000
    // total = 21000 microdollars = $0.021
    const result = calculateCostMicrodollars(usage, pricing);
    expect(result).toBe(21000);
  });

  it('handles large token counts without overflow', () => {
    const usage: TokenUsage = {
      inputTokens: 100_000,
      outputTokens: 50_000,
    };

    const result = calculateCostMicrodollars(usage, gpt4oPricing);

    // input: 100000 * 2_500_000 / 1_000_000 = 250_000
    // output: 50000 * 10_000_000 / 1_000_000 = 500_000
    // total = 750_000 microdollars = $0.75
    expect(result).toBe(750_000);
  });

  it('falls back to output price for reasoning when no reasoning price', () => {
    const pricing: ModelPricing = {
      inputPricePerMToken: 3_000_000,
      outputPricePerMToken: 15_000_000,
    };

    const usage: TokenUsage = {
      inputTokens: 100,
      outputTokens: 50,
      reasoningTokens: 100,
    };

    // reasoning uses outputPricePerMToken as fallback
    // input: 100 * 3_000_000 / 1_000_000 = 300
    // output: 50 * 15_000_000 / 1_000_000 = 750
    // reasoning: 100 * 15_000_000 / 1_000_000 = 1500
    // total = 2550
    const result = calculateCostMicrodollars(usage, pricing);
    expect(result).toBe(2550);
  });
});
