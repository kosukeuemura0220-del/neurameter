import type { ModelPricing, TokenUsage } from './types';

/**
 * Calculate cost in microdollars using integer arithmetic only.
 *
 * Pricing values are stored as microdollars per million tokens.
 * Formula: tokens * pricePerMToken / 1_000_000
 * (result is already in microdollars since price is in microdollars)
 *
 * To avoid floating-point, we compute:
 *   cost = Math.round(tokens * pricePerMToken / 1_000_000)
 *
 * Since pricePerMToken is already an integer (microdollars per 1M tokens),
 * and tokens is an integer, the only division is by 1_000_000.
 * We use Math.round to get the nearest integer microdollar.
 */
export function calculateCostMicrodollars(
  usage: TokenUsage,
  pricing: ModelPricing,
): number {
  let totalMicrodollars = 0;

  // Input tokens cost
  const effectiveInputTokens = usage.inputTokens - (usage.cachedTokens ?? 0);
  if (effectiveInputTokens > 0) {
    totalMicrodollars += integerDivRound(
      effectiveInputTokens * pricing.inputPricePerMToken,
      1_000_000,
    );
  }

  // Cached tokens cost (discounted rate)
  if (usage.cachedTokens && usage.cachedTokens > 0) {
    const cachedPrice = pricing.cachedInputPricePerMToken ?? pricing.inputPricePerMToken;
    totalMicrodollars += integerDivRound(
      usage.cachedTokens * cachedPrice,
      1_000_000,
    );
  }

  // Output tokens cost
  if (usage.outputTokens > 0) {
    totalMicrodollars += integerDivRound(
      usage.outputTokens * pricing.outputPricePerMToken,
      1_000_000,
    );
  }

  // Reasoning tokens cost
  if (usage.reasoningTokens && usage.reasoningTokens > 0) {
    const reasoningPrice = pricing.reasoningPricePerMToken ?? pricing.outputPricePerMToken;
    totalMicrodollars += integerDivRound(
      usage.reasoningTokens * reasoningPrice,
      1_000_000,
    );
  }

  return totalMicrodollars;
}

/**
 * Integer division with rounding (avoids floating-point).
 * Computes Math.round(numerator / denominator) using only integer ops.
 */
function integerDivRound(numerator: number, denominator: number): number {
  const quotient = Math.trunc(numerator / denominator);
  const remainder = numerator - quotient * denominator;
  // Round: if remainder >= half the denominator, round up
  if (remainder * 2 >= denominator) {
    return quotient + 1;
  }
  return quotient;
}
