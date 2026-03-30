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
