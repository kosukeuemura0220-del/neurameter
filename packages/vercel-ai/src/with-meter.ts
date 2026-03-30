import type {
  LanguageModelV1,
  LanguageModelV1CallOptions,
  LanguageModelV1StreamPart,
} from 'ai';
import type { NeuraMeter, Message } from '@neurameter/core';
import { getModelPricing, calculateCostMicrodollars } from '@neurameter/core';
import type { MeterOptions } from './types';

/**
 * Maps a model ID to a NeuraMeter provider identifier.
 */
function mapProvider(modelId: string): 'openai' | 'anthropic' | 'google' | 'other' {
  const lower = modelId.toLowerCase();
  if (lower.includes('gpt') || lower.includes('openai') || lower.startsWith('o1') || lower.startsWith('o3')) {
    return 'openai';
  }
  if (lower.includes('claude') || lower.includes('anthropic')) {
    return 'anthropic';
  }
  if (lower.includes('gemini') || lower.includes('google') || lower.includes('palm')) {
    return 'google';
  }
  return 'other';
}

/**
 * Extracts messages from Vercel AI SDK call options for guard checks.
 */
function extractMessages(params: LanguageModelV1CallOptions): Message[] {
  const messages: Message[] = [];
  if (params.prompt) {
    for (const msg of params.prompt) {
      if (msg.role === 'system') {
        messages.push({ role: 'system', content: msg.content });
      } else if (msg.role === 'user') {
        const parts = msg.content;
        const textParts = parts
          .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
          .map((p) => p.text);
        messages.push({ role: 'user', content: textParts.join('\n') });
      } else if (msg.role === 'assistant') {
        const parts = msg.content;
        const textParts = parts
          .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
          .map((p) => p.text);
        messages.push({ role: 'assistant', content: textParts.join('\n') });
      }
    }
  }
  return messages;
}

/**
 * Wraps a Vercel AI SDK language model to automatically record cost events
 * via NeuraMeter. Intercepts `doGenerate` and `doStream` calls to extract
 * token usage and calculate costs.
 *
 * @example
 * ```ts
 * import { openai } from '@ai-sdk/openai';
 * import { generateText } from 'ai';
 * import { NeuraMeter } from '@neurameter/core';
 * import { withMeter } from '@neurameter/vercel-ai';
 *
 * const meter = new NeuraMeter({ apiKey: '...', projectId: '...' });
 * const model = withMeter(openai('gpt-4o'), meter, { agentName: 'my-agent' });
 *
 * const { text } = await generateText({ model, prompt: 'Hello!' });
 * ```
 */
export function withMeter(
  model: LanguageModelV1,
  meter: NeuraMeter,
  options: MeterOptions,
): LanguageModelV1 {
  const originalDoGenerate = model.doGenerate.bind(model);
  const originalDoStream = model.doStream.bind(model);

  const modelId = model.modelId ?? 'unknown';
  const provider = model.provider ?? mapProvider(modelId);
  const neuraMeterProvider = mapProvider(typeof provider === 'string' ? provider : modelId);

  /**
   * Run guard checks before an API call.
   * Returns the guard result or null if guards are not configured.
   */
  function runGuards(params: LanguageModelV1CallOptions) {
    if (!meter.guards || !options.agentName) return null;

    try {
      const messages = extractMessages(params);
      const guardResult = meter.checkGuards({
        messages,
        model: modelId,
        provider: neuraMeterProvider,
        agentName: options.agentName,
      });
      return guardResult;
    } catch (e) {
      if (e && typeof e === 'object' && 'name' in e && (e as Error).name === 'NeuraMeterGuardError') {
        throw e;
      }
      return null;
    }
  }

  /**
   * Record a cost event after a completed API call.
   */
  function recordUsage(
    usage: { promptTokens: number; completionTokens: number } | undefined,
    latencyMs: number,
    guardResult?: ReturnType<typeof runGuards>,
  ): void {
    if (!usage || !options.agentName) return;

    const inputTokens = usage.promptTokens ?? 0;
    const outputTokens = usage.completionTokens ?? 0;

    const pricing = getModelPricing(neuraMeterProvider, modelId);
    const costMicrodollars = pricing
      ? calculateCostMicrodollars(
          { inputTokens, outputTokens },
          pricing,
        )
      : 0;

    const ctx = guardResult?.contextAnalysis;

    meter.record({
      traceId: options.traceId ?? crypto.randomUUID(),
      spanId: crypto.randomUUID(),
      parentSpanId: options.parentSpanId,
      agentName: options.agentName,
      taskName: options.taskName,
      customerId: options.customerId,
      provider: neuraMeterProvider,
      model: modelId,
      inputTokens,
      outputTokens,
      costMicrodollars,
      latencyMs,
      // v2.0 context
      contextUtilization: ctx?.utilizationPercent,
      modelContextLimit: ctx?.modelContextLimit,
      messageCount: ctx?.messageCount,
      systemPromptTokens: ctx?.systemPromptTokens,
      conversationTokens: ctx?.conversationTokens,
      toolResultTokens: ctx?.toolResultTokens,
      // v2.0 guards
      guardMode: meter.guards?.mode,
      guardDecision: guardResult?.decision,
      guardTriggeredRules: guardResult?.triggeredRules.map((r) => r.ruleType),
      tags: options.tags,
    });
  }

  const wrappedModel: LanguageModelV1 = {
    ...model,
    specificationVersion: model.specificationVersion,
    provider: model.provider,
    modelId: model.modelId,
    defaultObjectGenerationMode: model.defaultObjectGenerationMode,

    async doGenerate(params: LanguageModelV1CallOptions) {
      // Run guard checks before the call
      const guardResult = runGuards(params);

      // Handle auto-optimize mode
      if (
        meter.guards?.mode === 'auto-optimize' &&
        guardResult &&
        guardResult.triggeredRules.length > 0
      ) {
        const messages = extractMessages(params);
        const optimizeResult = await meter.runAutoOptimize({
          guardResult,
          messages,
          model: modelId,
          agentName: options.agentName,
        });

        if (optimizeResult?.action === 'block') {
          throw Object.assign(new Error('NeuraMeter auto-optimize: blocked'), {
            name: 'NeuraMeterGuardError',
          });
        }
        // For 'retry' and 'notify', proceed with the original call
        // (model switching is not directly applicable at the LanguageModelV1 level)
      }

      const startMs = Date.now();
      const result = await originalDoGenerate(params);
      const latencyMs = Date.now() - startMs;

      recordUsage(result.usage, latencyMs, guardResult);

      return result;
    },

    async doStream(params: LanguageModelV1CallOptions) {
      // Run guard checks before the call
      const guardResult = runGuards(params);

      // Handle auto-optimize mode
      if (
        meter.guards?.mode === 'auto-optimize' &&
        guardResult &&
        guardResult.triggeredRules.length > 0
      ) {
        const messages = extractMessages(params);
        const optimizeResult = await meter.runAutoOptimize({
          guardResult,
          messages,
          model: modelId,
          agentName: options.agentName,
        });

        if (optimizeResult?.action === 'block') {
          throw Object.assign(new Error('NeuraMeter auto-optimize: blocked'), {
            name: 'NeuraMeterGuardError',
          });
        }
      }

      const startMs = Date.now();
      const result = await originalDoStream(params);

      // Wrap the stream to capture usage from the final chunk
      let totalPromptTokens = 0;
      let totalCompletionTokens = 0;

      const originalStream = result.stream;
      const transformedStream = new TransformStream<
        LanguageModelV1StreamPart,
        LanguageModelV1StreamPart
      >({
        transform(chunk, controller) {
          // Capture usage info from finish chunks
          if (chunk.type === 'finish') {
            const usage = chunk.usage;
            if (usage) {
              totalPromptTokens = usage.promptTokens ?? 0;
              totalCompletionTokens = usage.completionTokens ?? 0;
            }
          }
          controller.enqueue(chunk);
        },
        flush() {
          const latencyMs = Date.now() - startMs;
          if (totalPromptTokens > 0 || totalCompletionTokens > 0) {
            recordUsage(
              { promptTokens: totalPromptTokens, completionTokens: totalCompletionTokens },
              latencyMs,
              guardResult,
            );
          }
        },
      });

      return {
        ...result,
        stream: originalStream.pipeThrough(transformedStream),
      };
    },
  };

  return wrappedModel;
}
