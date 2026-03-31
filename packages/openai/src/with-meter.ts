import type OpenAI from 'openai';
import type { NeuraMeter, Message } from '@neurameter/core';
import { getModelPricing, calculateCostMicrodollars } from '@neurameter/core';
import type { MeterOptions } from './types';

type ChatCreateParams = Parameters<OpenAI['chat']['completions']['create']>;
type ChatCreateBody = ChatCreateParams[0];
type ChatCreateOptions = ChatCreateParams[1];

/**
 * Wraps an OpenAI client instance to automatically record cost events.
 * Uses Proxy to intercept `chat.completions.create` calls.
 * v2.0: Adds guard checks, auto-optimize, and context analysis.
 */
export function withMeter<T extends OpenAI>(client: T, meter: NeuraMeter): T {
  const originalCompletionsCreate = client.chat.completions.create.bind(
    client.chat.completions,
  );

  const proxiedCreate = async (
    body: ChatCreateBody,
    options?: ChatCreateOptions & MeterOptions,
  ) => {
    // Separate meter options from OpenAI request options
    const {
      agentName,
      taskName,
      customerId,
      traceId,
      parentSpanId,
      tags,
      ...requestOptions
    } = (options ?? {}) as MeterOptions & Record<string, unknown>;

    let effectiveBody = body;

    // v2.0: Guard check before API call
    let guardResult = null;
    if (meter.guards && agentName && 'messages' in body && Array.isArray(body.messages)) {
      try {
        const messages: Message[] = body.messages.map((m) => {
          const msg = m as unknown as Record<string, unknown>;
          return {
            role: String(msg.role ?? ''),
            content: msg.content ?? '',
          };
        });

        guardResult = meter.checkGuards({
          messages,
          model: body.model,
          provider: 'openai',
          agentName,
        });

        // Auto-optimize mode: call onOptimize and potentially retry with modified params
        if (
          meter.guards.mode === 'auto-optimize' &&
          guardResult &&
          guardResult.triggeredRules.length > 0
        ) {
          const optimizeResult = await meter.runAutoOptimize({
            guardResult,
            messages,
            model: body.model,
            agentName,
          });

          if (optimizeResult) {
            if (optimizeResult.action === 'block') {
              throw Object.assign(new Error('NeuraMeter auto-optimize: blocked'), {
                name: 'NeuraMeterGuardError',
              });
            }
            if (optimizeResult.action === 'retry') {
              // Rebuild body with optimized messages/model
              effectiveBody = {
                ...body,
                model: optimizeResult.model ?? body.model,
                messages: optimizeResult.messages
                  ? (optimizeResult.messages as ChatCreateBody['messages'])
                  : body.messages,
              };
            }
            // 'notify' — proceed as-is
          }
        }
      } catch (e) {
        if (e && typeof e === 'object' && 'name' in e && (e as Error).name === 'NeuraMeterGuardError') {
          throw e;
        }
        // Other errors are swallowed (fire-and-forget)
      }
    }

    const startMs = Date.now();
    const response = await originalCompletionsCreate(
      effectiveBody,
      Object.keys(requestOptions).length > 0 ? requestOptions as ChatCreateOptions : undefined,
    );
    const latencyMs = Date.now() - startMs;

    // Only record for non-streaming responses
    if (response && typeof response === 'object' && 'usage' in response) {
      const completion = response as OpenAI.Chat.Completions.ChatCompletion;
      const usage = completion.usage;

      if (usage && agentName) {
        const ctx = guardResult?.contextAnalysis;
        const modelName = completion.model ?? effectiveBody.model;
        const pricing = getModelPricing('openai', modelName);
        const costMicrodollars = pricing
          ? calculateCostMicrodollars({
              inputTokens: usage.prompt_tokens,
              outputTokens: usage.completion_tokens,
              reasoningTokens: usage.completion_tokens_details?.reasoning_tokens,
              cachedTokens: usage.prompt_tokens_details?.cached_tokens,
            }, pricing)
          : 0;
        meter.record({
          traceId: traceId ?? crypto.randomUUID(),
          spanId: crypto.randomUUID(),
          parentSpanId,
          agentName,
          taskName,
          customerId,
          provider: 'openai',
          model: modelName,
          inputTokens: usage.prompt_tokens,
          outputTokens: usage.completion_tokens,
          reasoningTokens: usage.completion_tokens_details?.reasoning_tokens,
          cachedTokens: usage.prompt_tokens_details?.cached_tokens,
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
          tags,
        });
      }
    }

    return response;
  };

  // Use Proxy to intercept access to chat.completions.create
  const completionsProxy = new Proxy(client.chat.completions, {
    get(target, prop, receiver) {
      if (prop === 'create') {
        return proxiedCreate;
      }
      return Reflect.get(target, prop, receiver);
    },
  });

  const chatProxy = new Proxy(client.chat, {
    get(target, prop, receiver) {
      if (prop === 'completions') {
        return completionsProxy;
      }
      return Reflect.get(target, prop, receiver);
    },
  });

  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'chat') {
        return chatProxy;
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}
