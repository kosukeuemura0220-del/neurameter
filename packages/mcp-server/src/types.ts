// ---------------------------------------------------------------------------
// @neurameter/mcp-server  –  Configuration & shared types
// ---------------------------------------------------------------------------

/** Transport mode for the MCP server. */
export type McpTransport = 'stdio' | 'sse';

/** Configuration used to initialise NeuraMeterMCPServer. */
export interface NeuraMeterMCPServerConfig {
  /** NeuraMeter API key (prefix: nm_). */
  apiKey: string;

  /** NeuraMeter project identifier. */
  projectId: string;

  /**
   * Base URL of the NeuraMeter Ingestion API.
   * @default "https://ingest.meter.neuria.tech"
   */
  endpoint?: string;

  /**
   * Transport layer for MCP communication.
   * @default "stdio"
   */
  transport?: McpTransport;
}

// ---------------------------------------------------------------------------
// JSON-RPC types (minimal subset for the stdio transport)
// ---------------------------------------------------------------------------

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// ---------------------------------------------------------------------------
// MCP Tool schema helpers
// ---------------------------------------------------------------------------

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// ---------------------------------------------------------------------------
// Tool-specific input / output shapes
// ---------------------------------------------------------------------------

/** neurameter_get_cost_summary */
export interface GetCostSummaryInput {
  period: 'today' | 'week' | 'month';
  agentName?: string;
}

export interface GetCostSummaryOutput {
  totalCost: number;
  budgetRemaining: number;
  topAgents: Array<{ name: string; cost: number; calls: number }>;
  trend: string;
}

/** neurameter_check_context */
export interface CheckContextInput {
  agentName: string;
  currentMessageCount?: number;
  estimatedTokens?: number;
}

export interface CheckContextOutput {
  utilization: number;
  breakdown: {
    system: number;
    conversation: number;
    toolResults: number;
  };
  status: 'ok' | 'warning' | 'critical';
  suggestions: string[];
}

/** neurameter_check_budget */
export interface CheckBudgetInput {
  agentName: string;
  estimatedCost?: number;
}

export interface CheckBudgetOutput {
  budget: {
    limit: number;
    spent: number;
    remaining: number;
  };
  decision: 'allow' | 'warn' | 'block';
  warning?: string;
}

/** neurameter_get_recommendations */
export interface GetRecommendationsInput {
  agentName?: string;
}

export interface GetRecommendationsOutput {
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    type: string;
    action: string;
    currentCost: number;
    projectedCost: number;
    monthlySaving: number;
  }>;
}

/** neurameter_log_optimization */
export interface LogOptimizationInput {
  agentName: string;
  optimizationType: string;
  tokensBefore?: number;
  tokensAfter?: number;
  description?: string;
}

export interface LogOptimizationOutput {
  success: true;
}
