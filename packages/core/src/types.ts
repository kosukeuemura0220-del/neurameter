import type { GuardsConfig, GuardMode, GuardDecision } from './guards';

export type Provider = 'openai' | 'anthropic' | 'google' | 'groq' | 'mistral' | 'other';

export interface CostEvent {
  eventId: string;
  timestamp: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  agentName: string;
  taskName?: string;
  customerId?: string;
  provider: Provider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
  cachedTokens?: number;
  costMicrodollars: number;
  /** Cost in dollars (costMicrodollars / 1_000_000) */
  cost: number;
  latencyMs: number;
  // v2.0 context
  contextUtilization?: number;
  modelContextLimit?: number;
  messageCount?: number;
  systemPromptTokens?: number;
  conversationTokens?: number;
  toolResultTokens?: number;
  // v2.0 guards
  guardMode?: GuardMode;
  guardDecision?: GuardDecision;
  guardTriggeredRules?: string[];
  // metadata
  tags?: Record<string, string>;
  orgId: string;
  projectId: string;
}

export interface NeuraMeterConfig {
  apiKey: string;
  projectId: string;
  endpoint?: string;
  /** Max events per batch (default: 50) */
  batchSize?: number;
  /** Flush interval in ms (default: 5000) */
  flushIntervalMs?: number;
  /** v2.0 Guard rails configuration */
  guards?: GuardsConfig;
}

export interface TraceOptions {
  agentName: string;
  customerId?: string;
  taskName?: string;
  tags?: Record<string, string>;
}

export interface ModelPricing {
  inputPricePerMToken: number;
  outputPricePerMToken: number;
  reasoningPricePerMToken?: number;
  cachedInputPricePerMToken?: number;
  cacheWritePricePerMToken?: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
  cachedTokens?: number;
}

// v3.0 Anomaly Detection

export type AnomalyType =
  | 'infinite_loop_trace'
  | 'infinite_loop_hourly'
  | 'budget_exceeded_hourly'
  | 'budget_exceeded_trace'
  | 'budget_exceeded_daily';

export interface AnomalyDetectionConfig {
  maxCallsPerTrace?: number;
  maxCallsPerHour?: number;
  maxCostPerHour?: number;
  maxCostPerTrace?: number;
  maxCostPerDay?: number;
  onAnomaly?: 'notify' | 'block';
  notifySlackWebhook?: string;
}

export class NeuraMeterAnomalyError extends Error {
  constructor(
    public readonly anomalyType: AnomalyType,
    public readonly currentValue: number,
    public readonly threshold: number,
  ) {
    super(`Anomaly detected: ${anomalyType} (${currentValue} >= ${threshold})`);
    this.name = 'NeuraMeterAnomalyError';
  }
}

/** Configuration for withNeuraMeter() OpenAI client wrapper. */
export interface WithNeuraMeterConfig {
  /** NeuraMeter API key (format: nm_{orgId}_{secret}) */
  apiKey: string;
  /** NeuraMeter project ID */
  projectId: string;
  /** Agent name for cost events (default: 'default') */
  agentName?: string;
  /** NeuraMeter ingestion endpoint (default: 'https://meter.neuria.tech') */
  endpoint?: string;
}
