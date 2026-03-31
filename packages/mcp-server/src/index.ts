// ---------------------------------------------------------------------------
// @neurameter/mcp-server  –  Public API
// ---------------------------------------------------------------------------

export { NeuraMeterMCPServer } from './server.js';
export type {
  NeuraMeterMCPServerConfig,
  McpTransport,
  McpToolDefinition,
  JsonRpcRequest,
  JsonRpcResponse,
  GetCostSummaryInput,
  GetCostSummaryOutput,
  CheckContextInput,
  CheckContextOutput,
  CheckBudgetInput,
  CheckBudgetOutput,
  GetRecommendationsInput,
  GetRecommendationsOutput,
  LogOptimizationInput,
  LogOptimizationOutput,
} from './types.js';
