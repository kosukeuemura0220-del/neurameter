#!/usr/bin/env node
// Sync pricing data from LiteLLM's canonical model price catalog.
// Source: https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json
//
// Usage: node scripts/sync-pricing.mjs

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const SOURCE_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, '../src/pricing-data.json');

// LiteLLM provider name → NeuraMeter provider key.
// Multiple LiteLLM providers can map to the same NeuraMeter provider.
const PROVIDER_MAP = {
  openai: 'openai',
  azure: 'openai',
  text_completion_openai: 'openai',
  anthropic: 'anthropic',
  bedrock: 'anthropic',
  'bedrock_converse': 'anthropic',
  vertex_ai: 'google',
  'vertex_ai-language-models': 'google',
  'vertex_ai-anthropic_models': 'anthropic',
  gemini: 'google',
  google: 'google',
  groq: 'groq',
  mistral: 'mistral',
  codestral: 'mistral',
};

// $/token → microdollars per million tokens
// e.g. 0.0000025 $/tok × 1e6 tok × 1e6 microdollar/$ = 2_500_000
const toMicroPerM = (usdPerToken) =>
  typeof usdPerToken === 'number' ? Math.round(usdPerToken * 1e12) : undefined;

async function main() {
  console.log(`[sync-pricing] Fetching ${SOURCE_URL}`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch LiteLLM pricing: ${res.status} ${res.statusText}`);
  }
  const raw = await res.json();

  const output = {};
  let count = 0;
  let skipped = 0;

  for (const [modelKey, entry] of Object.entries(raw)) {
    if (modelKey === 'sample_spec') continue;
    if (!entry || typeof entry !== 'object') continue;

    const litellmProvider = entry.litellm_provider;
    const provider = PROVIDER_MAP[litellmProvider];
    if (!provider) {
      skipped++;
      continue;
    }

    const mode = entry.mode;
    // Only keep chat/completion/embedding models — skip image/audio for now
    if (mode && !['chat', 'completion', 'embedding', 'responses'].includes(mode)) {
      skipped++;
      continue;
    }

    const input = toMicroPerM(entry.input_cost_per_token);
    const output_ = toMicroPerM(entry.output_cost_per_token);
    if (input === undefined || output_ === undefined) {
      skipped++;
      continue;
    }

    const cached = toMicroPerM(entry.cache_read_input_token_cost);
    const cacheWrite = toMicroPerM(entry.cache_creation_input_token_cost);
    const reasoning = toMicroPerM(
      entry.output_cost_per_reasoning_token ?? entry.reasoning_cost_per_token,
    );

    // Strip provider prefix from model key (e.g. "anthropic/claude-opus-4" → "claude-opus-4")
    const bareModel = modelKey.includes('/')
      ? modelKey.slice(modelKey.indexOf('/') + 1)
      : modelKey;

    const pricing = {
      inputPricePerMToken: input,
      outputPricePerMToken: output_,
    };
    if (cached !== undefined) pricing.cachedInputPricePerMToken = cached;
    if (cacheWrite !== undefined) pricing.cacheWritePricePerMToken = cacheWrite;
    if (reasoning !== undefined) pricing.reasoningPricePerMToken = reasoning;

    output[provider] ??= {};
    // Prefer exact provider-specified model; on collision, keep the first
    if (!output[provider][bareModel]) {
      output[provider][bareModel] = pricing;
      count++;
    }
  }

  const payload = {
    _meta: {
      source: SOURCE_URL,
      generatedAt: new Date().toISOString(),
      modelCount: count,
    },
    pricing: output,
  };

  await writeFile(OUT_PATH, JSON.stringify(payload, null, 2) + '\n');
  console.log(
    `[sync-pricing] Wrote ${count} models (skipped ${skipped}) to ${OUT_PATH}`,
  );
  for (const [p, models] of Object.entries(output)) {
    console.log(`  ${p}: ${Object.keys(models).length} models`);
  }
}

main().catch((err) => {
  console.error('[sync-pricing] Failed:', err);
  process.exit(1);
});
