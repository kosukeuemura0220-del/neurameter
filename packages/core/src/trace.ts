import type { CostEvent, Provider, TraceOptions, TokenUsage } from './types';
import { calculateCostMicrodollars } from './cost';
import { getModelPricing } from './pricing';

export class Trace {
  readonly traceId: string;
  private readonly agentName: string;
  private readonly customerId?: string;
  private readonly taskName?: string;
  private readonly tags?: Record<string, string>;
  private readonly recordFn: (event: Omit<CostEvent, 'eventId' | 'timestamp' | 'orgId' | 'projectId' | 'cost'>) => void;

  constructor(
    opts: TraceOptions,
    recordFn: (event: Omit<CostEvent, 'eventId' | 'timestamp' | 'orgId' | 'projectId' | 'cost'>) => void,
  ) {
    this.traceId = crypto.randomUUID();
    this.agentName = opts.agentName;
    this.customerId = opts.customerId;
    this.taskName = opts.taskName;
    this.tags = opts.tags;
    this.recordFn = recordFn;
  }

  span(opts: {
    provider: Provider;
    model: string;
    usage: TokenUsage;
    latencyMs: number;
    parentSpanId?: string;
    agentName?: string;
    taskName?: string;
    tags?: Record<string, string>;
  }): string {
    const spanId = crypto.randomUUID();
    const pricing = getModelPricing(opts.provider, opts.model);
    const costMicrodollars = pricing
      ? calculateCostMicrodollars(opts.usage, pricing)
      : 0;

    this.recordFn({
      traceId: this.traceId,
      spanId,
      parentSpanId: opts.parentSpanId,
      agentName: opts.agentName ?? this.agentName,
      taskName: opts.taskName ?? this.taskName,
      customerId: this.customerId,
      provider: opts.provider,
      model: opts.model,
      inputTokens: opts.usage.inputTokens,
      outputTokens: opts.usage.outputTokens,
      reasoningTokens: opts.usage.reasoningTokens,
      cachedTokens: opts.usage.cachedTokens,
      costMicrodollars,
      latencyMs: opts.latencyMs,
      tags: { ...this.tags, ...opts.tags },
    });

    return spanId;
  }
}
