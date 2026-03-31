-- ============================================================
-- NeuraMeter — Initial Schema
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. Organizations
-- ============================================================
CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Organization Members
-- ============================================================
CREATE TYPE org_role AS ENUM ('owner', 'admin', 'member', 'viewer');

CREATE TABLE org_members (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        org_role NOT NULL DEFAULT 'member',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);

ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. Projects
-- ============================================================
CREATE TABLE projects (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, slug)
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. API Keys (SHA-256 hash only, no plaintext)
-- ============================================================
CREATE TABLE api_keys (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  key_hash     TEXT NOT NULL UNIQUE,  -- SHA-256 hex digest
  key_prefix   TEXT NOT NULL,          -- First 8 chars for display (e.g. "nm_abc12...")
  scopes       TEXT[] NOT NULL DEFAULT ARRAY['ingest'],
  last_used_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at   TIMESTAMPTZ
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. Cost Events (main table)
-- ============================================================
CREATE TABLE cost_events (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id         TEXT NOT NULL UNIQUE,
  org_id           UUID NOT NULL REFERENCES organizations(id),
  project_id       UUID NOT NULL REFERENCES projects(id),
  event_timestamp  TIMESTAMPTZ NOT NULL,
  trace_id         TEXT NOT NULL,
  span_id          TEXT NOT NULL,
  parent_span_id   TEXT,
  agent_name       TEXT NOT NULL,
  task_name        TEXT,
  customer_id      TEXT,
  provider         TEXT NOT NULL,
  model            TEXT NOT NULL,
  input_tokens     INTEGER NOT NULL DEFAULT 0,
  output_tokens    INTEGER NOT NULL DEFAULT 0,
  reasoning_tokens INTEGER DEFAULT 0,
  cached_tokens    INTEGER DEFAULT 0,
  cost_microdollars BIGINT NOT NULL DEFAULT 0,
  latency_ms       INTEGER NOT NULL DEFAULT 0,
  tags             JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cost_events ENABLE ROW LEVEL SECURITY;

-- Indexes for cost_events
CREATE INDEX idx_cost_events_org_time
  ON cost_events(org_id, event_timestamp DESC);

CREATE INDEX idx_cost_events_agent
  ON cost_events(org_id, agent_name, event_timestamp DESC);

CREATE INDEX idx_cost_events_customer
  ON cost_events(org_id, customer_id, event_timestamp DESC);

CREATE INDEX idx_cost_events_trace
  ON cost_events(trace_id);

-- ============================================================
-- 6. Cost Summaries (hourly aggregation)
-- ============================================================
CREATE TABLE cost_summaries_hourly (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES organizations(id),
  project_id        UUID NOT NULL REFERENCES projects(id),
  hour_bucket       TIMESTAMPTZ NOT NULL,  -- truncated to hour
  agent_name        TEXT NOT NULL,
  model             TEXT NOT NULL,
  provider          TEXT NOT NULL,
  customer_id       TEXT,
  total_events      INTEGER NOT NULL DEFAULT 0,
  total_input_tokens  BIGINT NOT NULL DEFAULT 0,
  total_output_tokens BIGINT NOT NULL DEFAULT 0,
  total_cost_microdollars BIGINT NOT NULL DEFAULT 0,
  avg_latency_ms    INTEGER NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, project_id, hour_bucket, agent_name, model, provider, customer_id)
);

ALTER TABLE cost_summaries_hourly ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_summaries_org_hour
  ON cost_summaries_hourly(org_id, hour_bucket DESC);

-- ============================================================
-- 7. Budgets
-- ============================================================
CREATE TABLE budgets (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id       UUID REFERENCES projects(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  period           TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly')),
  limit_microdollars BIGINT NOT NULL,
  alert_threshold_pct INTEGER NOT NULL DEFAULT 80,  -- alert at 80%
  agent_name       TEXT,        -- optional: scope to specific agent
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 8. Model Pricing
-- ============================================================
CREATE TABLE model_pricing (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider                 TEXT NOT NULL,
  model                    TEXT NOT NULL,
  input_price_per_m_token  BIGINT NOT NULL,  -- microdollars per 1M tokens
  output_price_per_m_token BIGINT NOT NULL,
  reasoning_price_per_m_token BIGINT,
  cached_input_price_per_m_token BIGINT,
  effective_from           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, model, effective_from)
);

ALTER TABLE model_pricing ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Trigger: Auto-update cost_summaries_hourly on INSERT
-- ============================================================
CREATE OR REPLACE FUNCTION update_cost_summary_hourly()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO cost_summaries_hourly (
    org_id, project_id, hour_bucket, agent_name, model, provider, customer_id,
    total_events, total_input_tokens, total_output_tokens,
    total_cost_microdollars, avg_latency_ms, updated_at
  ) VALUES (
    NEW.org_id,
    NEW.project_id,
    date_trunc('hour', NEW.event_timestamp),
    NEW.agent_name,
    NEW.model,
    NEW.provider,
    COALESCE(NEW.customer_id, ''),
    1,
    NEW.input_tokens,
    NEW.output_tokens,
    NEW.cost_microdollars,
    NEW.latency_ms,
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
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cost_event_summary
  AFTER INSERT ON cost_events
  FOR EACH ROW
  EXECUTE FUNCTION update_cost_summary_hourly();

-- ============================================================
-- RLS Policies
-- ============================================================

-- Helper function: check org membership
CREATE OR REPLACE FUNCTION is_org_member(check_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = check_org_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: check org role
CREATE OR REPLACE FUNCTION has_org_role(check_org_id UUID, required_roles org_role[])
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = check_org_id
      AND user_id = auth.uid()
      AND role = ANY(required_roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Organizations: members can read
CREATE POLICY org_select ON organizations
  FOR SELECT USING (is_org_member(id));

-- Organizations: owners/admins can update
CREATE POLICY org_update ON organizations
  FOR UPDATE USING (has_org_role(id, ARRAY['owner', 'admin']::org_role[]));

-- Org Members: members can see other members
CREATE POLICY org_members_select ON org_members
  FOR SELECT USING (is_org_member(org_id));

-- Org Members: owners/admins can manage
CREATE POLICY org_members_insert ON org_members
  FOR INSERT WITH CHECK (has_org_role(org_id, ARRAY['owner', 'admin']::org_role[]));

CREATE POLICY org_members_delete ON org_members
  FOR DELETE USING (has_org_role(org_id, ARRAY['owner', 'admin']::org_role[]));

-- Projects: members can read
CREATE POLICY projects_select ON projects
  FOR SELECT USING (is_org_member(org_id));

-- Projects: owners/admins can manage
CREATE POLICY projects_insert ON projects
  FOR INSERT WITH CHECK (has_org_role(org_id, ARRAY['owner', 'admin']::org_role[]));

CREATE POLICY projects_update ON projects
  FOR UPDATE USING (has_org_role(org_id, ARRAY['owner', 'admin']::org_role[]));

-- API Keys: members can read, owners/admins can manage
CREATE POLICY api_keys_select ON api_keys
  FOR SELECT USING (is_org_member(org_id));

CREATE POLICY api_keys_insert ON api_keys
  FOR INSERT WITH CHECK (has_org_role(org_id, ARRAY['owner', 'admin']::org_role[]));

CREATE POLICY api_keys_update ON api_keys
  FOR UPDATE USING (has_org_role(org_id, ARRAY['owner', 'admin']::org_role[]));

-- Cost Events: members can read (insert is via service role from worker)
CREATE POLICY cost_events_select ON cost_events
  FOR SELECT USING (is_org_member(org_id));

-- Cost Summaries: members can read
CREATE POLICY cost_summaries_select ON cost_summaries_hourly
  FOR SELECT USING (is_org_member(org_id));

-- Budgets: members can read, owners/admins can manage
CREATE POLICY budgets_select ON budgets
  FOR SELECT USING (is_org_member(org_id));

CREATE POLICY budgets_insert ON budgets
  FOR INSERT WITH CHECK (has_org_role(org_id, ARRAY['owner', 'admin']::org_role[]));

CREATE POLICY budgets_update ON budgets
  FOR UPDATE USING (has_org_role(org_id, ARRAY['owner', 'admin']::org_role[]));

-- Model Pricing: public read (no RLS restriction for select)
CREATE POLICY model_pricing_select ON model_pricing
  FOR SELECT USING (true);

-- ============================================================
-- Seed: Model Pricing Data
-- ============================================================
INSERT INTO model_pricing (provider, model, input_price_per_m_token, output_price_per_m_token, reasoning_price_per_m_token, cached_input_price_per_m_token) VALUES
  ('openai', 'gpt-4o', 2500000, 10000000, NULL, 1250000),
  ('openai', 'gpt-4o-mini', 150000, 600000, NULL, 75000),
  ('openai', 'gpt-4.1', 2000000, 8000000, NULL, 500000),
  ('openai', 'gpt-4.1-mini', 400000, 1600000, NULL, 100000),
  ('openai', 'o1', 15000000, 60000000, 60000000, 7500000),
  ('openai', 'o3-mini', 1100000, 4400000, 4400000, 550000),
  ('anthropic', 'claude-sonnet-4-20250514', 3000000, 15000000, NULL, 300000),
  ('anthropic', 'claude-haiku-4-5-20251001', 800000, 4000000, NULL, 80000),
  ('anthropic', 'claude-opus-4-20250514', 15000000, 75000000, NULL, 1500000);
