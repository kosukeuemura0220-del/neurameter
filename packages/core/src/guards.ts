import type { ContextAnalysis, Message } from './context';
import { analyzeContext } from './context';
import { calculateCostMicrodollars } from './cost';
import { getModelPricing } from './pricing';

export type GuardMode = 'notify' | 'block' | 'auto-optimize';
export type GuardDecision = 'allow' | 'notify' | 'block' | 'optimized';

export interface GuardsConfig {
  maxInputTokens?: number;
  maxInputTokensHard?: number;
  maxContextUtilization?: number;
  maxContextUtilizationHard?: number;
  maxCostPerCall?: number;
  maxCostPerCallHard?: number;
  maxCostPerHour?: number;
  mode?: GuardMode;
  notifySlackWebhook?: string;
  notifyDashboard?: boolean;
  onOptimize?: (event: OptimizeEvent) => Promise<OptimizeResult>;
}

export interface TriggeredRule {
  ruleType: 'input_tokens' | 'cost_per_call' | 'cost_per_hour' | 'context_utilization' | 'budget';
  currentValue: number;
  threshold: number;
  isHard: boolean;
}

export interface GuardCheckResult {
  decision: GuardDecision;
  triggeredRules: TriggeredRule[];
  contextAnalysis: ContextAnalysis | null;
  suggestion?: string;
}

export interface GuardEvent {
  eventId: string;
  timestamp: string;
  agentName: string;
  guardMode: GuardMode;
  decision: GuardDecision;
  triggeredRules: TriggeredRule[];
  contextAnalysis?: ContextAnalysis;
  optimization?: {
    action: 'retry' | 'notify' | 'block';
    tokensBefore: number;
    tokensAfter?: number;
    costBefore: number;
    costAfter?: number;
    description?: string;
  };
  suggestion?: string;
}

export interface OptimizeEvent {
  type: 'context_utilization' | 'cost_per_call' | 'input_tokens';
  suggestion: string;
  metrics: {
    messages?: Message[];
    model?: string;
    currentValue: number;
    threshold: number;
  };
}

export interface OptimizeResult {
  action: 'retry' | 'notify' | 'block';
  messages?: Message[];
  model?: string;
}

/**
 * Error thrown when guard mode is 'block' and a hard limit is exceeded.
 */
export class NeuraMeterGuardError extends Error {
  readonly rule: string;
  readonly current: number;
  readonly threshold: number;
  readonly suggestion: string;

  constructor(rule: TriggeredRule, suggestion: string) {
    super(`NeuraMeter guard: ${rule.ruleType} exceeded (${rule.currentValue} > ${rule.threshold})`);
    this.name = 'NeuraMeterGuardError';
    this.rule = rule.ruleType;
    this.current = rule.currentValue;
    this.threshold = rule.threshold;
    this.suggestion = suggestion;
  }
}

/**
 * Check guard rules before an API call.
 * Returns the decision and any triggered rules.
 */
export function checkGuards(
  config: GuardsConfig,
  params: {
    messages: Message[];
    model: string;
    provider: string;
    agentName: string;
  },
  hourlyCostDollars?: number,
): GuardCheckResult {
  const mode = config.mode ?? 'notify';
  const triggeredRules: TriggeredRule[] = [];

  // Context analysis
  const contextAnalysis = analyzeContext(params.messages, params.model);

  // Check input tokens
  if (config.maxInputTokens && contextAnalysis.estimatedInputTokens > config.maxInputTokens) {
    triggeredRules.push({
      ruleType: 'input_tokens',
      currentValue: contextAnalysis.estimatedInputTokens,
      threshold: config.maxInputTokens,
      isHard: false,
    });
  }
  if (config.maxInputTokensHard && contextAnalysis.estimatedInputTokens > config.maxInputTokensHard) {
    triggeredRules.push({
      ruleType: 'input_tokens',
      currentValue: contextAnalysis.estimatedInputTokens,
      threshold: config.maxInputTokensHard,
      isHard: true,
    });
  }

  // Check context utilization
  if (config.maxContextUtilization && contextAnalysis.utilizationPercent > config.maxContextUtilization) {
    triggeredRules.push({
      ruleType: 'context_utilization',
      currentValue: contextAnalysis.utilizationPercent,
      threshold: config.maxContextUtilization,
      isHard: false,
    });
  }
  if (config.maxContextUtilizationHard && contextAnalysis.utilizationPercent > config.maxContextUtilizationHard) {
    triggeredRules.push({
      ruleType: 'context_utilization',
      currentValue: contextAnalysis.utilizationPercent,
      threshold: config.maxContextUtilizationHard,
      isHard: true,
    });
  }

  // Check estimated cost per call
  if (config.maxCostPerCall || config.maxCostPerCallHard) {
    const pricing = getModelPricing(params.provider, params.model);
    if (pricing) {
      const estimatedCost = calculateCostMicrodollars(
        { inputTokens: contextAnalysis.estimatedInputTokens, outputTokens: 0 },
        pricing,
      );
      const estimatedDollars = estimatedCost / 1_000_000;

      if (config.maxCostPerCall && estimatedDollars > config.maxCostPerCall) {
        triggeredRules.push({
          ruleType: 'cost_per_call',
          currentValue: estimatedDollars,
          threshold: config.maxCostPerCall,
          isHard: false,
        });
      }
      if (config.maxCostPerCallHard && estimatedDollars > config.maxCostPerCallHard) {
        triggeredRules.push({
          ruleType: 'cost_per_call',
          currentValue: estimatedDollars,
          threshold: config.maxCostPerCallHard,
          isHard: true,
        });
      }
    }
  }

  // Check cost per hour
  if (config.maxCostPerHour && hourlyCostDollars !== undefined && hourlyCostDollars > config.maxCostPerHour) {
    triggeredRules.push({
      ruleType: 'cost_per_hour',
      currentValue: hourlyCostDollars,
      threshold: config.maxCostPerHour,
      isHard: mode === 'block',
    });
  }

  // Generate suggestion
  const suggestion = generateSuggestion(triggeredRules, contextAnalysis);

  // Determine decision based on mode
  if (triggeredRules.length === 0) {
    return { decision: 'allow', triggeredRules, contextAnalysis, suggestion };
  }

  const hasHardViolation = triggeredRules.some((r) => r.isHard);

  switch (mode) {
    case 'notify':
      return { decision: 'notify', triggeredRules, contextAnalysis, suggestion };

    case 'block':
      if (hasHardViolation) {
        return { decision: 'block', triggeredRules, contextAnalysis, suggestion };
      }
      return { decision: 'notify', triggeredRules, contextAnalysis, suggestion };

    case 'auto-optimize':
      return { decision: 'notify', triggeredRules, contextAnalysis, suggestion };

    default:
      return { decision: 'allow', triggeredRules, contextAnalysis, suggestion };
  }
}

function generateSuggestion(rules: TriggeredRule[], ctx: ContextAnalysis): string {
  if (rules.length === 0) return '';

  const parts: string[] = [];

  for (const rule of rules) {
    switch (rule.ruleType) {
      case 'context_utilization':
        if (ctx.conversationTokens > ctx.systemPromptTokens) {
          const savingPct = Math.round((ctx.conversationTokens / ctx.estimatedInputTokens) * 100);
          parts.push(`Summarize conversation history to save ~${savingPct}% of input tokens`);
        }
        break;
      case 'input_tokens':
        parts.push(`Reduce input tokens from ${ctx.estimatedInputTokens.toLocaleString()} to under ${rule.threshold.toLocaleString()}`);
        break;
      case 'cost_per_call':
        parts.push('Consider using a cheaper model (e.g., gpt-4o-mini or claude-haiku)');
        break;
      case 'cost_per_hour':
        parts.push(`Hourly cost limit exceeded ($${rule.currentValue.toFixed(2)} > $${rule.threshold.toFixed(2)}). Throttle or pause agent calls`);
        break;
    }
  }

  return parts.join('. ') || 'Review guard thresholds or optimize context usage';
}
