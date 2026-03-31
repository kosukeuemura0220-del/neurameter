import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { Serialized } from '@langchain/core/load/serializable';
import type { LLMResult } from '@langchain/core/outputs';
import type { NeuraMeter } from '@neurameter/core';
import { getModelPricing, calculateCostMicrodollars } from '@neurameter/core';
import type { MeterOptions } from './types';

/**
 * Maps LangChain provider names to NeuraMeter provider identifiers.
 */
function mapProvider(llmType: string): 'openai' | 'anthropic' | 'google' | 'other' {
  const normalized = llmType.toLowerCase();
  if (normalized.includes('openai') || normalized.includes('gpt') || normalized.includes('chatgpt')) {
    return 'openai';
  }
  if (normalized.includes('anthropic') || normalized.includes('claude')) {
    return 'anthropic';
  }
  if (normalized.includes('google') || normalized.includes('gemini') || normalized.includes('palm')) {
    return 'google';
  }
  return 'other';
}

/**
 * Extracts the model name from LangChain serialized metadata or invocation params.
 */
function extractModelName(
  serialized: Serialized,
  invocationParams?: Record<string, unknown>,
): string {
  // Try invocation params first (most reliable)
  if (invocationParams) {
    if (typeof invocationParams.model === 'string') return invocationParams.model;
    if (typeof invocationParams.model_name === 'string') return invocationParams.model_name;
    if (typeof invocationParams.modelName === 'string') return invocationParams.modelName;
  }

  // Fall back to serialized kwargs
  const kwargs = (serialized as unknown as Record<string, unknown>).kwargs as Record<string, unknown> | undefined;
  if (kwargs) {
    if (typeof kwargs.model === 'string') return kwargs.model;
    if (typeof kwargs.model_name === 'string') return kwargs.model_name;
    if (typeof kwargs.modelName === 'string') return kwargs.modelName;
  }

  return 'unknown';
}

/** Tracks in-flight LLM call metadata keyed by run ID. */
interface RunMeta {
  startMs: number;
  provider: string;
  model: string;
}

/**
 * NeuraMeter callback handler for LangChain.
 *
 * Automatically records cost events for every LLM call made through
 * LangChain chains, agents, or direct LLM invocations.
 *
 * @example
 * ```ts
 * import { NeuraMeter } from '@neurameter/core';
 * import { NeuraMeterCallbackHandler } from '@neurameter/langchain';
 * import { ChatOpenAI } from '@langchain/openai';
 *
 * const meter = new NeuraMeter({ apiKey: '...', projectId: '...' });
 * const handler = new NeuraMeterCallbackHandler(meter, { agentName: 'my-agent' });
 *
 * const chat = new ChatOpenAI({ model: 'gpt-4o' });
 * const result = await chat.invoke('Hello!', { callbacks: [handler] });
 * ```
 */
export class NeuraMeterCallbackHandler extends BaseCallbackHandler {
  name = 'NeuraMeterCallbackHandler';

  private readonly meter: NeuraMeter;
  private readonly defaults: MeterOptions;
  private readonly runs = new Map<string, RunMeta>();

  constructor(meter: NeuraMeter, defaults: MeterOptions) {
    super();
    this.meter = meter;
    this.defaults = defaults;
  }

  /**
   * Called when an LLM call starts. Records start time and extracts
   * provider/model metadata for cost calculation when the call ends.
   */
  async handleLLMStart(
    serialized: Serialized,
    _prompts: string[],
    runId: string,
    _parentRunId?: string,
    extraParams?: Record<string, unknown>,
  ): Promise<void> {
    const invocationParams = extraParams?.invocation_params as Record<string, unknown> | undefined;
    const llmType = (serialized.id ?? []).join('/');
    const provider = mapProvider(llmType);
    const model = extractModelName(serialized, invocationParams);

    this.runs.set(runId, {
      startMs: Date.now(),
      provider,
      model,
    });
  }

  /**
   * Called when an LLM call completes. Extracts token usage from the
   * LLMResult and records a cost event via NeuraMeter.
   */
  async handleLLMEnd(output: LLMResult, runId: string): Promise<void> {
    const meta = this.runs.get(runId);
    if (!meta) return;
    this.runs.delete(runId);

    const latencyMs = Date.now() - meta.startMs;

    // Extract token usage from LLMResult
    // LangChain provides llmOutput.tokenUsage or llmOutput.estimatedTokens
    const llmOutput = output.llmOutput as Record<string, unknown> | null | undefined;
    let inputTokens = 0;
    let outputTokens = 0;
    let reasoningTokens: number | undefined;
    let cachedTokens: number | undefined;

    if (llmOutput) {
      const tokenUsage = llmOutput.tokenUsage as Record<string, number> | undefined;
      if (tokenUsage) {
        inputTokens = tokenUsage.promptTokens ?? tokenUsage.prompt_tokens ?? 0;
        outputTokens = tokenUsage.completionTokens ?? tokenUsage.completion_tokens ?? 0;
        reasoningTokens = tokenUsage.reasoningTokens ?? tokenUsage.reasoning_tokens;
        cachedTokens = tokenUsage.cachedTokens ?? tokenUsage.cached_tokens;
      }

      // Some providers put usage directly on llmOutput
      if (inputTokens === 0 && typeof llmOutput.prompt_tokens === 'number') {
        inputTokens = llmOutput.prompt_tokens as number;
      }
      if (outputTokens === 0 && typeof llmOutput.completion_tokens === 'number') {
        outputTokens = llmOutput.completion_tokens as number;
      }
    }

    // Also check per-generation token usage (some providers put it there)
    if (inputTokens === 0 && outputTokens === 0 && output.generations?.[0]?.[0]) {
      const gen = output.generations[0][0] as unknown as Record<string, unknown>;
      const genInfo = gen.generationInfo as Record<string, unknown> | undefined;
      if (genInfo) {
        const usage = genInfo.usage as Record<string, number> | undefined;
        if (usage) {
          inputTokens = usage.prompt_tokens ?? usage.input_tokens ?? 0;
          outputTokens = usage.completion_tokens ?? usage.output_tokens ?? 0;
        }
      }
    }

    const provider = mapProvider(meta.provider);
    const pricing = getModelPricing(provider, meta.model);
    const costMicrodollars = pricing
      ? calculateCostMicrodollars(
          {
            inputTokens,
            outputTokens,
            reasoningTokens,
            cachedTokens,
          },
          pricing,
        )
      : 0;

    this.meter.record({
      traceId: this.defaults.traceId ?? crypto.randomUUID(),
      spanId: crypto.randomUUID(),
      parentSpanId: this.defaults.parentSpanId,
      agentName: this.defaults.agentName,
      taskName: this.defaults.taskName,
      customerId: this.defaults.customerId,
      provider,
      model: meta.model,
      inputTokens,
      outputTokens,
      reasoningTokens,
      cachedTokens,
      costMicrodollars,
      latencyMs,
      tags: this.defaults.tags,
    });
  }

  /**
   * Called when an LLM call errors. Cleans up tracked run metadata.
   */
  async handleLLMError(_err: Error, runId: string): Promise<void> {
    this.runs.delete(runId);
  }
}
