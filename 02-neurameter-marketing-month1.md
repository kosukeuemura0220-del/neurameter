# NeuraMeter マーケティング戦略 v2.0（競合分析反映・全面書き直し）
## 「コスト監視ツール」ではなく「コンテキストエンジニアリング・プラットフォーム」として勝つ

---

## 根本的な方針転換

### v1.0（旧）の問題点
```
旧ポジション：「AIエージェントのコスト追跡ツール」
→ Helicone、Portkey、Langfuse、BurnRate、Metrxと同じ土俵
→ HNで「Langfuseと何が違う？」と即座に突っ込まれる
→ 2026年3月、HNでは「AIツール疲れ」が深刻（367ポイントの議論）
```

### v2.0（新）のポジション
```
新ポジション：「コンテキストエンジニアリング・プラットフォーム」
→ コンテキストの効率を分析し、無駄を検知し、自動的に最適化する
→ 既存ツール＝「何が起きたか」を見せる
→ NeuraMeter＝「なぜ無駄で、どう直すか」まで行く
→ MCP自体が引き起こすコンテキスト肥大化を、MCP経由で解決するアイロニー
```

### なぜこのポジションか
1. 「コンテキストエンジニアリング」は2026年の認知済みキーワード（Shopify CEO、Anthropic、Google、Thoughtworksが採用）
2. コンテキスト効率分析の本番ツールは競合ゼロ（調査済み）
3. MCPサーバーのトークン膨張問題は実データで証明済み（236倍の膨張事例）
4. 技術的な深さ＋自分の問題解決ストーリーが「AIツール疲れ」のHNで差別化になる

---

## HNタイトル候補（優先順）

```
1位（推奨）:
Show HN: NeuraMeter – Open-source context engineering that tells agents when they're wasting tokens

2位:
Show HN: NeuraMeter – 3-mode guardrails for LLM context bloat (notify/block/auto-optimize)

3位（ストーリー型）:
Show HN: NeuraMeter – Our AI agent was burning $47/day on wasted context, so we built this

4位（挑発型、リスクあり）:
Show HN: Your MCP server is burning tokens before it does anything useful
```

旧タイトル（使わない）：
~~Show HN: NeuraMeter – Open-source cost attribution for AI agent systems~~

---

## HN Maker Comment テンプレート（250-350語）

```
Hey HN! I'm Ren from NEURIA in Osaka.

We were building an AI agent system (OpenClaw) and noticed it was 
consuming $47/day in wasted context tokens. The worst part: 82% of 
our context window was filled with conversation history that could 
have been summarized to 20% of its size.

We tried Langfuse for tracing and Helicone for monitoring — they're 
great at showing what happened. But nothing told us *why* our context 
was bloated or automatically fixed it.

So we built NeuraMeter. It does three things:

1. Context window efficiency analysis — shows what percentage of your 
   context is system prompts vs conversation history vs tool results,
   and identifies waste. No other production tool does this.

2. 3-mode guardrails (you choose):
   - Notify: alert without stopping anything (default)
   - Block: hard-stop when thresholds are exceeded
   - Auto-optimize: automatically compress context and retry

3. MCP server so agents can check their own cost/context status and 
   self-optimize. The irony: MCP servers themselves cause massive 
   token bloat (one study found 236x inflation), so we're using MCP 
   to solve the problem MCP creates.

MIT-licensed, TypeScript, npm packages. SDK adds <5ms latency. 
Works with OpenAI, Anthropic, LangChain, CrewAI.

We're dogfooding it on our own agent system — the dashboard screenshot 
in the README is real data from our production setup.

What's the biggest context cost surprise you've hit?

GitHub: [URL]
```

### 競合への事前回答（4社分）

**「Langfuseと何が違う？」**
```
Langfuse (and Helicone, LangSmith, etc.) are excellent at tracing 
and logging — they show what happened.

NeuraMeter focuses on a different layer:
1. Context *diagnosis* — not just "95K tokens" but "82% is old history"
2. Real-time intervention — guardrails act before tokens are spent
3. Agent self-awareness via MCP — agents self-optimize

Langfuse is the dashcam (records). NeuraMeter is the collision 
avoidance system (prevents). They're complementary.
```

**「Metrxと何が違う？」**
```
Metrx has a nice MCP server for cost data — respect what they're doing.

Difference: Metrx provides cost *information*. NeuraMeter closes the 
loop: detect → diagnose → fix.
- Context efficiency analysis (Metrx doesn't have)
- 3-mode guardrails acting in real-time (Metrx doesn't intervene)
- Auto-optimize compresses context and retries (Metrx recommends only)
```

**「LiteLLMの予算制限と何が違う？」**
```
LiteLLM's budget enforcement is great for cumulative spend limits.
NeuraMeter is different:
- Per-call context analysis (not just cumulative budget)
- Context utilization % as a guardrail trigger (LiteLLM doesn't track)
- Auto-optimize mode (LiteLLM blocks or allows, no middle ground)
```

**「Cordumと何が違う？」**
```
Cordum does agent FinOps governance with YAML policies — solid approach.
NeuraMeter is developer-facing SDK, not governance layer.
- Context diagnosis (Cordum doesn't analyze why costs are high)
- MCP server for agent self-awareness (Cordum is policy enforcement)
- Works as npm packages, not YAML configs
```

---

## 全体タイムライン（v2.0）

```
Week 0（1日）      種まき最低限。LP、GitHub、X初投稿
Week 1（7日）      NeuraMeter本体開発 + 毎日Build in Public（データストーリー）
Week 1.5（2-3日）  OpenClawにNeuraMeter組み込み + マーケ自動化タスク追加
Week 2（3日）      Product Hunt ローンチ（先にこちら）
Week 2.5（3日）    技術ブログ記事公開（dev.to + Hashnode + Zenn）
Week 3（1日）      ★ HN ローンチ（最後に温存）
Week 3-4（7日）    初期獲得（Reddit、Discord、DM）
```

**最大の変更：HNは最後。PHが先。**
理由：PHでメッセージングを磨く→PHバッジでソーシャルプルーフ→HNに最高の状態で臨む

---

## Week 0：種まき（1日）

### Xの初投稿（変更）

```
My AI agent was consuming 95% of its context window.

82% was conversation history from 3 hours ago.
The agent was paying to re-read things it already knew.

$47/day in wasted tokens. Not because the model was expensive —
because we were feeding it garbage context.

Existing tools told me "you spent $X." None told me *why* or fixed it.

Building NeuraMeter — open-source context engineering for AI agents.

Who else is fighting context bloat? 👇
```

### GitHubのREADMEヘッドライン（変更）

旧：~~Know exactly what your AI agents cost.~~
新：**Stop wasting tokens on context your agents don't need.**

サブヘッド：**Analyze context efficiency. Set guardrails. Let agents self-optimize.**

### コミュニティ自己紹介（変更）
```
Hi! I'm Ren from NEURIA (Osaka, Japan). Working on context 
engineering for AI agents — specifically analyzing why agents 
waste context tokens and how to fix it automatically. 
Building NeuraMeter (OSS). Happy to chat about context costs!
```

---

## Week 1：開発＆Build in Public

### 発信軸の変更

v1.0：機能報告（「SDKできた」「ダッシュボード動いた」）
v2.0：**OpenClawの実問題＋データストーリー**

```
Day 1:
Built NeuraMeter's context analyzer today.

Fed it our OpenClaw agent's actual conversation history.

Result: 82% of the context window was conversation from hours ago.
The agent was re-reading everything every single API call.

[スクリーンショット: コンテキスト使用率の円グラフ]
```

```
Day 3:
NeuraMeter's 3-mode guardrails working.
Set OpenClaw to "notify" mode (don't stop, just alert).

1 hour result:
- 14 warnings for context > 80%
- 3 warnings for cost > $0.50/call
- 0 blocks (notify mode doesn't stop anything)

Now I can SEE the waste.

[スクリーンショット: ガードレール判定ログ]
```

```
Day 5:
auto-optimize mode just saved 62% on a single API call.

NeuraMeter detected context at 88%.
Triggered callback → compressed conversation history.
Retried with 34% context utilization.

Same output quality. 62% cheaper.

[スクリーンショット: before/after比較]
```

---

## Week 2：Product Hunt（HNより先）

### タグライン
```
NeuraMeter — Stop paying for context your AI agents don't need
```

### PHの目的
- メッセージングのテスト（どの訴求が刺さるか確認）
- バッジ取得（HNの投稿時にGitHub READMEに貼れる）
- 初期フィードバック（PHユーザーはHNより優しい）

---

## Week 2.5：技術ブログ記事

### 公開順序

1. **Hashnode**（SEO本拠地、カスタムドメイン）
2. **dev.to**（canonical URLをHashnodeに向ける。開発者リーチ最大）
3. **Zenn**（日本語版）

### 記事A（HN投稿の2日前に公開）
```
「82% of our AI agent's context was wasted — here's the data」
→ HNのmaker commentからリンク
→ OpenClawの実データ。before/after。数字が全て。
```

### 記事B（ローンチ後1週間）
```
「MCP servers are silently burning your token budget — here's how much」
→ MCPトークン膨張問題の実データ分析
→ Reddit/HNで議論を呼ぶコンテンツ
```

---

## Week 3：★ Hacker News ローンチ（最終兵器）

### 投稿タイミング
火曜 or 水曜 **22:00 JST**（= 米国東部 9:00 AM）

### 投稿前日チェックリスト
- [ ] README完璧（スクリーンショット、コード例、アーキテクチャ図）
- [ ] OpenClawの実データがダッシュボードに表示されている
- [ ] Maker Comment完成版を手元に用意
- [ ] 競合4社への回答を用意（Langfuse、Metrx、LiteLLM、Cordum）
- [ ] PHバッジがREADMEに入っている
- [ ] 技術ブログ記事が公開済み
- [ ] 投稿後6時間は全コメントに30分以内で返信できる体制

### 投稿後の対応ルール
- **全コメントに30分以内で返信**
- 批判には「good point」で始めて正直に答える
- 競合は**絶対に悪く言わない**（「使った。良いツール。ただ○○が足りなかった」）
- 「自分も使っている」の具体データを見せる

---

## Week 3-4：初期獲得

### Reddit（HN翌日以降）

**r/LangChain：**
```
Title: I analyzed my LangChain agent's context window — 
82% was wasted conversation history
[データ記事として。最後に「Built NeuraMeter to fix this」]
```

**r/LocalLLaMA（658K+ members）：**
```
Title: Context window efficiency matters more than model size — 
here's what I learned from 1000 API calls
```

### 追加キーワード監視（OpenClawの自動化タスクに追加）
```
context bloat, context window cost, MCP token, token waste, 
context engineering, context utilization
```

---

## OpenClawで自動化（v1.0と同じ + 追加1つ）

```
[既存] stars-monitor, community-monitor, release-announce, 
       welcome-trigger, weekly-report

[追加] marketing_context_keyword_monitor
  → 「context bloat」「MCP token」「context window cost」で
    Reddit/HN/Xを検索
  → 関連投稿をSlack通知（手動で返信する候補）
```

---

## 費用まとめ（変更なし：約¥11,800/月）

---

## KPI

### v1.0から維持
| 指標 | 最低ライン | 好調ライン |
|---|---|---|
| GitHub Stars | 100 | 500+ |
| サインアップ | 50 | 200+ |
| npm DL/月 | 500 | 2,000+ |
| 有料顧客 | 3 | 10+ |

### v2.0で追加
| 指標 | 最低ライン | 好調ライン |
|---|---|---|
| 「context engineering」記事の検索流入 | 100/月 | 500+/月 |
| HN maker commentへの返信数 | 10 | 30+ |
| MCPサーバー接続ユーザー数 | 5 | 20+ |

---

## v1.0→v2.0 変更一覧

| 項目 | v1.0 | v2.0 |
|---|---|---|
| ポジション | コスト追跡ツール | コンテキストエンジニアリング・プラットフォーム |
| HNタイトル | cost attribution | context engineering + agents wasting tokens |
| X初投稿 | 「$4,800の請求」 | 「コンテキストの82%が無駄だった」 |
| ローンチ順序 | HN→PH→Reddit | **PH→ブログ→HN（最後）→Reddit** |
| 差別化の訴求 | 「誰もやっていない」 | 「3機能の連動プラットフォームは存在しない」 |
| 競合対応 | 言及しない | **4社分の事前回答を準備、正直に認める** |
| Build in Public | 機能報告 | OpenClawの実問題＋データストーリー |
| ブログテーマ | コスト比較 | コンテキスト効率データ + MCP肥大化問題 |
