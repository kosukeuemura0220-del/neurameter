# NeuraMeter 仕様書 v2.0
## AIエージェントコスト帰属・予算ガバナンス・コンテキスト最適化プラットフォーム
## by NEURIA

---

## 1. プロダクト概要

### 1.1 一言定義
AIエージェントの利用コストを「エージェント単位」「タスク単位」「顧客単位」でリアルタイム追跡し、コンテキストウィンドウの効率を監視し、ユーザーが選択した3つのモード（通知/停止/自動最適化）で対処し、MCPサーバーでエージェント自身がコストを自律最適化できるプラットフォーム。

### 1.2 ブランド情報
- **プロダクト名：** NeuraMeter
- **読み：** ニューラメーター
- **URL：** https://meter.neuria.tech
- **Ingestion API：** https://ingest.meter.neuria.tech
- **MCP Server：** mcp.meter.neuria.tech（Phase 3）
- **npmスコープ：** @neurameter
- **GitHub：** github.com/neuria-dev/neurameter
- **ライセンス：** MIT
- **親ブランド：** NEURIA（ニューリア）

### 1.3 v2.0の3層アーキテクチャ

```
Layer 1：計測＆可視化（Measure）
  └── コスト追跡、コンテキスト使用率監視、ダッシュボード

Layer 2：ガードレール（Guard）— ユーザーが3モードから選択
  ├── Mode 1: 📢 通知のみ（Notify）     ← デフォルト
  ├── Mode 2: 🛑 自動停止（Block）
  └── Mode 3: 🔄 MCP自動改善（Auto-Optimize）

Layer 3：自律最適化（Optimize）
  └── MCPサーバー経由でエージェントが自分のコストを確認し、自律的に最適化
```

**OpenClawとの連携：**
```
OpenClaw（エージェント実行）
  ├── NeuraMeter SDK → Layer 1: コスト＆コンテキスト計測
  │                  → Layer 2: ユーザーが選んだモードで対処
  └── NeuraMeter MCP → Layer 3: エージェントが自律的にコスト最適化
```

### 1.4 コンポーネント構成
```
NeuraMeter
├── SDK（npmパッケージ群）       — 計測 + ガードレール（3モード）
├── Ingestion API                — イベント受信
├── Dashboard（Next.js）         — 可視化 + コンテキスト分析 + ガード設定UI
├── Model Pricing DB             — LLMモデル価格 + コンテキスト上限
├── Guards Engine                — 3モードのガードレール判定エンジン
└── MCP Server                   — エージェント向けコスト情報 + 自動改善IF
```

### 1.5 ターゲットユーザー
- LangChain / CrewAI / OpenAI Agents SDK / Vercel AI SDKでエージェントを構築している開発者
- AIエージェントを本番運用しているスタートアップ・中規模企業
- SaaS企業で顧客ごとのAIコスト原価を把握したいPM
- コンテキストの肥大化でコスト暴走に悩むエージェント開発者

---

## 2. SDKパッケージ仕様

### 2.1 パッケージ構成
```
@neurameter/core         — 共通IF、コスト計算、ガードレール（3モード）
@neurameter/openai       — OpenAIラッパー
@neurameter/anthropic    — Anthropicラッパー
@neurameter/vercel-ai    — Vercel AI SDK統合
@neurameter/langchain    — LangChain/LangGraph統合（Phase 2）
@neurameter/crewai       — CrewAI統合（Phase 2）
@neurameter/transport    — 非同期バッチング＆送信
@neurameter/mcp-server   — MCPサーバー（Phase 3）
```

### 2.2 SDK設計原則
- ラッパー関数パターン（モンキーパッチではない）
- 5KB gzip以下、依存関係ゼロ（core + provider）
- ネイティブ fetch() + crypto.randomUUID()
- tsup ESM/CJSデュアル出力
- 非同期バッチ送信（50〜100イベント/リクエスト）
- OpenTelemetry セマンティック規約準拠
- ガードレールはSDK内で同期実行（API呼び出し前に判定）
- **ガードレールのデフォルトは「通知のみ」（勝手に止めない）**

### 2.3 SDK使用例

#### 基本使用（Layer 1：計測のみ）
```typescript
import { NeuraMeter } from '@neurameter/core';
import { withMeter } from '@neurameter/openai';
import OpenAI from 'openai';

const meter = new NeuraMeter({
  apiKey: 'nm_xxxxxxxxxxxx',
  projectId: 'proj_xxxx',
});

const openai = withMeter(new OpenAI(), meter);

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
}, {
  agentName: 'SupportAgent',
  taskName: 'classify-ticket',
  customerId: 'cust_123',
  tags: { team: 'support', priority: 'high' },
});
```

#### ガードレール付き — 3モード選択（Layer 2）
```typescript
const meter = new NeuraMeter({
  apiKey: 'nm_xxxxxxxxxxxx',
  projectId: 'proj_xxxx',
  guards: {
    // ========== 閾値設定 ==========
    maxInputTokens: 50_000,
    maxContextUtilization: 0.80,
    maxCostPerCall: 0.50,
    maxCostPerHour: 50.00,

    // ========== モード選択（ユーザーが決める） ==========
    // 'notify'        → 📢 通知のみ。APIコールは止めない（デフォルト）
    // 'block'         → 🛑 自動停止。閾値超えたらAPIコールを実行しない
    // 'auto-optimize' → 🔄 MCP接続自動改善。エージェントに最適化を指示
    mode: 'notify',
  },
});
```

**Mode 1: 通知のみ（notify）— デフォルト**
```typescript
const meter = new NeuraMeter({
  guards: {
    maxInputTokens: 50_000,
    maxContextUtilization: 0.80,
    mode: 'notify',  // デフォルト

    // 通知先の設定（任意）
    notifySlackWebhook: 'https://hooks.slack.com/services/xxx',
    notifyDashboard: true,  // ダッシュボードにアラート表示（デフォルトtrue）
  },
});

// → 閾値を超えてもAPIコールは実行される
// → Slack + ダッシュボードに「⚠️ SupportAgentが50,000トークンを超えました」と通知
// → 開発者が後から確認して対処を判断
```

**Mode 2: 自動停止（block）**
```typescript
const meter = new NeuraMeter({
  guards: {
    maxInputTokens: 50_000,
    maxInputTokensHard: 100_000,  // blockモード時のみ有効
    maxContextUtilization: 0.80,
    maxContextUtilizationHard: 0.95,
    maxCostPerCallHard: 2.00,
    mode: 'block',

    // ソフトリミット → 通知のみ
    // ハードリミット → APIコールをブロック
  },
});

// → ソフトリミット超え: 通知のみ（notifyモードと同じ）
// → ハードリミット超え: NeuraMeterGuardError をthrow
//    → 開発者がtry/catchで処理を決定

try {
  await openai.chat.completions.create({ ... });
} catch (e) {
  if (e instanceof NeuraMeterGuardError) {
    console.log(e.rule);       // 'context_utilization'
    console.log(e.current);    // 0.96
    console.log(e.threshold);  // 0.95
    console.log(e.suggestion); // 'Summarize conversation history to save ~80K tokens'
    // 開発者が対処を決める
  }
}
```

**Mode 3: MCP接続自動改善（auto-optimize）**
```typescript
const meter = new NeuraMeter({
  guards: {
    maxInputTokens: 50_000,
    maxContextUtilization: 0.80,
    mode: 'auto-optimize',

    // 自動改善のコールバック
    // NeuraMeterが「何が問題か」を判定し、このコールバックに渡す
    // エージェント側が具体的な改善アクションを実行する
    onOptimize: async (event) => {
      // event.type: 問題の種類
      // event.suggestion: NeuraMeterの提案
      // event.metrics: 現在のメトリクス

      if (event.type === 'context_utilization') {
        // 会話履歴を要約する
        const summarized = await summarizeHistory(event.metrics.messages);
        return { action: 'retry', messages: summarized };
      }

      if (event.type === 'cost_per_call') {
        // 安いモデルに切り替える
        return { action: 'retry', model: 'gpt-4o-mini' };
      }

      // 対処できない場合は通知に留める
      return { action: 'notify' };
    },
  },
});

// → 閾値超え時の動作:
//    1. NeuraMeterが問題を分析（コンテキスト肥大? コスト高? 予算超過?）
//    2. onOptimizeコールバックに渡す
//    3. コールバックが改善アクションを返す
//       'retry' → 改善後の内容でAPIコールをリトライ
//       'notify' → 通知だけ（改善できない場合のフォールバック）
//       'block' → やはり止める
//    4. 改善結果をNeuraMeterに記録（before/after比較用）
```

#### マルチエージェント（親子トレース）
```typescript
const parentTrace = meter.startTrace({
  agentName: 'OrchestratorAgent',
  customerId: 'cust_123',
});

await openai.chat.completions.create({
  model: 'gpt-4o-mini', messages: [...],
}, { agentName: 'ClassifierAgent', traceId: parentTrace.traceId });

import { withMeter as withMeterAnthropic } from '@neurameter/anthropic';
import Anthropic from '@anthropic-ai/sdk';
const anthropic = withMeterAnthropic(new Anthropic(), meter);

await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514', max_tokens: 1024, messages: [...],
}, { agentName: 'DraftAgent', traceId: parentTrace.traceId });

parentTrace.end();
```

### 2.4 ガードレール判定フロー

```
API呼び出しリクエスト
  → [1] 入力トークン数を推定
  → [2] コンテキスト使用率 = 推定トークン ÷ モデル上限
  → [3] コスト推定
  → [4] レート制限チェック
  → [5] ガードレール判定 + モードに応じた処理
  
  mode: 'notify'
    → 閾値超え → 通知送信（Slack/ダッシュボード）→ APIコール実行
    
  mode: 'block'
    → ソフトリミット超え → 通知送信 → APIコール実行
    → ハードリミット超え → NeuraMeterGuardError throw → APIコール中止

  mode: 'auto-optimize'
    → 閾値超え → onOptimizeコールバック呼び出し
      → 'retry' → 改善内容でリトライ
      → 'notify' → 通知のみ、APIコール実行
      → 'block' → APIコール中止
      
  → [6] 判定イベントを非同期送信
```

### 2.5 GuardEvent型
```typescript
interface GuardEvent {
  eventId: string;
  timestamp: string;
  agentName: string;
  
  // モード
  guardMode: 'notify' | 'block' | 'auto-optimize';
  
  // 判定結果
  decision: 'allow' | 'notify' | 'block' | 'optimized';
  
  // トリガーされたルール
  triggeredRules: Array<{
    ruleType: 'input_tokens' | 'cost_per_call' | 'cost_per_hour' 
            | 'context_utilization' | 'budget';
    currentValue: number;
    threshold: number;
  }>;
  
  // コンテキスト分析
  contextAnalysis?: {
    estimatedInputTokens: number;
    modelContextLimit: number;
    utilizationPercent: number;
    messageCount: number;
    systemPromptTokens: number;
    conversationTokens: number;
    toolResultTokens: number;
  };
  
  // 自動改善結果（mode: 'auto-optimize' 時のみ）
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
```

### 2.6 コンテキスト分析ロジック
```typescript
function analyzeContext(messages: Message[], model: string): ContextAnalysis {
  const modelLimit = MODEL_CONTEXT_LIMITS[model] || 128_000;
  let systemTokens = 0, conversationTokens = 0, toolResultTokens = 0;
  for (const msg of messages) {
    const tokens = estimateTokens(msg.content);
    if (msg.role === 'system') systemTokens += tokens;
    else if (msg.role === 'tool') toolResultTokens += tokens;
    else conversationTokens += tokens;
  }
  const total = systemTokens + conversationTokens + toolResultTokens;
  return {
    estimatedInputTokens: total,
    modelContextLimit: modelLimit,
    utilizationPercent: total / modelLimit,
    messageCount: messages.length,
    systemPromptTokens: systemTokens,
    conversationTokens, toolResultTokens,
  };
}

const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'gpt-4o': 128_000, 'gpt-4o-mini': 128_000,
  'gpt-4.1': 1_000_000, 'gpt-4.1-mini': 1_000_000,
  'o1': 200_000, 'o3-mini': 200_000,
  'claude-sonnet-4': 200_000, 'claude-haiku-4': 200_000, 'claude-opus-4': 200_000,
};
```

### 2.7 CostEvent型（v2.0 拡張）
```typescript
interface CostEvent {
  eventId: string; timestamp: string;
  traceId: string; spanId: string; parentSpanId?: string;
  agentName: string; taskName?: string; customerId?: string;
  provider: 'openai' | 'anthropic' | 'google' | 'other';
  model: string;
  inputTokens: number; outputTokens: number;
  reasoningTokens?: number; cachedTokens?: number;
  costMicrodollars: number; latencyMs: number;
  // v2.0 コンテキスト
  contextUtilization: number;
  modelContextLimit: number;
  messageCount: number;
  systemPromptTokens: number;
  conversationTokens: number;
  toolResultTokens: number;
  // v2.0 ガードレール
  guardMode: 'notify' | 'block' | 'auto-optimize';
  guardDecision?: 'allow' | 'notify' | 'block' | 'optimized';
  guardTriggeredRules?: string[];
  // メタデータ
  tags?: Record<string, string>;
  orgId: string; projectId: string;
}
```

### 2.8 モデル価格DB（v2.0 拡張）
```typescript
interface ModelPricing {
  provider: string; model: string;
  inputPricePerMToken: number; outputPricePerMToken: number;
  reasoningPricePerMToken?: number; cachedInputDiscount?: number;
  contextWindowSize: number;   // v2.0
  maxOutputTokens: number;     // v2.0
  effectiveDate: string; source: string;
}
```

---

## 3. イベント取込API

### 3.1 エンドポイント
```
POST https://ingest.meter.neuria.tech/v1/events
POST https://ingest.meter.neuria.tech/v1/guard-events
```

### 3.2 認証
```
Authorization: Bearer nm_xxxxxxxxxxxx
```

### 3.3 インフラ
```
SDK → Cloudflare Workers → Supabase PostgreSQL
                             ├── cost_events（+ コンテキスト列 + ガード列）
                             ├── guard_events
                             ├── cost_summaries_hourly（+ コンテキスト集約）
                             └── Realtime → Dashboard
```

**DNS：**
```
meter.neuria.tech        → Vercel（ダッシュボード）
ingest.meter.neuria.tech → CF Workers（イベント取込）
mcp.meter.neuria.tech    → MCPサーバー（Phase 3）
```

---

## 4. データベース設計（v2.0）

```sql
-- 組織・認証（v1.0と同じ）
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, plan TEXT NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT now(), UNIQUE(org_id, user_id)
);
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL, key_prefix TEXT NOT NULL, name TEXT NOT NULL,
  scopes TEXT[] DEFAULT '{"write"}', last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- コストイベント（v2.0拡張）
CREATE TABLE cost_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL, project_id UUID NOT NULL,
  trace_id TEXT NOT NULL, span_id TEXT NOT NULL, parent_span_id TEXT,
  agent_name TEXT NOT NULL, task_name TEXT, customer_id TEXT,
  provider TEXT NOT NULL, model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
  reasoning_tokens INTEGER DEFAULT 0, cached_tokens INTEGER DEFAULT 0,
  cost_microdollars BIGINT NOT NULL DEFAULT 0, latency_ms INTEGER,
  -- v2.0
  context_utilization NUMERIC(4,3),
  model_context_limit INTEGER,
  message_count INTEGER,
  system_prompt_tokens INTEGER DEFAULT 0,
  conversation_tokens INTEGER DEFAULT 0,
  tool_result_tokens INTEGER DEFAULT 0,
  guard_mode TEXT,       -- 'notify' | 'block' | 'auto-optimize'
  guard_decision TEXT,   -- 'allow' | 'notify' | 'block' | 'optimized'
  guard_triggered_rules TEXT[],
  tags JSONB DEFAULT '{}',
  event_timestamp TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_ce_org_time ON cost_events(org_id, event_timestamp DESC);
CREATE INDEX idx_ce_agent ON cost_events(org_id, agent_name, event_timestamp DESC);
CREATE INDEX idx_ce_customer ON cost_events(org_id, customer_id, event_timestamp DESC);
CREATE INDEX idx_ce_trace ON cost_events(trace_id);
CREATE INDEX idx_ce_guard ON cost_events(org_id, guard_decision, event_timestamp DESC);
CREATE INDEX idx_ce_context ON cost_events(org_id, context_utilization DESC);

-- ガードイベント（v2.0新規）
CREATE TABLE guard_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL, project_id UUID NOT NULL,
  agent_name TEXT NOT NULL,
  guard_mode TEXT NOT NULL,       -- 'notify' | 'block' | 'auto-optimize'
  decision TEXT NOT NULL,          -- 'allow' | 'notify' | 'block' | 'optimized'
  triggered_rules JSONB NOT NULL,
  context_analysis JSONB,
  optimization JSONB,              -- auto-optimize時のbefore/after
  suggestion TEXT,
  event_timestamp TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ DEFAULT now()
);

-- 集約（v2.0拡張）
CREATE TABLE cost_summaries_hourly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL, project_id UUID NOT NULL, hour TIMESTAMPTZ NOT NULL,
  agent_name TEXT NOT NULL, model TEXT NOT NULL, provider TEXT NOT NULL, customer_id TEXT,
  total_input_tokens BIGINT DEFAULT 0, total_output_tokens BIGINT DEFAULT 0,
  total_cost_microdollars BIGINT DEFAULT 0, call_count INTEGER DEFAULT 0,
  avg_latency_ms INTEGER DEFAULT 0,
  -- v2.0
  avg_context_utilization NUMERIC(4,3) DEFAULT 0,
  max_context_utilization NUMERIC(4,3) DEFAULT 0,
  total_guard_notifies INTEGER DEFAULT 0,
  total_guard_blocks INTEGER DEFAULT 0,
  total_guard_optimized INTEGER DEFAULT 0,
  UNIQUE(org_id, project_id, hour, agent_name, model, provider, customer_id)
);

-- 予算
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL, scope_id TEXT NOT NULL,
  amount_microdollars BIGINT NOT NULL, period TEXT NOT NULL DEFAULT 'monthly',
  alert_threshold NUMERIC DEFAULT 0.8,
  notify_email BOOLEAN DEFAULT true, notify_slack_webhook TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ガードレール設定（v2.0新規）
CREATE TABLE guard_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id), agent_name TEXT,
  guard_mode TEXT NOT NULL DEFAULT 'notify',  -- デフォルトは通知のみ
  max_input_tokens INTEGER,
  max_input_tokens_hard INTEGER,
  max_cost_per_call NUMERIC,
  max_cost_per_call_hard NUMERIC,
  max_cost_per_hour NUMERIC,
  max_context_utilization NUMERIC(3,2),
  max_context_utilization_hard NUMERIC(3,2),
  notify_slack_webhook TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- モデル価格（v2.0拡張）
CREATE TABLE model_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL, model TEXT NOT NULL,
  input_price_per_m_tokens NUMERIC NOT NULL, output_price_per_m_tokens NUMERIC NOT NULL,
  reasoning_price_per_m_tokens NUMERIC, cached_input_discount NUMERIC DEFAULT 0,
  context_window_size INTEGER NOT NULL, max_output_tokens INTEGER,
  effective_date DATE NOT NULL, source TEXT DEFAULT 'official',
  UNIQUE(provider, model, effective_date)
);

INSERT INTO model_pricing (provider, model, input_price_per_m_tokens, output_price_per_m_tokens, context_window_size, max_output_tokens, effective_date) VALUES
('openai', 'gpt-4o',       2.50,  10.00, 128000,  16384,  '2026-03-01'),
('openai', 'gpt-4o-mini',  0.15,   0.60, 128000,  16384,  '2026-03-01'),
('openai', 'gpt-4.1',      2.00,   8.00, 1000000, 32768,  '2026-03-01'),
('openai', 'gpt-4.1-mini', 0.40,   1.60, 1000000, 32768,  '2026-03-01'),
('openai', 'o1',           15.00,  60.00, 200000, 100000,  '2026-03-01'),
('openai', 'o3-mini',       1.10,   4.40, 200000, 100000,  '2026-03-01'),
('anthropic', 'claude-sonnet-4-20250514', 3.00, 15.00, 200000, 16000, '2026-03-01'),
('anthropic', 'claude-haiku-4-5-20251001', 0.80, 4.00, 200000, 16000, '2026-03-01'),
('anthropic', 'claude-opus-4-20250514',  15.00, 75.00, 200000, 32000, '2026-03-01');

-- RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE guard_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE guard_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access" ON cost_events FOR ALL
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
-- 同様のポリシーを全テーブルに適用
```

---

## 5. ダッシュボード（v2.0）

### 5.1 技術スタック
```
Next.js 15 (App Router) + Supabase Auth/Realtime + shadcn/ui + Recharts + Tailwind v4
→ meter.neuria.tech
```

### 5.2 画面構成
```
/dashboard                 → コスト概要 + コンテキスト効率スコア + ガード発動数
/dashboard/agents          → エージェント別（コンテキスト使用率列含む）
/dashboard/agents/[name]   → 詳細（コンテキスト構成分析含む）
/dashboard/models          → モデル別比較
/dashboard/customers       → 顧客別
/dashboard/traces          → トレース一覧
/dashboard/traces/[id]     → スパンツリー + コンテキスト内訳
/dashboard/context         → コンテキスト効率分析（v2.0新規）
/dashboard/guards          → ガードレール設定UI — 3モード切替（v2.0新規）
/dashboard/guards/log      → ガード判定履歴（v2.0新規）
/dashboard/optimize        → 最適化レコメンデーション（v2.0新規）
/dashboard/budgets         → 予算管理
/settings/*                → 組織/APIキー/チーム/課金/MCP接続
```

### 5.3 ガードレール設定UI（/dashboard/guards）

```
┌────────────────────────────────────────────────────┐
│ ガードレール設定                                     │
├────────────────────────────────────────────────────┤
│ 対象: [プロジェクト全体 ▼]  [全エージェント ▼]       │
│                                                    │
│ ── モード選択 ──                                    │
│ ○ 📢 通知のみ（Notify）                  ← 推奨    │
│   閾値超えても止まりません。通知だけ送ります。         │
│                                                    │
│ ○ 🛑 自動停止（Block）                              │
│   ハードリミット超えたらAPIコールを止めます。          │
│                                                    │
│ ○ 🔄 MCP自動改善（Auto-Optimize）                   │
│   閾値超えたらエージェントに改善を指示し、              │
│   改善後に自動リトライします。                        │
│   ※ MCPサーバーの接続が必要です                       │
│                                                    │
│ ── 閾値設定 ──                                      │
│ 入力トークン（通知）:      [50,000  ] tokens         │
│ 入力トークン（停止※）:     [100,000 ] tokens         │
│ コンテキスト使用率（通知）:  [80%    ]               │
│ コンテキスト使用率（停止※）: [95%    ]               │
│ 1コールあたりコスト（通知）: [$0.50  ]               │
│ 1コールあたりコスト（停止※）: [$2.00 ]               │
│ 1時間あたり上限:            [$50.00 ]               │
│                                                    │
│ ※ 停止閾値はBlockモード時のみ有効                    │
│                                                    │
│ Slack通知先: [https://hooks.slack.com/... ]          │
│                                                    │
│ [保存]                                              │
└────────────────────────────────────────────────────┘
```

### 5.4 コンテキスト効率分析（/dashboard/context）
- エージェント別コンテキスト使用率（棒グラフ、80%/95%ライン）
- コンテキスト構成（system / 会話履歴 / ツール結果の比率）
- 使用率の時系列推移
- コスト×使用率の散布図
- 提案: 「会話履歴を要約すれば推定65%削減（$0.15/コール節約）」

### 5.5 最適化レコメンデーション（/dashboard/optimize）
自動生成ルール:
- コンテキスト使用率75%超 + 会話履歴比率60%超 → 圧縮提案
- 単純タスクにgpt-4o使用 → モデルダウングレード提案
- systemプロンプト1000トークン超 + キャッシュ未使用 → キャッシュ提案

---

## 6. MCPサーバー（Layer 3 — v2.0新規）

### 6.1 概要
エージェントが自分のコスト状況をリアルタイム確認し、自律的に最適化判断するためのMCPインターフェース。**任意のMCP対応エージェントから接続可能**（OpenClaw専用ではない）。

### 6.2 パッケージ
```bash
npm install @neurameter/mcp-server
```

### 6.3 起動
```typescript
import { NeuraMeterMCPServer } from '@neurameter/mcp-server';
const server = new NeuraMeterMCPServer({
  apiKey: 'nm_xxx', projectId: 'proj_xxx', transport: 'stdio',
});
server.start();
```

### 6.4 MCP設定（各エージェント共通）
```json
{
  "mcpServers": {
    "neurameter": {
      "command": "npx",
      "args": ["@neurameter/mcp-server", "--api-key", "nm_xxx", "--project", "proj_xxx"]
    }
  }
}
```

対応エージェント: Claude Desktop, Claude Code, Cursor, OpenClaw, LangChain（MCP Client経由）, CrewAI, OpenAI Agents SDK, その他MCP対応エージェント全般

### 6.5 提供ツール（5つ）

#### `neurameter_get_cost_summary`
```
説明: プロジェクト/エージェントのコスト概要を取得
入力: { period: "today"|"week"|"month", agentName?: string }
出力: { totalCost, budgetRemaining, topAgents[], trend }
```

#### `neurameter_check_context`
```
説明: コンテキスト効率を分析し、最適化提案を返す
入力: { agentName, currentMessageCount?, estimatedTokens? }
出力: { utilization, breakdown{system,conversation,toolResults}, status, suggestions[] }
```

#### `neurameter_check_budget`
```
説明: 次の操作が予算内か確認
入力: { agentName, estimatedCost? }
出力: { budget{limit,spent,remaining}, decision, warning? }
```

#### `neurameter_get_recommendations`
```
説明: 過去データに基づく最適化提案
入力: { agentName? }
出力: { recommendations[{priority,type,action,currentCost,projectedCost,monthlySaving}] }
```

#### `neurameter_log_optimization`
```
説明: 最適化アクションを記録（効果測定用）
入力: { agentName, optimizationType, tokensBefore?, tokensAfter?, description? }
```

### 6.6 OpenClaw統合シナリオ
```
[通常時]
  → neurameter_check_budget → "残り$57.20、ALLOW"
  → neurameter_check_context → "使用率45%、OK"
  → [通常実行]

[コンテキスト肥大化時]
  → neurameter_check_context → "⚠️ 使用率88%、会話履歴72%"
  → エージェント自律判断: 「要約してからAPI呼び出し」
  → neurameter_log_optimization → { before: 112000, after: 42000 }
  → [圧縮後に実行] → コスト62%削減
```

---

## 7. MCPテンプレートプロンプト（v2.0新規）

NeuraMeter MCPサーバーに接続したエージェントが「コスト意識を持って行動する」ためのテンプレートプロンプト。各エージェントのシステムプロンプトにコピペで追加できる。

### 7.1 汎用テンプレート（全エージェント共通）

```
## Cost Management (NeuraMeter)

You have access to NeuraMeter MCP tools for cost monitoring and optimization.
Follow these rules:

1. **Before expensive operations**: Call `neurameter_check_budget` to verify 
   budget availability. If remaining budget is low, prefer cheaper alternatives.

2. **When conversation gets long**: Call `neurameter_check_context` to check 
   context window utilization. If utilization exceeds 70%, summarize older 
   messages before making the next API call.

3. **Periodically**: Call `neurameter_get_recommendations` to check if there 
   are optimization opportunities you should act on.

4. **After optimizing**: Call `neurameter_log_optimization` to record what you 
   did, so the team can measure effectiveness.

Rules:
- Never skip cost checks for operations expected to cost more than $0.10
- If context utilization > 80%, always summarize before proceeding
- Prefer cheaper models (gpt-4o-mini, claude-haiku) for simple tasks
- Log every optimization action for transparency
```

### 7.2 OpenClaw用テンプレート

```
## Cost Management (NeuraMeter)

You are an OpenClaw agent with access to NeuraMeter cost monitoring tools.
OpenClaw frequently reads large files and accumulates conversation history,
which causes context bloat and cost spikes.

Before each task execution:
1. Call `neurameter_check_budget` — if budget < 20% remaining, switch to 
   minimum-cost mode (use gpt-4o-mini only, summarize aggressively)
2. Call `neurameter_check_context` — if utilization > 70%, summarize all 
   messages older than the last 10 turns before proceeding

During task execution:
- When reading files, extract only relevant sections instead of reading entire files
- After receiving tool results, summarize them immediately if > 2000 tokens
- Prefer gpt-4o-mini for classification, extraction, and simple generation tasks

After task completion:
- If you performed any optimization (summarized history, switched models, 
  compressed tool results), call `neurameter_log_optimization` with details

Cost awareness priorities:
1. Never exceed the hourly cost limit
2. Keep context utilization below 80% at all times
3. Minimize redundant API calls (cache results when possible)
```

### 7.3 LangChain/CrewAI用テンプレート

```
## Cost Management (NeuraMeter)

You are part of a multi-agent system monitored by NeuraMeter.
Each agent's cost is tracked individually and attributed to the parent trace.

Guidelines:
1. At the start of each workflow, the orchestrator should call 
   `neurameter_check_budget` to verify the entire workflow is within budget.
   
2. Before spawning sub-agents for research-heavy tasks, check 
   `neurameter_check_context` to ensure context isn't already bloated.

3. When passing context between agents:
   - Pass summaries, not full conversation history
   - Include only relevant tool results, not all of them
   - Each agent should start with minimal context and request more if needed

4. After workflow completion, call `neurameter_get_recommendations` to 
   identify optimization opportunities for the next run.

Model selection guidelines:
- Orchestration/routing: gpt-4o-mini or claude-haiku (cheapest)
- Analysis/research: gpt-4o or claude-sonnet (balanced)
- Creative/complex reasoning: gpt-4o or claude-opus (only when needed)
```

### 7.4 Claude Desktop / Cursor用テンプレート

```
## Cost Management (NeuraMeter)

You have access to NeuraMeter tools to monitor your own cost and context usage.

Habits to follow:
- When a conversation exceeds 30 messages, check your context utilization 
  with `neurameter_check_context` and summarize if needed
- When asked to perform a complex multi-step task, check budget first 
  with `neurameter_check_budget`
- At the end of long sessions, call `neurameter_get_cost_summary` to 
  report session costs to the user

Transparency:
- When you optimize (summarize context, switch to a cheaper approach), 
  briefly inform the user what you did and why
- If budget is running low, proactively suggest cheaper alternatives
```

### 7.5 テンプレートの使い方

**Claude Desktop:**
`claude_desktop_config.json` の MCP設定に `neurameter` を追加し、
システムプロンプトに上記テンプレートを追加。

**OpenClaw:**
各タスクファイルのエージェント初期化時にシステムプロンプトに追加。

**LangChain:**
```python
from langchain.agents import AgentExecutor
agent = AgentExecutor(
    agent=my_agent,
    tools=[...neurameter_mcp_tools],
    system_message="..." + NEURAMETER_TEMPLATE,  # テンプレートを追加
)
```

**CrewAI:**
```python
from crewai import Agent
agent = Agent(
    role="Researcher",
    backstory="..." + NEURAMETER_TEMPLATE,  # テンプレートを追加
    tools=[...neurameter_mcp_tools],
)
```

---

## 8. 価格設定

| プラン | 月額 | コール | 保持 | 席 | 機能 |
|---|---|---|---|---|---|
| Free | $0 | 10K | 7日 | 1 | Layer 1 + 通知モード |
| Pro | $29 | 100K | 30日 | 5 | 3モード全て + レコメンデーション |
| Team | $79 | 1M | 90日 | ∞ | MCPサーバー + 異常検知 + RBAC |
| Enterprise | カスタム | ∞ | 1年 | ∞ | SSO + セルフホスト + カスタムMCP |

---

## 9. 開発ロードマップ

### Phase 1：MVP（1週間）
Layer 1 + Layer 2（notifyモードのみ）
- [ ] `@neurameter/core` — コスト計算、バッチ送信、コンテキスト分析、notifyガードレール
- [ ] `@neurameter/openai` — ラッパー
- [ ] `@neurameter/anthropic` — ラッパー
- [ ] CF Worker — `/v1/events` + `/v1/guard-events`
- [ ] Supabase — v2.0スキーマ
- [ ] Dashboard:
  - メイン画面（コスト + コンテキスト効率スコア）
  - エージェント別（コンテキスト使用率列）
  - トレース詳細（コンテキスト内訳）
  - ガード判定履歴
- [ ] npm + GitHub公開

### Phase 2：完全ガードレール（月2-3）
Layer 2 全3モード
- [ ] blockモード + auto-optimizeモード実装
- [ ] `@neurameter/langchain`, `@neurameter/crewai`
- [ ] ダッシュボード:
  - ガードレール設定UI（3モード切替）
  - コンテキスト効率分析画面
  - 最適化レコメンデーション画面
- [ ] 予算管理 + Slackアラート
- [ ] 顧客別コスト

### Phase 3：MCPサーバー + テンプレート（月4-6）
Layer 3
- [ ] `@neurameter/mcp-server`（5ツール）
- [ ] テンプレートプロンプト（汎用、OpenClaw、LangChain/CrewAI、Claude Desktop）
- [ ] `@neurameter/vercel-ai`
- [ ] 異常検知、ベンチマーキング基盤
- [ ] OpenClaw統合テスト
- [ ] RBAC、Stripe課金

### Phase 4：Platform（月7-12）
- [ ] ClickHouse、最適化効果測定、効率スコアリング、API公開

---

## 10. 非機能要件

- SDK追加レイテンシ: < 5ms（ガードレール含む）
- ガードレール判定: < 2ms（ローカル）
- ダッシュボード初回ロード: < 2秒
- MCP応答: < 500ms
- APIキー: SHA-256ハッシュのみ、プレフィックス `nm_`
- プロンプト/レスポンスの中身は送信しない（メタデータのみ）
- **ガードレールのデフォルトは「通知のみ」（勝手に止めない）**
- ガードレールはオフラインでも動作（判定はローカル）
- MCPダウン時もエージェントは通常動作継続

---

## 11. 競合差別化

### NeuraMeterだけが持つもの
1. エージェント単位のコスト自動帰属
2. マルチエージェントのトレースツリーとコスト伝播
3. 顧客単位のAIコスト原価
4. **コンテキストウィンドウ効率分析**（競合ゼロ）
5. **3モード選択ガードレール**（通知/停止/自動改善）
6. **MCPサーバー + テンプレートプロンプト**（競合ゼロ）
7. **検知→ユーザー選択で対処→自律最適化の3層**

### BurnRate（最も近い競合）比較
| 機能 | NeuraMeter | BurnRate |
|---|---|---|
| コスト追跡 | ✅ | ✅ |
| エージェント帰属 | ✅ | ✅ |
| コンテキスト分析 | ✅ | ❌ |
| ガードレール（3モード） | ✅ | ❌ |
| MCPサーバー | ✅ | ❌ |
| テンプレートプロンプト | ✅ | ❌ |
| 自律最適化 | ✅ | ❌ |
| ローカル実行 | ❌ | ✅ |

### NeuraMeterが持たないもの
- プロンプト管理（→ Langfuse）
- モデルルーティング（→ Portkey）
- 評価/テスト（→ Braintrust）
- 課金インフラ（→ Paid）
