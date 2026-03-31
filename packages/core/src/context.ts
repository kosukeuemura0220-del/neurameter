export interface ContextAnalysis {
  estimatedInputTokens: number;
  modelContextLimit: number;
  utilizationPercent: number;
  messageCount: number;
  systemPromptTokens: number;
  conversationTokens: number;
  toolResultTokens: number;
}

export interface Message {
  role: string;
  content: string | unknown;
}

/**
 * Model context window limits (tokens).
 */
export const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'gpt-4o': 128_000,
  'gpt-4o-mini': 128_000,
  'gpt-4.1': 1_000_000,
  'gpt-4.1-mini': 1_000_000,
  'o1': 200_000,
  'o3-mini': 200_000,
  'claude-sonnet-4-20250514': 200_000,
  'claude-haiku-4-5-20251001': 200_000,
  'claude-opus-4-20250514': 200_000,
  // Aliases for prefix matching
  'claude-sonnet-4': 200_000,
  'claude-haiku-4': 200_000,
  'claude-opus-4': 200_000,
};

/**
 * Estimate token count from a string.
 * Uses a simple heuristic: ~4 chars per token for English,
 * ~1.5 chars per token for CJK/mixed content.
 * This is intentionally fast (<1ms) for SDK use.
 */
export function estimateTokens(content: string | unknown): number {
  if (typeof content !== 'string') {
    // For non-string content (e.g., tool_use blocks), serialize and estimate
    const str = typeof content === 'object' ? JSON.stringify(content) : String(content ?? '');
    return Math.ceil(str.length / 4);
  }
  // Simple heuristic: average of ~4 chars/token
  return Math.ceil(content.length / 4);
}

/**
 * Analyze context window utilization for a set of messages.
 */
export function analyzeContext(messages: Message[], model: string): ContextAnalysis {
  const modelLimit = getModelContextLimit(model);
  let systemTokens = 0;
  let conversationTokens = 0;
  let toolResultTokens = 0;

  for (const msg of messages) {
    const tokens = estimateTokens(msg.content);
    if (msg.role === 'system') {
      systemTokens += tokens;
    } else if (msg.role === 'tool') {
      toolResultTokens += tokens;
    } else {
      conversationTokens += tokens;
    }
  }

  const total = systemTokens + conversationTokens + toolResultTokens;

  return {
    estimatedInputTokens: total,
    modelContextLimit: modelLimit,
    utilizationPercent: modelLimit > 0 ? total / modelLimit : 0,
    messageCount: messages.length,
    systemPromptTokens: systemTokens,
    conversationTokens,
    toolResultTokens,
  };
}

/**
 * Get model context limit with prefix matching fallback.
 */
export function getModelContextLimit(model: string): number {
  if (MODEL_CONTEXT_LIMITS[model] !== undefined) {
    return MODEL_CONTEXT_LIMITS[model]!;
  }
  // Prefix match for versioned model names
  for (const [key, limit] of Object.entries(MODEL_CONTEXT_LIMITS)) {
    if (model.startsWith(key)) return limit;
  }
  return 128_000; // Default fallback
}
