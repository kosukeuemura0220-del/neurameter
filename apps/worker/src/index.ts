interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

interface CostEventPayload {
  eventId: string;
  timestamp: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  agentName: string;
  taskName?: string;
  customerId?: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
  cachedTokens?: number;
  costMicrodollars: number;
  latencyMs: number;
  // v2.0 context
  contextUtilization?: number;
  modelContextLimit?: number;
  messageCount?: number;
  systemPromptTokens?: number;
  conversationTokens?: number;
  toolResultTokens?: number;
  // v2.0 guards
  guardMode?: string;
  guardDecision?: string;
  guardTriggeredRules?: string[];
  tags?: Record<string, string>;
  orgId: string;
  projectId: string;
}

interface GuardEventPayload {
  eventId: string;
  timestamp: string;
  agentName: string;
  guardMode: string;
  decision: string;
  triggeredRules: unknown[];
  contextAnalysis?: unknown;
  optimization?: unknown;
  suggestion?: string;
}

interface BatchRequest {
  batch: CostEventPayload[];
}

interface GuardBatchRequest {
  batch: GuardEventPayload[];
}

interface ModelPricing {
  provider: string;
  model: string;
  input_price_per_m_token: number;
  output_price_per_m_token: number;
  reasoning_price_per_m_token: number | null;
  cached_input_price_per_m_token: number | null;
}

interface ApiKeyRow {
  org_id: string;
  project_id: string;
  scopes: string[];
  revoked_at: string | null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return corsResponse(204);
    }

    const url = new URL(request.url);

    if (url.pathname === '/v1/events' && request.method === 'POST') {
      return handleIngest(request, env);
    }

    if (url.pathname === '/v1/guard-events' && request.method === 'POST') {
      return handleGuardEvents(request, env);
    }

    if (url.pathname === '/v1/summary' && request.method === 'GET') {
      return handleCostSummary(request, env);
    }

    if (url.pathname === '/v1/context' && request.method === 'GET') {
      return handleContextCheck(request, env);
    }

    if (url.pathname === '/v1/budget' && request.method === 'GET') {
      return handleBudgetCheck(request, env);
    }

    if (url.pathname === '/v1/recommendations' && request.method === 'GET') {
      return handleRecommendations(request, env);
    }

    if (url.pathname === '/health') {
      return corsResponse(200, { status: 'ok' });
    }

    return corsResponse(404, { error: 'Not found' });
  },
} satisfies ExportedHandler<Env>;

async function handleIngest(request: Request, env: Env): Promise<Response> {
  // 1. Validate API key
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return corsResponse(401, { error: 'Missing or invalid Authorization header' });
  }

  const apiKey = authHeader.slice(7);
  const keyHash = await sha256(apiKey);

  const keyData = await supabaseQuery<ApiKeyRow[]>(
    env,
    'api_keys',
    `key_hash=eq.${keyHash}&select=org_id,project_id,scopes,revoked_at`,
  );

  if (!keyData || keyData.length === 0) {
    return corsResponse(401, { error: 'Invalid API key' });
  }

  const apiKeyRecord = keyData[0]!;

  if (apiKeyRecord.revoked_at) {
    return corsResponse(401, { error: 'API key has been revoked' });
  }

  if (!apiKeyRecord.scopes.includes('ingest')) {
    return corsResponse(403, { error: 'API key does not have ingest scope' });
  }

  // 2. Parse and validate request body
  let body: BatchRequest;
  try {
    body = await request.json() as BatchRequest;
  } catch {
    return corsResponse(400, { error: 'Invalid JSON body' });
  }

  if (!body.batch || !Array.isArray(body.batch)) {
    return corsResponse(400, { error: 'Missing or invalid "batch" field' });
  }

  if (body.batch.length === 0) {
    return corsResponse(200, { accepted: 0, rejected: 0, errors: [] });
  }

  if (body.batch.length > 100) {
    return corsResponse(400, { error: 'Batch size exceeds maximum of 100 events' });
  }

  // 3. Fetch model pricing for cost recalculation
  const pricingData = await supabaseQuery<ModelPricing[]>(
    env,
    'model_pricing',
    'select=provider,model,input_price_per_m_token,output_price_per_m_token,reasoning_price_per_m_token,cached_input_price_per_m_token',
  );

  const pricingMap = new Map<string, ModelPricing>();
  if (pricingData) {
    for (const p of pricingData) {
      pricingMap.set(`${p.provider}:${p.model}`, p);
    }
  }

  // 4. Validate events and recalculate cost
  const accepted: Record<string, unknown>[] = [];
  const errors: string[] = [];

  for (const event of body.batch) {
    const validationError = validateEvent(event);
    if (validationError) {
      errors.push(`${event.eventId ?? 'unknown'}: ${validationError}`);
      continue;
    }

    // Recalculate cost using server-side pricing
    const pricing = pricingMap.get(`${event.provider}:${event.model}`);
    const costMicrodollars = pricing
      ? recalculateCost(event, pricing)
      : event.costMicrodollars;

    accepted.push({
      event_id: event.eventId,
      org_id: apiKeyRecord.org_id,
      project_id: apiKeyRecord.project_id,
      event_timestamp: event.timestamp,
      trace_id: event.traceId,
      span_id: event.spanId,
      parent_span_id: event.parentSpanId || null,
      agent_name: event.agentName,
      task_name: event.taskName || null,
      customer_id: event.customerId || null,
      provider: event.provider,
      model: event.model,
      input_tokens: event.inputTokens,
      output_tokens: event.outputTokens,
      reasoning_tokens: event.reasoningTokens ?? 0,
      cached_tokens: event.cachedTokens ?? 0,
      cost_microdollars: costMicrodollars,
      latency_ms: event.latencyMs,
      // v2.0 context
      context_utilization: event.contextUtilization ?? null,
      model_context_limit: event.modelContextLimit ?? null,
      message_count: event.messageCount ?? null,
      system_prompt_tokens: event.systemPromptTokens ?? 0,
      conversation_tokens: event.conversationTokens ?? 0,
      tool_result_tokens: event.toolResultTokens ?? 0,
      // v2.0 guards
      guard_mode: event.guardMode ?? null,
      guard_decision: event.guardDecision ?? null,
      guard_triggered_rules: event.guardTriggeredRules ?? null,
      tags: event.tags ?? {},
    });
  }

  // 5. Batch INSERT into cost_events
  if (accepted.length > 0) {
    const insertRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/cost_events`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(accepted),
      },
    );

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      return corsResponse(500, {
        error: 'Failed to insert events',
        detail: errText,
        accepted: 0,
        rejected: body.batch.length,
        errors,
      });
    }
  }

  // 6. Update last_used_at for the API key
  void fetch(
    `${env.SUPABASE_URL}/rest/v1/api_keys?key_hash=eq.${keyHash}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ last_used_at: new Date().toISOString() }),
    },
  );

  return corsResponse(200, {
    accepted: accepted.length,
    rejected: errors.length,
    errors,
  });
}

async function handleGuardEvents(request: Request, env: Env): Promise<Response> {
  // 1. Validate API key
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return corsResponse(401, { error: 'Missing or invalid Authorization header' });
  }

  const apiKey = authHeader.slice(7);
  const keyHash = await sha256(apiKey);

  const keyData = await supabaseQuery<ApiKeyRow[]>(
    env,
    'api_keys',
    `key_hash=eq.${keyHash}&select=org_id,project_id,scopes,revoked_at`,
  );

  if (!keyData || keyData.length === 0) {
    return corsResponse(401, { error: 'Invalid API key' });
  }

  const apiKeyRecord = keyData[0]!;

  if (apiKeyRecord.revoked_at) {
    return corsResponse(401, { error: 'API key has been revoked' });
  }

  if (!apiKeyRecord.scopes.includes('ingest')) {
    return corsResponse(403, { error: 'API key does not have ingest scope' });
  }

  // 2. Parse request body
  let body: GuardBatchRequest;
  try {
    body = await request.json() as GuardBatchRequest;
  } catch {
    return corsResponse(400, { error: 'Invalid JSON body' });
  }

  if (!body.batch || !Array.isArray(body.batch)) {
    return corsResponse(400, { error: 'Missing or invalid "batch" field' });
  }

  if (body.batch.length === 0) {
    return corsResponse(200, { accepted: 0 });
  }

  if (body.batch.length > 100) {
    return corsResponse(400, { error: 'Batch size exceeds maximum of 100 events' });
  }

  // 3. Map to DB rows
  const rows = body.batch.map((event) => ({
    id: event.eventId,
    org_id: apiKeyRecord.org_id,
    project_id: apiKeyRecord.project_id,
    agent_name: event.agentName,
    guard_mode: event.guardMode,
    decision: event.decision,
    triggered_rules: event.triggeredRules,
    context_analysis: event.contextAnalysis ?? null,
    optimization: event.optimization ?? null,
    suggestion: event.suggestion ?? null,
    event_timestamp: event.timestamp,
  }));

  // 4. Insert into guard_events
  const insertRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/guard_events`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(rows),
    },
  );

  if (!insertRes.ok) {
    // Fire-and-forget semantics: return success even on insert failure
    // to avoid blocking the SDK
    return corsResponse(200, { accepted: 0, warning: 'Failed to persist guard events' });
  }

  return corsResponse(200, { accepted: rows.length });
}

// --- MCP Read Endpoints ---

async function authenticateRequest(request: Request, env: Env): Promise<ApiKeyRow | Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return corsResponse(401, { error: 'Missing or invalid Authorization header' });
  }
  const apiKey = authHeader.slice(7);
  const keyHash = await sha256(apiKey);
  const keyData = await supabaseQuery<ApiKeyRow[]>(
    env, 'api_keys', `key_hash=eq.${keyHash}&select=org_id,project_id,scopes,revoked_at`,
  );
  if (!keyData || keyData.length === 0) return corsResponse(401, { error: 'Invalid API key' });
  const record = keyData[0]!;
  if (record.revoked_at) return corsResponse(401, { error: 'API key has been revoked' });
  return record;
}

interface CostSummaryRow {
  agent_name: string;
  total_cost_microdollars: number;
  total_events: number;
  hour_bucket: string;
}

interface BudgetRow {
  limit_microdollars: number;
  period: string;
}

interface ContextRow {
  context_utilization: number | null;
  system_prompt_tokens: number;
  conversation_tokens: number;
  tool_result_tokens: number;
  model_context_limit: number | null;
  input_tokens: number;
  output_tokens: number;
}

async function handleCostSummary(request: Request, env: Env): Promise<Response> {
  const auth = await authenticateRequest(request, env);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const period = url.searchParams.get('period') ?? 'month';
  const agentName = url.searchParams.get('agentName');

  const now = new Date();
  let since: string;
  if (period === 'today') {
    since = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  } else if (period === 'week') {
    since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  } else {
    since = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }

  let query = `org_id=eq.${auth.org_id}&select=agent_name,total_cost_microdollars,total_events,hour_bucket&hour_bucket=gte.${since}&order=hour_bucket.asc`;
  if (agentName) query += `&agent_name=eq.${agentName}`;

  const rows = await supabaseQuery<CostSummaryRow[]>(env, 'cost_summaries_hourly', query);
  const data = rows ?? [];

  const totalCost = data.reduce((s, r) => s + (r.total_cost_microdollars ?? 0), 0);

  // Top agents
  const agentMap = new Map<string, { cost: number; calls: number }>();
  for (const row of data) {
    const prev = agentMap.get(row.agent_name) ?? { cost: 0, calls: 0 };
    agentMap.set(row.agent_name, {
      cost: prev.cost + (row.total_cost_microdollars ?? 0),
      calls: prev.calls + (row.total_events ?? 0),
    });
  }
  const topAgents = Array.from(agentMap.entries())
    .map(([name, d]) => ({ name, cost: d.cost / 1_000_000, calls: d.calls }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 10);

  // Budget remaining
  const budgets = await supabaseQuery<BudgetRow[]>(
    env, 'budgets', `org_id=eq.${auth.org_id}&period=eq.monthly&select=limit_microdollars,period&limit=1`,
  );
  const budgetLimit = budgets?.[0]?.limit_microdollars ?? 0;
  const budgetRemaining = Math.max(0, budgetLimit - totalCost) / 1_000_000;

  // Trend
  const dayMap = new Map<string, number>();
  for (const row of data) {
    const day = row.hour_bucket.slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + (row.total_cost_microdollars ?? 0));
  }
  const days = Array.from(dayMap.values());
  let trend = 'stable';
  if (days.length >= 2) {
    const recent = days.slice(-Math.ceil(days.length / 2));
    const older = days.slice(0, Math.floor(days.length / 2));
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : recentAvg;
    if (recentAvg > olderAvg * 1.1) trend = 'increasing';
    else if (recentAvg < olderAvg * 0.9) trend = 'decreasing';
  }

  return corsResponse(200, {
    totalCost: totalCost / 1_000_000,
    budgetRemaining,
    topAgents,
    trend,
  });
}

async function handleContextCheck(request: Request, env: Env): Promise<Response> {
  const auth = await authenticateRequest(request, env);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const agentName = url.searchParams.get('agentName');
  if (!agentName) return corsResponse(400, { error: 'agentName is required' });

  const currentMessageCount = Number(url.searchParams.get('currentMessageCount') || '0');
  const estimatedTokens = Number(url.searchParams.get('estimatedTokens') || '0');

  // Get recent events for this agent to calculate averages
  const rows = await supabaseQuery<ContextRow[]>(
    env, 'cost_events',
    `org_id=eq.${auth.org_id}&agent_name=eq.${agentName}&select=context_utilization,system_prompt_tokens,conversation_tokens,tool_result_tokens,model_context_limit,input_tokens,output_tokens&order=event_timestamp.desc&limit=50`,
  );
  const data = rows ?? [];

  if (data.length === 0) {
    // No history — use client-provided estimates
    const contextLimit = 128000; // default assumption
    const utilization = estimatedTokens > 0 ? Math.min((estimatedTokens / contextLimit) * 100, 100) : 0;
    return corsResponse(200, {
      utilization: Math.round(utilization * 10) / 10,
      breakdown: { system: 0, conversation: 0, toolResults: 0 },
      status: utilization > 90 ? 'critical' : utilization > 70 ? 'warning' : 'ok',
      suggestions: utilization > 70
        ? ['Consider summarizing older messages', 'Trim large tool results']
        : [],
    });
  }

  // Average from recent events
  const avgUtil = data.reduce((s, r) => s + (r.context_utilization ?? 0), 0) / data.length;
  const avgSystem = data.reduce((s, r) => s + (r.system_prompt_tokens ?? 0), 0) / data.length;
  const avgConvo = data.reduce((s, r) => s + (r.conversation_tokens ?? 0), 0) / data.length;
  const avgTool = data.reduce((s, r) => s + (r.tool_result_tokens ?? 0), 0) / data.length;
  const contextLimit = data.find(r => r.model_context_limit)?.model_context_limit ?? 128000;

  const utilization = avgUtil > 0
    ? avgUtil * 100
    : estimatedTokens > 0
      ? Math.min((estimatedTokens / contextLimit) * 100, 100)
      : 0;

  const status = utilization > 90 ? 'critical' : utilization > 70 ? 'warning' : 'ok';

  const suggestions: string[] = [];
  if (utilization > 70) {
    if (avgTool > avgConvo) suggestions.push('Tool results are using more tokens than conversation — consider trimming tool output');
    if (avgSystem > contextLimit * 0.3) suggestions.push('System prompt is very large — consider compressing instructions');
    suggestions.push('Consider summarizing older conversation messages');
    if (currentMessageCount > 20) suggestions.push(`High message count (${currentMessageCount}) — consider pruning early turns`);
  }

  return corsResponse(200, {
    utilization: Math.round(utilization * 10) / 10,
    breakdown: {
      system: Math.round(avgSystem),
      conversation: Math.round(avgConvo),
      toolResults: Math.round(avgTool),
    },
    status,
    suggestions,
  });
}

async function handleBudgetCheck(request: Request, env: Env): Promise<Response> {
  const auth = await authenticateRequest(request, env);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const agentName = url.searchParams.get('agentName');
  if (!agentName) return corsResponse(400, { error: 'agentName is required' });

  const estimatedCost = Number(url.searchParams.get('estimatedCost') || '0');

  // Get monthly budget
  const budgets = await supabaseQuery<BudgetRow[]>(
    env, 'budgets', `org_id=eq.${auth.org_id}&period=eq.monthly&select=limit_microdollars,period&limit=1`,
  );
  const budgetLimit = budgets?.[0]?.limit_microdollars ?? 0;

  // Get current month spending
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const spendRows = await supabaseQuery<CostSummaryRow[]>(
    env, 'cost_summaries_hourly',
    `org_id=eq.${auth.org_id}&select=total_cost_microdollars&hour_bucket=gte.${monthStart}`,
  );
  const spent = (spendRows ?? []).reduce((s, r) => s + (r.total_cost_microdollars ?? 0), 0);
  const remaining = Math.max(0, budgetLimit - spent);

  const limitDollars = budgetLimit / 1_000_000;
  const spentDollars = spent / 1_000_000;
  const remainingDollars = remaining / 1_000_000;

  let decision: 'allow' | 'warn' | 'block' = 'allow';
  let warning: string | undefined;

  if (budgetLimit > 0) {
    const usagePct = (spent / budgetLimit) * 100;
    if (estimatedCost > 0 && (spent + estimatedCost * 1_000_000) > budgetLimit) {
      decision = 'block';
      warning = `Estimated cost $${estimatedCost.toFixed(2)} would exceed remaining budget $${remainingDollars.toFixed(2)}`;
    } else if (usagePct > 90) {
      decision = 'warn';
      warning = `Budget usage at ${usagePct.toFixed(1)}% — approaching limit`;
    } else if (usagePct > 75) {
      decision = 'warn';
      warning = `Budget usage at ${usagePct.toFixed(1)}%`;
    }
  }

  return corsResponse(200, {
    budget: { limit: limitDollars, spent: spentDollars, remaining: remainingDollars },
    decision,
    ...(warning ? { warning } : {}),
  });
}

async function handleRecommendations(request: Request, env: Env): Promise<Response> {
  const auth = await authenticateRequest(request, env);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const agentName = url.searchParams.get('agentName');

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let query = `org_id=eq.${auth.org_id}&select=agent_name,model,total_cost_microdollars,total_events,hour_bucket&hour_bucket=gte.${weekAgo}`;
  if (agentName) query += `&agent_name=eq.${agentName}`;

  const rows = await supabaseQuery<(CostSummaryRow & { model: string })[]>(env, 'cost_summaries_hourly', query);
  const data = rows ?? [];

  const recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    type: string;
    action: string;
    currentCost: number;
    projectedCost: number;
    monthlySaving: number;
  }> = [];

  // Analyze model usage for downgrade opportunities
  const modelCosts = new Map<string, number>();
  for (const row of data) {
    modelCosts.set(row.model, (modelCosts.get(row.model) ?? 0) + (row.total_cost_microdollars ?? 0));
  }

  const expensiveModels = ['gpt-4', 'gpt-4-turbo', 'claude-3-opus-20240229', 'claude-opus-4-20250514'];
  const cheaperAlternatives: Record<string, string> = {
    'gpt-4': 'gpt-4o-mini',
    'gpt-4-turbo': 'gpt-4o',
    'claude-3-opus-20240229': 'claude-sonnet-4-20250514',
    'claude-opus-4-20250514': 'claude-sonnet-4-20250514',
  };

  for (const [model, cost] of modelCosts) {
    if (expensiveModels.includes(model) && cost > 100_000) {
      const alt = cheaperAlternatives[model] ?? 'a cheaper model';
      const saving = (cost * 0.6) / 1_000_000; // estimate 60% saving
      recommendations.push({
        priority: cost > 1_000_000 ? 'high' : 'medium',
        type: 'model_downgrade',
        action: `Consider switching from ${model} to ${alt} for routine tasks`,
        currentCost: cost / 1_000_000,
        projectedCost: (cost * 0.4) / 1_000_000,
        monthlySaving: saving * 4, // weekly to monthly
      });
    }
  }

  // Context optimization recommendations
  const contextRows = await supabaseQuery<ContextRow[]>(
    env, 'cost_events',
    `org_id=eq.${auth.org_id}&context_utilization=gt.0.7&select=context_utilization,system_prompt_tokens,conversation_tokens,tool_result_tokens,input_tokens,output_tokens,model_context_limit&order=event_timestamp.desc&limit=50${agentName ? `&agent_name=eq.${agentName}` : ''}`,
  );

  if (contextRows && contextRows.length > 10) {
    const avgTokens = contextRows.reduce((s, r) => s + r.input_tokens + r.output_tokens, 0) / contextRows.length;
    const avgToolTokens = contextRows.reduce((s, r) => s + (r.tool_result_tokens ?? 0), 0) / contextRows.length;
    if (avgToolTokens > avgTokens * 0.3) {
      recommendations.push({
        priority: 'high',
        type: 'context_optimization',
        action: 'Tool results consume >30% of context — implement tool_result_trimming',
        currentCost: 0,
        projectedCost: 0,
        monthlySaving: 0,
      });
    }
    recommendations.push({
      priority: 'medium',
      type: 'context_summarization',
      action: `${contextRows.length} recent calls had >70% context utilization — summarize older messages`,
      currentCost: 0,
      projectedCost: 0,
      monthlySaving: 0,
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'low',
      type: 'none',
      action: 'No optimization recommendations at this time — usage looks efficient',
      currentCost: 0,
      projectedCost: 0,
      monthlySaving: 0,
    });
  }

  return corsResponse(200, { recommendations });
}

// --- Helpers ---

function validateEvent(event: CostEventPayload): string | null {
  if (!event.eventId) return 'missing eventId';
  if (!event.timestamp) return 'missing timestamp';
  if (!event.traceId) return 'missing traceId';
  if (!event.spanId) return 'missing spanId';
  if (!event.agentName) return 'missing agentName';
  if (!event.provider) return 'missing provider';
  if (!event.model) return 'missing model';
  if (typeof event.inputTokens !== 'number' || event.inputTokens < 0) return 'invalid inputTokens';
  if (typeof event.outputTokens !== 'number' || event.outputTokens < 0) return 'invalid outputTokens';
  return null;
}

function recalculateCost(event: CostEventPayload, pricing: ModelPricing): number {
  let total = 0;
  const cached = event.cachedTokens ?? 0;
  const effectiveInput = event.inputTokens - cached;

  if (effectiveInput > 0) {
    total += intDivRound(effectiveInput * pricing.input_price_per_m_token, 1_000_000);
  }

  if (cached > 0) {
    const cachedPrice = pricing.cached_input_price_per_m_token ?? pricing.input_price_per_m_token;
    total += intDivRound(cached * cachedPrice, 1_000_000);
  }

  if (event.outputTokens > 0) {
    total += intDivRound(event.outputTokens * pricing.output_price_per_m_token, 1_000_000);
  }

  if (event.reasoningTokens && event.reasoningTokens > 0) {
    const reasoningPrice = pricing.reasoning_price_per_m_token ?? pricing.output_price_per_m_token;
    total += intDivRound(event.reasoningTokens * reasoningPrice, 1_000_000);
  }

  return total;
}

function intDivRound(numerator: number, denominator: number): number {
  const quotient = Math.trunc(numerator / denominator);
  const remainder = numerator - quotient * denominator;
  if (remainder * 2 >= denominator) return quotient + 1;
  return quotient;
}

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function supabaseQuery<T>(env: Env, table: string, query: string): Promise<T | null> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

function corsResponse(status: number, body?: unknown): Response {
  return new Response(body ? JSON.stringify(body) : null, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
