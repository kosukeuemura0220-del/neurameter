import type { CostEvent, NeuraMeterConfig, TraceOptions } from './types';
import type { GuardsConfig, GuardCheckResult, GuardEvent, OptimizeEvent, OptimizeResult } from './guards';
import { checkGuards, NeuraMeterGuardError } from './guards';
import type { Message } from './context';
import { Trace } from './trace';
import { calculateCostMicrodollars } from './cost';
import { getModelPricing } from './pricing';
import { sendSlackNotification } from './slack';

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_FLUSH_INTERVAL_MS = 5_000;

/** Tracks cost accumulated within a rolling 1-hour window per agent. */
interface HourlyCostEntry {
  costMicrodollars: number;
  timestamp: number;
}

export class NeuraMeter {
  private readonly apiKey: string;
  private readonly projectId: string;
  private readonly endpoint: string;
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  readonly guards: GuardsConfig | undefined;

  private buffer: CostEvent[] = [];
  private guardBuffer: GuardEvent[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private timer: any = null;
  private flushing = false;

  /** Rolling hourly cost tracking per agent for maxCostPerHour guard */
  private hourlyCosts: Map<string, HourlyCostEntry[]> = new Map();

  /** Extracted from API key format: nm_{orgId}_{secret} */
  private readonly orgId: string;

  constructor(config: NeuraMeterConfig) {
    this.apiKey = config.apiKey;
    this.projectId = config.projectId;
    this.endpoint = config.endpoint ?? 'https://ingest.meter.neuria.tech';
    this.batchSize = config.batchSize ?? DEFAULT_BATCH_SIZE;
    this.flushIntervalMs = config.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    this.guards = config.guards;

    // Extract orgId from API key (format: nm_{orgId}_{secret})
    const parts = this.apiKey.split('_');
    this.orgId = parts.length >= 3 ? parts[1]! : 'unknown';

    this.startAutoFlush();
  }

  startTrace(opts: TraceOptions): Trace {
    return new Trace(opts, (event) => this.record(event));
  }

  /**
   * Get rolling hourly cost for an agent (in dollars).
   */
  getHourlyCostDollars(agentName: string): number {
    const oneHourAgo = Date.now() - 3_600_000;
    const entries = this.hourlyCosts.get(agentName) ?? [];
    // Prune old entries
    const recent = entries.filter((e) => e.timestamp > oneHourAgo);
    this.hourlyCosts.set(agentName, recent);
    const totalMicro = recent.reduce((s, e) => s + e.costMicrodollars, 0);
    return totalMicro / 1_000_000;
  }

  /**
   * Track cost for hourly rate limiting.
   */
  private trackHourlyCost(agentName: string, costMicrodollars: number): void {
    const entries = this.hourlyCosts.get(agentName) ?? [];
    entries.push({ costMicrodollars, timestamp: Date.now() });
    this.hourlyCosts.set(agentName, entries);
  }

  /**
   * Check guard rules before an API call.
   * Returns the check result. In block mode, may throw NeuraMeterGuardError.
   */
  checkGuards(params: {
    messages: Message[];
    model: string;
    provider: string;
    agentName: string;
  }): GuardCheckResult | null {
    if (!this.guards) return null;

    const hourlyCostDollars = this.getHourlyCostDollars(params.agentName);
    const result = checkGuards(this.guards, params, hourlyCostDollars);

    // Record guard event (async, fire-and-forget)
    if (result.triggeredRules.length > 0) {
      this.recordGuardEvent({
        eventId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        agentName: params.agentName,
        guardMode: this.guards.mode ?? 'notify',
        decision: result.decision,
        triggeredRules: result.triggeredRules,
        contextAnalysis: result.contextAnalysis ?? undefined,
        suggestion: result.suggestion,
      });

      // Send Slack notification if configured (async, fire-and-forget)
      if (this.guards.notifySlackWebhook) {
        for (const rule of result.triggeredRules) {
          void sendSlackNotification(this.guards.notifySlackWebhook, {
            text: `NeuraMeter guard triggered: ${rule.ruleType} for agent "${params.agentName}" (${rule.currentValue} > ${rule.threshold})`,
            agentName: params.agentName,
            ruleType: rule.ruleType,
            currentValue: rule.currentValue,
            threshold: rule.threshold,
            suggestion: result.suggestion,
          });
        }
      }
    }

    // In block mode with hard violation, throw
    if (result.decision === 'block') {
      const hardRule = result.triggeredRules.find((r) => r.isHard);
      if (hardRule) {
        throw new NeuraMeterGuardError(hardRule, result.suggestion ?? '');
      }
    }

    return result;
  }

  /**
   * Run auto-optimize flow: calls the onOptimize callback and returns the result.
   * Used by SDK wrappers when mode is 'auto-optimize' and thresholds are exceeded.
   */
  async runAutoOptimize(params: {
    guardResult: GuardCheckResult;
    messages: Message[];
    model: string;
    agentName: string;
  }): Promise<OptimizeResult | null> {
    if (!this.guards?.onOptimize || params.guardResult.triggeredRules.length === 0) {
      return null;
    }

    const primaryRule = params.guardResult.triggeredRules[0]!;
    const optimizeEvent: OptimizeEvent = {
      type: primaryRule.ruleType as OptimizeEvent['type'],
      suggestion: params.guardResult.suggestion ?? '',
      metrics: {
        messages: params.messages,
        model: params.model,
        currentValue: primaryRule.currentValue,
        threshold: primaryRule.threshold,
      },
    };

    try {
      const result = await this.guards.onOptimize(optimizeEvent);

      // Record optimization in guard event
      const pricing = getModelPricing(
        'openai', // Best effort — wrappers will provide actual provider
        result.model ?? params.model,
      );
      const tokensBefore = params.guardResult.contextAnalysis?.estimatedInputTokens ?? 0;
      const costBefore = pricing
        ? calculateCostMicrodollars({ inputTokens: tokensBefore, outputTokens: 0 }, pricing) / 1_000_000
        : 0;

      this.recordGuardEvent({
        eventId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        agentName: params.agentName,
        guardMode: 'auto-optimize',
        decision: result.action === 'retry' ? 'optimized' : result.action === 'block' ? 'block' : 'notify',
        triggeredRules: params.guardResult.triggeredRules,
        contextAnalysis: params.guardResult.contextAnalysis ?? undefined,
        optimization: {
          action: result.action,
          tokensBefore,
          costBefore,
          description: params.guardResult.suggestion,
        },
        suggestion: params.guardResult.suggestion,
      });

      return result;
    } catch {
      // If onOptimize fails, fall through to notify
      return { action: 'notify' };
    }
  }

  record(event: Omit<CostEvent, 'eventId' | 'timestamp' | 'orgId' | 'projectId'>): void {
    const fullEvent: CostEvent = {
      ...event,
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      orgId: this.orgId,
      projectId: this.projectId,
    };

    this.buffer.push(fullEvent);

    // Track hourly cost for rate limiting
    if (event.agentName && event.costMicrodollars > 0) {
      this.trackHourlyCost(event.agentName, event.costMicrodollars);
    }

    if (this.buffer.length >= this.batchSize) {
      void this.flush();
    }
  }

  private recordGuardEvent(event: GuardEvent): void {
    this.guardBuffer.push(event);
    // Flush guard events alongside regular events
  }

  async flush(): Promise<void> {
    if ((this.buffer.length === 0 && this.guardBuffer.length === 0) || this.flushing) return;

    this.flushing = true;

    // Flush cost events
    if (this.buffer.length > 0) {
      const batch = this.buffer.splice(0, this.batchSize);
      try {
        const response = await fetch(`${this.endpoint}/v1/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({ batch }),
        });
        if (!response.ok) {
          this.buffer.unshift(...batch);
        }
      } catch {
        this.buffer.unshift(...batch);
      }
    }

    // Flush guard events
    if (this.guardBuffer.length > 0) {
      const guardBatch = this.guardBuffer.splice(0, this.batchSize);
      try {
        await fetch(`${this.endpoint}/v1/guard-events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({ batch: guardBatch }),
        });
      } catch {
        // Fire-and-forget for guard events
      }
    }

    this.flushing = false;
  }

  destroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    void this.flush();
  }

  private startAutoFlush(): void {
    this.timer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);

    if (this.timer && typeof this.timer === 'object' && 'unref' in this.timer) {
      (this.timer as { unref: () => void }).unref();
    }
  }
}
