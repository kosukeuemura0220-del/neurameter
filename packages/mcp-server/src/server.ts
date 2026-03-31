// ---------------------------------------------------------------------------
// @neurameter/mcp-server  –  NeuraMeterMCPServer
// ---------------------------------------------------------------------------
// Implements a JSON-RPC over stdio MCP server that exposes five cost-aware
// tools to any MCP-compatible AI agent.  The actual @modelcontextprotocol/sdk
// integration can be swapped in later; for now we use a lightweight readline-
// based JSON-RPC transport so the package works without requiring the SDK at
// runtime.
// ---------------------------------------------------------------------------

import { createInterface, type Interface as ReadlineInterface } from 'node:readline';
import type {
  NeuraMeterMCPServerConfig,
  JsonRpcRequest,
  JsonRpcResponse,
  McpToolDefinition,
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SERVER_NAME = 'neurameter';
const SERVER_VERSION = '0.1.0';
const DEFAULT_ENDPOINT = 'https://neurameter-ingestion.neurameter.workers.dev';

// ---------------------------------------------------------------------------
// Tool definitions (MCP tools/list payload)
// ---------------------------------------------------------------------------

const TOOL_DEFINITIONS: McpToolDefinition[] = [
  {
    name: 'neurameter_get_cost_summary',
    description:
      'Get a cost summary for the project or a specific agent. Returns total cost, budget remaining, top agents, and trend.',
    inputSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'week', 'month'],
          description: 'Time period for the summary.',
        },
        agentName: {
          type: 'string',
          description: 'Optional agent name to filter by.',
        },
      },
      required: ['period'],
    },
  },
  {
    name: 'neurameter_check_context',
    description:
      'Analyse context-window efficiency for an agent. Returns utilization percentage, breakdown (system / conversation / toolResults), status, and optimization suggestions.',
    inputSchema: {
      type: 'object',
      properties: {
        agentName: {
          type: 'string',
          description: 'The agent whose context to check.',
        },
        currentMessageCount: {
          type: 'number',
          description: 'Current number of messages in the conversation.',
        },
        estimatedTokens: {
          type: 'number',
          description: 'Estimated total tokens currently in the context window.',
        },
      },
      required: ['agentName'],
    },
  },
  {
    name: 'neurameter_check_budget',
    description:
      'Check whether the next operation fits within the budget. Returns budget limits, spending, remaining amount, and a decision (allow / warn / block).',
    inputSchema: {
      type: 'object',
      properties: {
        agentName: {
          type: 'string',
          description: 'The agent to check budget for.',
        },
        estimatedCost: {
          type: 'number',
          description: 'Estimated cost of the upcoming operation in dollars.',
        },
      },
      required: ['agentName'],
    },
  },
  {
    name: 'neurameter_get_recommendations',
    description:
      'Get optimization recommendations based on historical data. Returns a list of prioritized actions with projected savings.',
    inputSchema: {
      type: 'object',
      properties: {
        agentName: {
          type: 'string',
          description: 'Optional agent name to scope recommendations.',
        },
      },
    },
  },
  {
    name: 'neurameter_log_optimization',
    description:
      'Log an optimization action performed by the agent (e.g. context summarization, model downgrade). Used for measuring optimization effectiveness.',
    inputSchema: {
      type: 'object',
      properties: {
        agentName: {
          type: 'string',
          description: 'The agent that performed the optimization.',
        },
        optimizationType: {
          type: 'string',
          description:
            'Type of optimization: context_summarization, model_downgrade, prompt_compression, tool_result_trimming, etc.',
        },
        tokensBefore: {
          type: 'number',
          description: 'Token count before optimization.',
        },
        tokensAfter: {
          type: 'number',
          description: 'Token count after optimization.',
        },
        description: {
          type: 'string',
          description: 'Free-text description of what was optimized.',
        },
      },
      required: ['agentName', 'optimizationType'],
    },
  },
];

// ---------------------------------------------------------------------------
// NeuraMeterMCPServer
// ---------------------------------------------------------------------------

export class NeuraMeterMCPServer {
  private readonly apiKey: string;
  private readonly projectId: string;
  private readonly endpoint: string;
  private readonly transport: 'stdio' | 'sse';
  private rl: ReadlineInterface | null = null;
  private running = false;

  constructor(config: NeuraMeterMCPServerConfig) {
    this.apiKey = config.apiKey;
    this.projectId = config.projectId;
    this.endpoint = (config.endpoint ?? DEFAULT_ENDPOINT).replace(/\/+$/, '');
    this.transport = config.transport ?? 'stdio';
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Start the MCP server. Currently only stdio transport is implemented. */
  async start(): Promise<void> {
    if (this.transport !== 'stdio') {
      throw new Error(`Transport "${this.transport}" is not yet implemented. Use "stdio".`);
    }
    this.running = true;
    this.rl = createInterface({ input: process.stdin, terminal: false });

    // Buffer for accumulating partial JSON lines (normally one line = one
    // JSON-RPC message, but we handle multiline gracefully).
    let buffer = '';

    this.rl.on('line', async (line: string) => {
      buffer += line;
      try {
        const request = JSON.parse(buffer) as JsonRpcRequest;
        buffer = '';
        const response = await this.handleRequest(request);
        this.send(response);
      } catch {
        // Possibly an incomplete JSON payload — keep buffering.
        // If the line was genuinely invalid JSON we will eventually get a
        // parseable message that resets the buffer.
      }
    });

    this.rl.on('close', () => {
      this.running = false;
    });

    // Log to stderr so we don't pollute the JSON-RPC stdout channel.
    process.stderr.write(
      `[neurameter-mcp] Server started (transport=stdio, project=${this.projectId})\n`,
    );
  }

  /** Gracefully shut down the server. */
  stop(): void {
    this.running = false;
    this.rl?.close();
    this.rl = null;
  }

  /** Returns true while the server is listening for requests. */
  get isRunning(): boolean {
    return this.running;
  }

  // -----------------------------------------------------------------------
  // JSON-RPC request dispatcher
  // -----------------------------------------------------------------------

  private async handleRequest(req: JsonRpcRequest): Promise<JsonRpcResponse> {
    try {
      switch (req.method) {
        // MCP lifecycle
        case 'initialize':
          return this.ok(req.id, {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
          });

        case 'notifications/initialized':
          // Acknowledgement — no response required, but we return ok for safety.
          return this.ok(req.id, {});

        // Tool discovery
        case 'tools/list':
          return this.ok(req.id, { tools: TOOL_DEFINITIONS });

        // Tool invocation
        case 'tools/call':
          return await this.handleToolCall(req);

        default:
          return this.error(req.id, -32601, `Method not found: ${req.method}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(req.id, -32603, `Internal error: ${message}`);
    }
  }

  // -----------------------------------------------------------------------
  // Tool call dispatcher
  // -----------------------------------------------------------------------

  private async handleToolCall(req: JsonRpcRequest): Promise<JsonRpcResponse> {
    const params = req.params as { name?: string; arguments?: Record<string, unknown> } | undefined;
    const toolName = params?.name;
    const args = (params?.arguments ?? {}) as Record<string, unknown>;

    switch (toolName) {
      case 'neurameter_get_cost_summary':
        return this.ok(req.id, await this.getCostSummary(args as unknown as GetCostSummaryInput));

      case 'neurameter_check_context':
        return this.ok(req.id, await this.checkContext(args as unknown as CheckContextInput));

      case 'neurameter_check_budget':
        return this.ok(req.id, await this.checkBudget(args as unknown as CheckBudgetInput));

      case 'neurameter_get_recommendations':
        return this.ok(
          req.id,
          await this.getRecommendations(args as unknown as GetRecommendationsInput),
        );

      case 'neurameter_log_optimization':
        return this.ok(
          req.id,
          await this.logOptimization(args as unknown as LogOptimizationInput),
        );

      default:
        return this.error(req.id, -32602, `Unknown tool: ${toolName}`);
    }
  }

  // -----------------------------------------------------------------------
  // Tool implementations
  // -----------------------------------------------------------------------

  /**
   * neurameter_get_cost_summary
   * Fetches the cost summary from the NeuraMeter Ingestion API.
   */
  private async getCostSummary(input: GetCostSummaryInput): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    const url = new URL('/v1/summary', this.endpoint);
    url.searchParams.set('projectId', this.projectId);
    url.searchParams.set('period', input.period);
    if (input.agentName) {
      url.searchParams.set('agentName', input.agentName);
    }

    const res = await this.apiFetch(url.toString());
    const data = (await res.json()) as GetCostSummaryOutput;

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  /**
   * neurameter_check_context
   * Fetches context utilization data for the given agent.
   */
  private async checkContext(input: CheckContextInput): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    const url = new URL('/v1/context', this.endpoint);
    url.searchParams.set('projectId', this.projectId);
    url.searchParams.set('agentName', input.agentName);
    if (input.currentMessageCount !== undefined) {
      url.searchParams.set('currentMessageCount', String(input.currentMessageCount));
    }
    if (input.estimatedTokens !== undefined) {
      url.searchParams.set('estimatedTokens', String(input.estimatedTokens));
    }

    const res = await this.apiFetch(url.toString());
    const data = (await res.json()) as CheckContextOutput;

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  /**
   * neurameter_check_budget
   * Checks budget status for the given agent.
   */
  private async checkBudget(input: CheckBudgetInput): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    const url = new URL('/v1/budget', this.endpoint);
    url.searchParams.set('projectId', this.projectId);
    url.searchParams.set('agentName', input.agentName);
    if (input.estimatedCost !== undefined) {
      url.searchParams.set('estimatedCost', String(input.estimatedCost));
    }

    const res = await this.apiFetch(url.toString());
    const data = (await res.json()) as CheckBudgetOutput;

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  /**
   * neurameter_get_recommendations
   * Fetches optimization recommendations.
   */
  private async getRecommendations(
    input: GetRecommendationsInput,
  ): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    const url = new URL('/v1/recommendations', this.endpoint);
    url.searchParams.set('projectId', this.projectId);
    if (input.agentName) {
      url.searchParams.set('agentName', input.agentName);
    }

    const res = await this.apiFetch(url.toString());
    const data = (await res.json()) as GetRecommendationsOutput;

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  /**
   * neurameter_log_optimization
   * Posts an optimization event to the NeuraMeter guard-events endpoint.
   */
  private async logOptimization(
    input: LogOptimizationInput,
  ): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    const url = new URL('/v1/guard-events', this.endpoint);

    const body = {
      projectId: this.projectId,
      agentName: input.agentName,
      guardMode: 'auto-optimize',
      decision: 'optimized',
      triggeredRules: [],
      optimization: {
        action: 'logged',
        type: input.optimizationType,
        tokensBefore: input.tokensBefore ?? null,
        tokensAfter: input.tokensAfter ?? null,
        description: input.description ?? null,
      },
      eventTimestamp: new Date().toISOString(),
    };

    const res = await this.apiFetch(url.toString(), {
      method: 'POST',
      body: JSON.stringify(body),
    });

    // If the API returns a JSON body, include it; otherwise just confirm success.
    let result: LogOptimizationOutput;
    try {
      result = (await res.json()) as LogOptimizationOutput;
    } catch {
      result = { success: true };
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  // -----------------------------------------------------------------------
  // HTTP helper
  // -----------------------------------------------------------------------

  private async apiFetch(url: string, init?: RequestInit): Promise<Response> {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': `neurameter-mcp/${SERVER_VERSION}`,
        ...(init?.headers as Record<string, string> | undefined),
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `NeuraMeter API error ${response.status}: ${response.statusText}${text ? ` — ${text}` : ''}`,
      );
    }

    return response;
  }

  // -----------------------------------------------------------------------
  // JSON-RPC response helpers
  // -----------------------------------------------------------------------

  private ok(id: string | number, result: unknown): JsonRpcResponse {
    return { jsonrpc: '2.0', id, result };
  }

  private error(id: string | number, code: number, message: string): JsonRpcResponse {
    return { jsonrpc: '2.0', id, error: { code, message } };
  }

  private send(response: JsonRpcResponse): void {
    const json = JSON.stringify(response);
    process.stdout.write(json + '\n');
  }
}
