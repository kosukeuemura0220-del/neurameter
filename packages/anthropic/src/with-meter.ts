import type Anthropic from '@anthropic-ai/sdk';
import type { NeuraMeter, Message } from '@neurameter/core';
import { getModelPricing, calculateCostMicrodollars } from '@neurameter/core';
import type { MeterOptions } from './types';

type MessagesCreateParams = Parameters<Anthropic['messages']['create']>;
type MessagesCreateBody = MessagesCreateParams[0];
type MessagesCreateOptions = MessagesCreateParams[1];

/**
 * Wraps an Anthropic client instance to automatically record cost events.
 * v2.0: Adds guard checks, auto-optimize, and context analysis.
 */
export function withMeter<T extends Anthropic>(client: T, meter: NeuraMeter): T {
  const originalCreate = client.messages.create.bind(client.messages);

  const proxiedCreate = async (
    body: MessagesCreateBody,
    options?: MessagesCreateOptions & MeterOptions,
  ) => {
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
    if (meter.guards && agentName && Array.isArray(body.messages)) {
      try {
        // Build message list including system prompt
        const messages: Message[] = [];
        if (body.system) {
          messages.push({
            role: 'system',
            content: typeof body.system === 'string' ? body.system : JSON.stringify(body.system),
          });
        }
        for (const m of body.messages) {
          messages.push({
            role: String(m.role),
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          });
        }

        guardResult = meter.checkGuards({
          messages,
          model: body.model,
          provider: 'anthropic',
          agentName,
        });

        // Auto-optimize mode
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
              const newMessages = optimizeResult.messages ?? messages;
              // Separate system from conversation messages for Anthropic format
              const systemMsg = newMessages.find((m) => m.role === 'system');
              const nonSystemMsgs = newMessages.filter((m) => m.role !== 'system');
              effectiveBody = {
                ...body,
                model: (optimizeResult.model ?? body.model) as MessagesCreateBody['model'],
                messages: nonSystemMsgs.map((m) => ({
                  role: m.role as 'user' | 'assistant',
                  content: typeof m.content === 'string' ? m.content : String(m.content),
                })),
                ...(systemMsg ? { system: typeof systemMsg.content === 'string' ? systemMsg.content : String(systemMsg.content) } : {}),
              };
            }
          }
        }
      } catch (e) {
        if (e && typeof e === 'object' && 'name' in e && (e as Error).name === 'NeuraMeterGuardError') {
          throw e;
        }
      }
    }

    const startMs = Date.now();
    const response = await originalCreate(
      effectiveBody,
      Object.keys(requestOptions).length > 0 ? requestOptions as MessagesCreateOptions : undefined,
    );
    const latencyMs = Date.now() - startMs;

    if (response && typeof response === 'object' && 'usage' in response) {
      const message = response as Anthropic.Message;
      const usage = message.usage;

      if (usage && agentName) {
        const ctx = guardResult?.contextAnalysis;
        const modelName = message.model ?? effectiveBody.model;
        const pricing = getModelPricing('anthropic', modelName);
        const costMicrodollars = pricing
          ? calculateCostMicrodollars({
              inputTokens: usage.input_tokens,
              outputTokens: usage.output_tokens,
              cachedTokens: usage.cache_read_input_tokens ?? undefined,
            }, pricing)
          : 0;
        meter.record({
          traceId: traceId ?? crypto.randomUUID(),
          spanId: crypto.randomUUID(),
          parentSpanId,
          agentName,
          taskName,
          customerId,
          provider: 'anthropic',
          model: modelName,
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          cachedTokens: usage.cache_read_input_tokens ?? undefined,
          costMicrodollars,
          latencyMs,
          contextUtilization: ctx?.utilizationPercent,
          modelContextLimit: ctx?.modelContextLimit,
          messageCount: ctx?.messageCount,
          systemPromptTokens: ctx?.systemPromptTokens,
          conversationTokens: ctx?.conversationTokens,
          toolResultTokens: ctx?.toolResultTokens,
          guardMode: meter.guards?.mode,
          guardDecision: guardResult?.decision,
          guardTriggeredRules: guardResult?.triggeredRules.map((r) => r.ruleType),
          tags,
        });
      }
    }

    return response;
  };

  const messagesProxy = new Proxy(client.messages, {
    get(target, prop, receiver) {
      if (prop === 'create') {
        return proxiedCreate;
      }
      return Reflect.get(target, prop, receiver);
    },
  });

  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'messages') {
        return messagesProxy;
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}
