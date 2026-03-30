# NeuraMeter 仕様書 v1.0
## AIエージェントコスト帰属・予算ガバナンスプラットフォーム
## by NEURIA

---

## 1. プロダクト概要

### 1.1 一言定義
AIエージェントの利用コストを「エージェント単位」「タスク単位」「顧客単位」でリアルタイム追跡し、予算管理・最適化提案を行うプラットフォーム。

### 1.2 ブランド情報
- **プロダクト名：** NeuraMeter
- **読み：** ニューラメーター
- **URL：** https://meter.neuria.tech
- **npmスコープ：** @neurameter
- **GitHub：** github.com/neuria-dev/neurameter（またはgithub.com/neurameter）
- **ライセンス：** MIT
- **親ブランド：** NEURIA（ニューリア）

### 1.3 コンポーネント構成
```
NeuraMeter
├── SDK（npmパッケージ群）    — 開発者のアプリに組み込む計測ツール
├── Ingestion API              — イベント受信サーバー
├── Dashboard（Next.js）       — コスト可視化・管理画面（meter.neuria.tech）
└── Model Pricing DB           — LLMモデルの価格データベース
```

### 1.4 ターゲットユーザー
- LangChain / CrewAI / OpenAI Agents SDK / Vercel AI SDKでエージェントを構築している開発者
- AIエージェントを本番運用しているスタートアップ・中規模企業のエンジニアリングチーム
- SaaS企業で顧客ごとのAIコスト原価を把握したいプロダクトマネージャー

---

## 2. SDKパッケージ仕様

### 2.1 パッケージ構成
```
@neurameter/core         — 共通インターフェース、コスト計算エンジン、イベント型定義
@neurameter/openai       — OpenAIプロバイダーラッパー
@neurameter/anthropic    — Anthropicプロバイダーラッパー
@neurameter/vercel-ai    — Vercel AI SDK統合
@neurameter/langchain    — LangChain/LangGraph統合（Phase 2）
@neurameter/crewai       — CrewAI統合（Phase 2）
@neurameter/transport    — 非同期イベントバッチング＆送信
```

### 2.2 SDK設計原則
- **ラッパー関数パターン**（モンキーパッチではない）
- **5KB gzip以下**、依存関係ゼロ
- ネイティブ `fetch()` + `crypto.randomUUID()` 使用
- **tsup** でESM/CJSデュアル出力
- 非同期バッチ送信（50〜100イベントを1リクエストに集約）
- OpenTelemetry セマンティック規約に準拠

### 2.3 SDK使用例（開発者体験）

#### インストール
```bash
npm install @neurameter/core @neurameter/openai
```

#### 基本使用
```typescript
import { NeuraMeter } from '@neurameter/core';
import { withMeter } from '@neurameter/openai';
import OpenAI from 'openai';

// 1. NeuraMeter初期化
const meter = new NeuraMeter({
  apiKey: 'nm_xxxxxxxxxxxx',
  projectId: 'proj_xxxx',
});

// 2. OpenAIクライアントをラップ
const openai = withMeter(new OpenAI(), meter);

// 3. 通常通りAPI呼び出し（自動でコスト記録）
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
}, {
  // NeuraMeter固有のメタデータ
  agentName: 'SupportAgent',
  taskName: 'classify-ticket',
  customerId: 'cust_123',
  tags: { team: 'support', priority: 'high' },
});
```

#### マルチエージェント対応（親子関係の自動追跡）
```typescript
// 親エージェント
const parentTrace = meter.startTrace({
  agentName: 'OrchestratorAgent',
  customerId: 'cust_123',
});

// 子エージェント（parentTraceを引き継ぐ）
const childResponse = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [...],
}, {
  agentName: 'ClassifierAgent',
  traceId: parentTrace.traceId,
});

// 別の子エージェント（Anthropic）
import { withMeter as withMeterAnthropic } from '@neurameter/anthropic';
import Anthropic from '@anthropic-ai/sdk';
const anthropic = withMeterAnthropic(new Anthropic(), meter);

const draftResponse = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [...],
}, {
  agentName: 'DraftAgent',
  traceId: parentTrace.traceId,
});

parentTrace.end(); // トレース完了 → 合計コスト算出
```

### 2.4 コスト計算ロジック

```typescript
interface CostEvent {
  eventId: string;          // UUID v4
  timestamp: string;        // ISO 8601
  traceId: string;          // 親トレースID
  spanId: string;           // 自身のスパンID
  parentSpanId?: string;    // 親スパンID

  // エージェント情報
  agentName: string;
  taskName?: string;
  customerId?: string;

  // LLM情報
  provider: 'openai' | 'anthropic' | 'google' | 'other';
  model: string;
  
  // トークン情報
  inputTokens: number;
  outputTokens: number;
  reasoningTokens?: number;  // o1等の推論トークン
  cachedTokens?: number;     // キャッシュヒットトークン

  // コスト（マイクロドル = $1 = 1,000,000）
  costMicrodollars: number;

  // レイテンシ
  latencyMs: number;
  
  // カスタムメタデータ
  tags?: Record<string, string>;

  // 組織情報（SDK初期化時に設定）
  orgId: string;
  projectId: string;
}
```

**コスト計算式：**
```
cost = (inputTokens × inputPricePerToken)
     + (outputTokens × outputPricePerToken)
     + (reasoningTokens × reasoningPricePerToken)
     - (cachedTokens × cachedDiscountPerToken)
```

マイクロドル（UInt64）で保存 → 浮動小数点の精度問題を回避。

### 2.5 モデル価格データベース

```typescript
interface ModelPricing {
  provider: string;
  model: string;
  inputPricePerMToken: number;   // $ per 1M tokens
  outputPricePerMToken: number;
  reasoningPricePerMToken?: number;
  cachedInputDiscount?: number;  // 割引率（0.0 - 1.0）
  effectiveDate: string;
  source: string;                // 'official' | 'community'
}
```

**初期対応モデル（MVP）：**
- OpenAI: gpt-4o, gpt-4o-mini, gpt-4.1, gpt-4.1-mini, o1, o1-mini, o3-mini
- Anthropic: claude-sonnet-4, claude-haiku-4, claude-opus-4

**価格更新方法：**
- GitHub上のJSONファイルとして管理
- コミュニティからのPRで更新（OSSの強み）
- SDKが起動時に最新価格を取得するオプション

---

## 3. イベント取込API仕様

### 3.1 エンドポイント
```
POST https://ingest.meter.neuria.tech/v1/events
```

### 3.2 リクエスト形式
```json
{
  "batch": [
    {
      "eventId": "uuid-v4",
      "timestamp": "2026-04-01T09:00:00.000Z",
      "agentName": "SupportAgent",
      "provider": "openai",
      "model": "gpt-4o",
      "inputTokens": 1500,
      "outputTokens": 800,
      "costMicrodollars": 25000,
      "latencyMs": 1200,
      "traceId": "trace-uuid",
      "spanId": "span-uuid",
      "customerId": "cust_123",
      "tags": { "team": "support" }
    }
  ]
}
```

### 3.3 認証
```
Authorization: Bearer nm_xxxxxxxxxxxx
```
APIキーはダッシュボードで生成。プロジェクト単位で発行。プレフィックスは `nm_`。

### 3.4 レスポンス
```json
{
  "accepted": 50,
  "rejected": 0,
  "errors": []
}
```

### 3.5 インフラ構成

```
SDK → HTTPS POST（バッチ50-100件）
  ↓
Cloudflare Workers（$5/月 for 10Mリクエスト）
  ├── APIキー検証
  ├── スキーマバリデーション
  ├── コスト計算（価格DBから取得）
  └── バッチINSERT
  ↓
Supabase PostgreSQL
  ├── cost_events テーブル（生イベント）
  ├── cost_summaries_hourly（時間別集約 — トリガーで自動更新）
  └── Realtime → ダッシュボードにプッシュ
```

**DNS設定：**
```
meter.neuria.tech       → Vercel（ダッシュボード）
ingest.meter.neuria.tech → Cloudflare Workers（イベント取込API）
```

**スケーリングパス：**
- Phase 1（〜10万イベント/日）: Supabase Pro のみ
- Phase 2（〜1,000万/日）: ClickHouse Cloud追加（OLAP分析用）

---

## 4. データベース設計

### 4.1 Supabase PostgreSQL スキーマ

```sql
-- ========================================
-- 組織・認証
-- ========================================

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',  -- free, pro, team, enterprise
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',  -- owner, admin, member, viewer
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, user_id)
);

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL,          -- SHA-256ハッシュ（平文は保存しない）
  key_prefix TEXT NOT NULL,        -- 表示用プレフィックス（nm_xxxx...）
  name TEXT NOT NULL,
  scopes TEXT[] DEFAULT '{"write"}',
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- コストイベント
-- ========================================

CREATE TABLE cost_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  project_id UUID NOT NULL,
  
  -- トレース情報
  trace_id TEXT NOT NULL,
  span_id TEXT NOT NULL,
  parent_span_id TEXT,
  
  -- エージェント情報
  agent_name TEXT NOT NULL,
  task_name TEXT,
  customer_id TEXT,
  
  -- LLM情報
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  
  -- トークン
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  reasoning_tokens INTEGER DEFAULT 0,
  cached_tokens INTEGER DEFAULT 0,
  
  -- コスト（マイクロドル）
  cost_microdollars BIGINT NOT NULL DEFAULT 0,
  
  -- パフォーマンス
  latency_ms INTEGER,
  
  -- メタデータ
  tags JSONB DEFAULT '{}',
  
  -- タイムスタンプ
  event_timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- インデックス
CREATE INDEX idx_cost_events_org_time ON cost_events(org_id, event_timestamp DESC);
CREATE INDEX idx_cost_events_agent ON cost_events(org_id, agent_name, event_timestamp DESC);
CREATE INDEX idx_cost_events_customer ON cost_events(org_id, customer_id, event_timestamp DESC);
CREATE INDEX idx_cost_events_trace ON cost_events(trace_id);
CREATE INDEX idx_cost_events_model ON cost_events(org_id, model, event_timestamp DESC);

-- ========================================
-- 集約テーブル（時間別サマリー）
-- ========================================

CREATE TABLE cost_summaries_hourly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  project_id UUID NOT NULL,
  hour TIMESTAMPTZ NOT NULL,
  
  agent_name TEXT NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  customer_id TEXT,
  
  -- 集約値
  total_input_tokens BIGINT DEFAULT 0,
  total_output_tokens BIGINT DEFAULT 0,
  total_cost_microdollars BIGINT DEFAULT 0,
  call_count INTEGER DEFAULT 0,
  avg_latency_ms INTEGER DEFAULT 0,
  
  UNIQUE(org_id, project_id, hour, agent_name, model, provider, customer_id)
);

-- 時間別サマリーを自動更新するトリガー
CREATE OR REPLACE FUNCTION update_hourly_summary()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO cost_summaries_hourly (
    org_id, project_id, hour, agent_name, model, provider, customer_id,
    total_input_tokens, total_output_tokens, total_cost_microdollars,
    call_count, avg_latency_ms
  ) VALUES (
    NEW.org_id, NEW.project_id, date_trunc('hour', NEW.event_timestamp),
    NEW.agent_name, NEW.model, NEW.provider, NEW.customer_id,
    NEW.input_tokens, NEW.output_tokens, NEW.cost_microdollars,
    1, NEW.latency_ms
  )
  ON CONFLICT (org_id, project_id, hour, agent_name, model, provider, customer_id)
  DO UPDATE SET
    total_input_tokens = cost_summaries_hourly.total_input_tokens + EXCLUDED.total_input_tokens,
    total_output_tokens = cost_summaries_hourly.total_output_tokens + EXCLUDED.total_output_tokens,
    total_cost_microdollars = cost_summaries_hourly.total_cost_microdollars + EXCLUDED.total_cost_microdollars,
    call_count = cost_summaries_hourly.call_count + 1,
    avg_latency_ms = (cost_summaries_hourly.avg_latency_ms * cost_summaries_hourly.call_count + EXCLUDED.avg_latency_ms) 
                     / (cost_summaries_hourly.call_count + 1);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_hourly_summary
AFTER INSERT ON cost_events
FOR EACH ROW EXECUTE FUNCTION update_hourly_summary();

-- ========================================
-- 予算管理
-- ========================================

CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  scope_type TEXT NOT NULL,          -- 'org' | 'project' | 'agent' | 'customer'
  scope_id TEXT NOT NULL,
  
  amount_microdollars BIGINT NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly',
  alert_threshold NUMERIC DEFAULT 0.8,
  
  notify_email BOOLEAN DEFAULT true,
  notify_slack_webhook TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- RLS（Row Level Security）
-- ========================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_summaries_hourly ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_member_access" ON cost_events
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM org_members 
      WHERE user_id = auth.uid()
    )
  );

-- 同様のポリシーを他テーブルにも適用
```

### 4.2 モデル価格テーブル

```sql
CREATE TABLE model_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_price_per_m_tokens NUMERIC NOT NULL,
  output_price_per_m_tokens NUMERIC NOT NULL,
  reasoning_price_per_m_tokens NUMERIC,
  cached_input_discount NUMERIC DEFAULT 0,
  effective_date DATE NOT NULL,
  source TEXT DEFAULT 'official',
  UNIQUE(provider, model, effective_date)
);

-- 初期データ（2026年3月時点）
INSERT INTO model_pricing (provider, model, input_price_per_m_tokens, output_price_per_m_tokens, effective_date) VALUES
('openai', 'gpt-4o', 2.50, 10.00, '2026-03-01'),
('openai', 'gpt-4o-mini', 0.15, 0.60, '2026-03-01'),
('openai', 'gpt-4.1', 2.00, 8.00, '2026-03-01'),
('openai', 'gpt-4.1-mini', 0.40, 1.60, '2026-03-01'),
('openai', 'o1', 15.00, 60.00, '2026-03-01'),
('openai', 'o3-mini', 1.10, 4.40, '2026-03-01'),
('anthropic', 'claude-sonnet-4-20250514', 3.00, 15.00, '2026-03-01'),
('anthropic', 'claude-haiku-4-5-20251001', 0.80, 4.00, '2026-03-01'),
('anthropic', 'claude-opus-4-20250514', 15.00, 75.00, '2026-03-01');
```

---

## 5. ダッシュボード仕様（Next.js）

### 5.1 技術スタック
```
Next.js 15 (App Router)
├── Supabase Auth（認証）
├── Supabase Realtime（リアルタイム更新）
├── shadcn/ui（UIコンポーネント）
├── Recharts（グラフ）
├── Tailwind CSS v4
└── Vercelにデプロイ → meter.neuria.tech
```

### 5.2 画面構成（MVP）

```
/                          → リダイレクト（/dashboard or /login）
/login                     → サインイン/サインアップ
/dashboard                 → メインダッシュボード（コスト概要）
/dashboard/agents          → エージェント別コスト一覧
/dashboard/agents/[name]   → エージェント詳細（時系列、モデル内訳）
/dashboard/models          → モデル別コスト比較
/dashboard/customers       → 顧客別コスト一覧（SaaS向け）
/dashboard/traces          → トレース一覧（個別ワークフロー詳細）
/dashboard/traces/[id]     → トレース詳細（スパンツリー表示）
/dashboard/budgets         → 予算設定・アラート管理
/dashboard/alerts          → アラート履歴
/settings                  → 組織設定
/settings/api-keys         → APIキー管理
/settings/team             → チームメンバー管理
/settings/billing          → 課金管理（Stripe）
```

### 5.3 メインダッシュボード（/dashboard）

**表示要素：**
- 今月の合計コスト（大きな数字）
- 前月比（増減%）
- 今日のコスト
- 直近7日間のコスト推移（折れ線グラフ）
- エージェント別コスト内訳（円グラフ + テーブル）
- モデル別コスト内訳（横棒グラフ）
- 予算消化率（プログレスバー）
- 最近のアラート（リスト）

**フィルター：**
- 期間：今日 / 7日 / 30日 / カスタム
- プロジェクト
- エージェント名
- 顧客ID

### 5.4 トレース詳細（/dashboard/traces/[id]）

**スパンツリー表示：**
```
[OrchestratorAgent] ─── $0.082 ─── 3,200ms
  ├── [ClassifierAgent] ─── $0.003 ─── 450ms
  │     └── gpt-4o-mini (450 tokens)
  ├── [ResearchAgent] ─── $0.031 ─── 1,800ms
  │     ├── claude-sonnet (2,100 tokens)
  │     └── web_search tool ($0.01)
  └── [DraftAgent] ─── $0.048 ─── 950ms
        └── gpt-4o (3,200 tokens)
```

---

## 6. 価格設定

| プラン | 月額 | 追跡コール | 保持期間 | 席数 | 主要機能 |
|---|---|---|---|---|---|
| **Free** | $0 | 10K/月 | 7日 | 1 | 基本ダッシュボード |
| **Pro** | $29 + 超過$0.50/10K | 100K/月 | 30日 | 5 | アラート、全フィルター |
| **Team** | $79 + 超過$0.30/10K | 1M/月 | 90日 | 無制限 | 異常検知、予算管理、RBAC |
| **Enterprise** | カスタム | 無制限 | 1年 | 無制限 | SSO、HIPAA、セルフホスト |

---

## 7. 開発ロードマップ

### Phase 1：MVP（1週間）
- [ ] `@neurameter/core` — イベント型、コスト計算、バッチ送信
- [ ] `@neurameter/openai` — OpenAIラッパー
- [ ] `@neurameter/anthropic` — Anthropicラッパー
- [ ] Cloudflare Worker — イベント取込API（ingest.meter.neuria.tech）
- [ ] Supabase — スキーマ構築、RLS設定
- [ ] Next.js — ダッシュボード（meter.neuria.tech）
- [ ] npm公開（@neurameter/core, @neurameter/openai, @neurameter/anthropic）
- [ ] GitHub公開（MIT License）

### Phase 2：V2（月2-3）
- [ ] `@neurameter/langchain` — LangChain/LangGraph統合
- [ ] `@neurameter/crewai` — CrewAI統合
- [ ] 予算管理機能
- [ ] Slackアラート連携
- [ ] 顧客別コスト画面
- [ ] 最適化レコメンデーション（基本）

### Phase 3：V3（月4-6）
- [ ] `@neurameter/vercel-ai` — Vercel AI SDK統合
- [ ] コスト異常検知（統計的逸脱）
- [ ] 匿名ベンチマーキング（基盤）
- [ ] チーム/RBAC機能
- [ ] Stripe課金統合

### Phase 4：Platform（月7-12）
- [ ] ClickHouse導入（分析クエリの高速化）
- [ ] エージェント効率スコアリング
- [ ] ROI測定（外部メトリクス接続）
- [ ] API公開（サードパーティ統合）
- [ ] NeuraMeter MCPサーバー

---

## 8. 非機能要件

### パフォーマンス
- SDK追加によるレイテンシ増加: < 5ms
- ダッシュボードの初回ロード: < 2秒
- リアルタイム更新の遅延: < 3秒
- イベント取込APIのレスポンス: < 200ms

### セキュリティ
- APIキーはSHA-256ハッシュのみ保存（平文は保存しない）
- APIキープレフィックス: `nm_`
- Supabase RLSで組織レベルのデータ分離
- HTTPS必須（Cloudflare / Vercel）
- SDKの送信データにプロンプト/レスポンスの中身は含まない（メタデータのみ）

### 可用性
- MVP: Supabase Pro（99.9% SLA）+ Cloudflare Workers（99.99%）
- 取込APIがダウンしてもSDKはエラーを吐かない（fire-and-forget）
- ローカルバッファリング（SDKがオフライン時にイベントをメモリに保持、復帰時に送信）

---

## 9. 競合との差別化（開発時の判断基準）

### NeuraMeterが持つべきもの（他にないもの）
1. **エージェント単位のコスト自動帰属**（手動タグ付け不要）
2. **マルチエージェントのトレースツリーとコスト伝播**
3. **顧客単位のAIコスト原価**（SaaS向け）
4. **予算上限と事前アラート**（エージェントが使いすぎる前に止める）
5. **匿名ベンチマーク**（「あなたのコストは業界平均の何倍か」Phase 3〜）

### NeuraMeterが持たないもの（競合に任せる）
- プロンプト管理（→ Langfuse）
- モデルルーティング/ゲートウェイ（→ Portkey）
- 評価/テスト（→ Braintrust）
- 課金インフラ（→ Paid）
