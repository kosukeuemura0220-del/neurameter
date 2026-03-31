-- ============================================================
-- NeuraMeter v2.0 — Guards + Context Analysis Migration
-- ============================================================

-- ============================================================
-- 1. Extend cost_events with context + guard columns
-- ============================================================
ALTER TABLE cost_events
  ADD COLUMN IF NOT EXISTS context_utilization NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS model_context_limit INTEGER,
  ADD COLUMN IF NOT EXISTS message_count INTEGER,
  ADD COLUMN IF NOT EXISTS system_prompt_tokens INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversation_tokens INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tool_result_tokens INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS guard_mode TEXT,
  ADD COLUMN IF NOT EXISTS guard_decision TEXT,
  ADD COLUMN IF NOT EXISTS guard_triggered_rules TEXT[];

-- New indexes for guard/context queries
CREATE INDEX IF NOT EXISTS idx_ce_guard
  ON cost_events(org_id, guard_decision, event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ce_context
  ON cost_events(org_id, context_utilization DESC);

-- ============================================================
-- 2. Guard Events table (new)
-- ============================================================
CREATE TABLE IF NOT EXISTS guard_events (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES organizations(id),
  project_id        UUID NOT NULL REFERENCES projects(id),
  agent_name        TEXT NOT NULL,
  guard_mode        TEXT NOT NULL,
  decision          TEXT NOT NULL,
  triggered_rules   JSONB NOT NULL DEFAULT '[]',
  context_analysis  JSONB,
  optimization      JSONB,
  suggestion        TEXT,
  event_timestamp   TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE guard_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_guard_events_org_time
  ON guard_events(org_id, event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_guard_events_decision
  ON guard_events(org_id, decision, event_timestamp DESC);

-- RLS for guard_events
CREATE POLICY guard_events_select ON guard_events
  FOR SELECT USING (is_org_member(org_id));

-- ============================================================
-- 3. Guard Configs table (new)
-- ============================================================
CREATE TABLE IF NOT EXISTS guard_configs (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id                  UUID REFERENCES projects(id) ON DELETE CASCADE,
  agent_name                  TEXT,
  guard_mode                  TEXT NOT NULL DEFAULT 'notify',
  max_input_tokens            INTEGER,
  max_input_tokens_hard       INTEGER,
  max_cost_per_call           NUMERIC,
  max_cost_per_call_hard      NUMERIC,
  max_cost_per_hour           NUMERIC,
  max_context_utilization     NUMERIC(3,2),
  max_context_utilization_hard NUMERIC(3,2),
  notify_slack_webhook        TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE guard_configs ENABLE ROW LEVEL SECURITY;

-- RLS for guard_configs
CREATE POLICY guard_configs_select ON guard_configs
  FOR SELECT USING (is_org_member(org_id));

CREATE POLICY guard_configs_insert ON guard_configs
  FOR INSERT WITH CHECK (has_org_role(org_id, ARRAY['owner', 'admin']::org_role[]));

CREATE POLICY guard_configs_update ON guard_configs
  FOR UPDATE USING (has_org_role(org_id, ARRAY['owner', 'admin']::org_role[]));

CREATE POLICY guard_configs_delete ON guard_configs
  FOR DELETE USING (has_org_role(org_id, ARRAY['owner', 'admin']::org_role[]));

-- ============================================================
-- 4. Extend cost_summaries_hourly with context/guard aggregation
-- ============================================================
ALTER TABLE cost_summaries_hourly
  ADD COLUMN IF NOT EXISTS avg_context_utilization NUMERIC(4,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_context_utilization NUMERIC(4,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_guard_notifies INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_guard_blocks INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_guard_optimized INTEGER DEFAULT 0;

-- ============================================================
-- 5. Extend model_pricing with context window + max output
-- ============================================================
ALTER TABLE model_pricing
  ADD COLUMN IF NOT EXISTS context_window_size INTEGER,
  ADD COLUMN IF NOT EXISTS max_output_tokens INTEGER;

-- Update existing pricing data with context window sizes
UPDATE model_pricing SET context_window_size = 128000, max_output_tokens = 16384
  WHERE provider = 'openai' AND model = 'gpt-4o';
UPDATE model_pricing SET context_window_size = 128000, max_output_tokens = 16384
  WHERE provider = 'openai' AND model = 'gpt-4o-mini';
UPDATE model_pricing SET context_window_size = 1000000, max_output_tokens = 32768
  WHERE provider = 'openai' AND model = 'gpt-4.1';
UPDATE model_pricing SET context_window_size = 1000000, max_output_tokens = 32768
  WHERE provider = 'openai' AND model = 'gpt-4.1-mini';
UPDATE model_pricing SET context_window_size = 200000, max_output_tokens = 100000
  WHERE provider = 'openai' AND model = 'o1';
UPDATE model_pricing SET context_window_size = 200000, max_output_tokens = 100000
  WHERE provider = 'openai' AND model = 'o3-mini';
UPDATE model_pricing SET context_window_size = 200000, max_output_tokens = 16000
  WHERE provider = 'anthropic' AND model = 'claude-sonnet-4-20250514';
UPDATE model_pricing SET context_window_size = 200000, max_output_tokens = 16000
  WHERE provider = 'anthropic' AND model = 'claude-haiku-4-5-20251001';
UPDATE model_pricing SET context_window_size = 200000, max_output_tokens = 32000
  WHERE provider = 'anthropic' AND model = 'claude-opus-4-20250514';

-- ============================================================
-- 6. Update hourly summary trigger to include v2 fields
-- ============================================================
CREATE OR REPLACE FUNCTION update_cost_summary_hourly()
RETURNS TRIGGER AS $$
DECLARE
  guard_notify_inc INTEGER := 0;
  guard_block_inc INTEGER := 0;
  guard_optimized_inc INTEGER := 0;
BEGIN
  -- Count guard decisions
  IF NEW.guard_decision = 'notify' THEN guard_notify_inc := 1; END IF;
  IF NEW.guard_decision = 'block' THEN guard_block_inc := 1; END IF;
  IF NEW.guard_decision = 'optimized' THEN guard_optimized_inc := 1; END IF;

  INSERT INTO cost_summaries_hourly (
    org_id, project_id, hour_bucket, agent_name, model, provider, customer_id,
    total_events, total_input_tokens, total_output_tokens,
    total_cost_microdollars, avg_latency_ms,
    avg_context_utilization, max_context_utilization,
    total_guard_notifies, total_guard_blocks, total_guard_optimized,
    updated_at
  ) VALUES (
    NEW.org_id, NEW.project_id,
    date_trunc('hour', NEW.event_timestamp),
    NEW.agent_name, NEW.model, NEW.provider,
    COALESCE(NEW.customer_id, ''),
    1, NEW.input_tokens, NEW.output_tokens,
    NEW.cost_microdollars, NEW.latency_ms,
    COALESCE(NEW.context_utilization, 0),
    COALESCE(NEW.context_utilization, 0),
    guard_notify_inc, guard_block_inc, guard_optimized_inc,
    now()
  )
  ON CONFLICT (org_id, project_id, hour_bucket, agent_name, model, provider, customer_id)
  DO UPDATE SET
    total_events = cost_summaries_hourly.total_events + 1,
    total_input_tokens = cost_summaries_hourly.total_input_tokens + EXCLUDED.total_input_tokens,
    total_output_tokens = cost_summaries_hourly.total_output_tokens + EXCLUDED.total_output_tokens,
    total_cost_microdollars = cost_summaries_hourly.total_cost_microdollars + EXCLUDED.total_cost_microdollars,
    avg_latency_ms = (
      (cost_summaries_hourly.avg_latency_ms * cost_summaries_hourly.total_events + EXCLUDED.avg_latency_ms)
      / (cost_summaries_hourly.total_events + 1)
    ),
    avg_context_utilization = (
      (cost_summaries_hourly.avg_context_utilization * cost_summaries_hourly.total_events + EXCLUDED.avg_context_utilization)
      / (cost_summaries_hourly.total_events + 1)
    ),
    max_context_utilization = GREATEST(cost_summaries_hourly.max_context_utilization, EXCLUDED.max_context_utilization),
    total_guard_notifies = cost_summaries_hourly.total_guard_notifies + EXCLUDED.total_guard_notifies,
    total_guard_blocks = cost_summaries_hourly.total_guard_blocks + EXCLUDED.total_guard_blocks,
    total_guard_optimized = cost_summaries_hourly.total_guard_optimized + EXCLUDED.total_guard_optimized,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 7. Extend organizations with plan + stripe
-- ============================================================
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- ============================================================
-- 8. Update budgets for v2 schema
-- ============================================================
ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS scope_type TEXT,
  ADD COLUMN IF NOT EXISTS scope_id TEXT,
  ADD COLUMN IF NOT EXISTS notify_email BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_slack_webhook TEXT;
