# NeuraMeter Week 0：種まき 完全実行ガイド
## 1日で完了する5タスクの詳細手順

---

## タスク1：X/Twitterアカウント整備＋最初の投稿（30分）

### 1-1. プロフィール設定（10分）

**既存の個人アカウントを使うか、新規で作るか：**
- NEURIAやRen個人のアカウントが既にある → そのまま使う（フォロワーを活かせる）
- 製品専用アカウントを別に作りたい → @neurameter で新規作成

**プロフィールの設定：**

1. X（twitter.com）→ プロフィール → 「プロフィールを編集」
2. 以下を入力：

```
名前: Ren | Building NeuraMeter

Bio:
Building the cost attribution layer for AI agents.
Know what each agent costs, per task, per customer. OSS.
🔧 by NEURIA — Shipping daily.

場所: Osaka, Japan

ウェブサイト: meter.neuria.tech
```

3. ヘッダー画像：
   - まだLP完成前なら、シンプルな黒背景 + 白テキストで
   - 「NeuraMeter — Know what your AI agents cost.」
   - Canva（canva.com）で1500×500pxで作成。3分で完了

4. プロフィール画像：
   - Ren個人の写真（開発者の顔が見えると信頼される）
   - またはNEURIAロゴ

### 1-2. 最初の投稿（10分）

**投稿①（英語 — メイン。ピン留め用）：**

以下をそのままコピペしてXに投稿：

```
My AI agent bill jumped from $1,200 to $4,800 last month.

Nobody on the team could explain why.

OpenAI dashboard shows total spend per day. That's it.
No per-agent breakdown. No per-task attribution. No per-customer costs.

I'm building an open-source tool to fix this — NeuraMeter.

It tracks costs per agent, per task, per customer in real-time.

Who else has this problem? 👇
```

→ 投稿後、右上の「…」→「プロフィールに固定する」

**投稿②（日本語 — サブ）：**

```
先月のAIエージェントの請求が$1,200→$4,800に跳ね上がった。

チームの誰も原因を説明できなかった。

OpenAIのダッシュボードは「1日の合計」しか出ない。
どのエージェントが、どのタスクで、どの顧客のためにいくら使ったか分からない。

これを解決するOSSツール「NeuraMeter」を作ります。
by NEURIA

同じ経験ある人いますか？
```

### 1-3. フォロー＆初期エンゲージメント（10分）

以下のアカウントをフォロー（競合・業界のキーパーソン）：

```
@helaborator_ai   — Helicone
@poraborator_ai   — Portkey
@langaborator_ai  — LangChain
@creaborator_ai   — CrewAI
@haaborator_ai    — Harrison Chase（LangChain創業者）

※ 上記は仮。実際にX検索で以下を検索してフォロー：
「LLM cost」「agent cost tracking」「AI agent bill」
→ 投稿している開発者を20人フォロー
```

**検索方法：**
1. X検索窓に `"agent cost" lang:en` と入力
2. 「最新」タブに切り替え
3. 上から順に投稿を見て、開発者っぽい人をフォロー
4. 特に共感できる投稿には「いいね」+「リプライ」

リプライ例：
```
This is exactly why I'm building NeuraMeter — open-source 
per-agent cost tracking. Would love to hear what metrics 
matter most to you.
```

---

## タスク2：GitHubリポ作成（30分）

### 2-1. GitHub組織の作成（まだない場合）（5分）

1. github.com にログイン
2. 右上「+」→ 「New organization」
3. 「Free」プランを選択
4. 組織名: `neuria-dev`
5. メール: 自分のメール
6. 作成完了

### 2-2. リポジトリ作成（10分）

1. github.com/neuria-dev → 「Repositories」→ 「New repository」
2. 設定：
   ```
   Repository name: neurameter
   Description: Know exactly what your AI agents cost. Per agent. Per task. Per customer.
   Public: ✅
   Add a README: ✅
   License: MIT License
   .gitignore: Node
   ```
3. 「Create repository」

### 2-3. README.md を編集（10分）

1. リポページ → README.md → ペンアイコン（Edit）
2. 以下の内容で**全置換**：

```markdown
<div align="center">

# NeuraMeter

**Know exactly what your AI agents cost.**
**Per agent. Per task. Per customer.**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/badge/npm-coming%20soon-orange.svg)]()

🚧 **Coming Soon** — Star this repo to get notified at launch.

[Website](https://meter.neuria.tech) · [Waitlist](https://meter.neuria.tech) · [Twitter](https://x.com/neurameter)

</div>

---

## The Problem

You get a **$4,800 bill** from OpenAI. No one on your team can explain why.

Existing observability tools (Helicone, Portkey, Langfuse) show total API costs per request. But they can't answer:

- **Which agent** burned the money?
- **Which task** was it running?
- **Which customer** triggered it?
- **Was it worth it?**

## The Solution

NeuraMeter is a lightweight SDK + dashboard that provides **agent-level cost attribution** for AI systems.

```typescript
import { NeuraMeter } from '@neurameter/core';
import { withMeter } from '@neurameter/openai';

const meter = new NeuraMeter({ apiKey: 'nm_xxx' });
const openai = withMeter(new OpenAI(), meter);

// That's it. Costs are now tracked per agent, per task, per customer.
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
}, {
  agentName: 'SupportAgent',
  customerId: 'cust_123',
});
```

## Features (Coming Soon)

- 🔍 **Agent-level cost attribution** — not just API-call totals
- 🌲 **Multi-agent trace trees** — see cost flow through parent→child agents
- 💰 **Per-customer cost tracking** — know your AI cost-per-customer
- 🚨 **Budget alerts** — stop agents before they overspend
- 📊 **Optimization recommendations** — "route 70% of queries to a cheaper model"
- 🔗 **Framework support** — LangChain, CrewAI, OpenAI Agents SDK, Vercel AI SDK

## How It Works

```
Your App + NeuraMeter SDK
  └── Wraps LLM API calls with agent/task/customer metadata
       └── Sends cost events to NeuraMeter
            └── Dashboard shows real-time cost attribution

[SupportAgent] ─── $0.082 ─── 3,200ms
  ├── [ClassifierAgent] ─── $0.003 ─── gpt-4o-mini
  ├── [ResearchAgent] ─── $0.031 ─── claude-sonnet
  └── [DraftAgent] ─── $0.048 ─── gpt-4o
```

## Quick Start (Coming Soon)

```bash
npm install @neurameter/core @neurameter/openai
```

## Waitlist

→ **[Sign up for early access at meter.neuria.tech](https://meter.neuria.tech)**

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT — Built with ❤️ by [NEURIA](https://neuria.tech)
```

3. 「Commit changes」

### 2-4. リポジトリの設定（5分）

1. リポページ → 右側の「About」セクション → ⚙（設定）
2. 以下を入力：
   ```
   Description: Know exactly what your AI agents cost. Per agent. Per task. Per customer.
   Website: https://meter.neuria.tech
   Topics: ai-agents, llm, cost-optimization, observability, neurameter, neuria, opentelemetry
   ```
3. 「Save changes」

4. リポ → 「Settings」タブ → 「Features」
   - ✅ Issues
   - ✅ Discussions（ユーザーが質問できるように）
   - ✅ Projects（オプション）

---

## タスク3：ランディングページ公開（1時間）

### 3-1. Supabase側の準備（10分）

1. supabase.com → 既存プロジェクトまたは新規作成
2. SQL Editorで以下を実行：

```sql
-- Waitlistテーブル
CREATE TABLE waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  source TEXT DEFAULT 'website',  -- website, twitter, github
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS有効化（匿名ユーザーがINSERTだけできるように）
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert to waitlist"
  ON waitlist FOR INSERT
  WITH CHECK (true);

-- 自分だけがSELECTできる
CREATE POLICY "Only admin can view waitlist"
  ON waitlist FOR SELECT
  USING (auth.uid() IS NOT NULL);
```

3. Settings → API → `anon` public key と Project URL をメモ

### 3-2. ランディングページの作成（40分）

Claude Codeで作成する場合、以下のプロンプトを使用：

```
以下の仕様でNeuraMeterのランディングページを作成してください。

技術スタック: Next.js 15 (App Router) + Tailwind CSS v4 + shadcn/ui
デプロイ先: Vercel（meter.neuria.tech）

ページ構成（1ページ、スクロールのみ）:

1. ヒーローセクション
   - ヘッドライン: "Know what your AI agents actually cost."
   - サブ: "Per-agent. Per-task. Per-customer. Open source."
   - CTA: メールアドレス入力フォーム（Waitlist登録）
   - GitHub Starsバッジ（shields.io）

2. 問題提起セクション
   - "Your AI bill says $4,800. But which agent spent it?"
   - 3つのペインポイント（アイコン付き）:
     - "No per-agent breakdown"
     - "No per-task attribution"  
     - "No per-customer costs"

3. 解決策セクション
   - コード例（SDKの使用例3行）
   - ダッシュボードのモック画像（プレースホルダー）
   - "2 lines of code. Real-time cost attribution."

4. 機能セクション
   - 6つの機能カード（Agent Attribution, Trace Trees, 
     Customer Costs, Budget Alerts, Optimization, Framework Support）

5. フッター
   - "Built by NEURIA" + GitHub + Twitter リンク
   - "MIT License"

デザイン:
- ダークテーマ（zinc-950背景）
- アクセントカラー: emerald-400（NEURIAブランドカラー）
- フォント: Geist（Vercelのデフォルト）
- ミニマルで技術者向け。マーケ感を排除。
- モバイル対応

Waitlistフォームの送信先:
- Supabase REST API
- URL: [あなたのSUPABASE_URL]/rest/v1/waitlist
- Headers: apikey: [あなたのanon key], Content-Type: application/json
- Body: { "email": "入力されたメール" }
- 成功時: "You're on the list! We'll notify you at launch."

OGP設定:
- title: "NeuraMeter — Know what your AI agents cost"
- description: "Open-source cost attribution for AI agent systems. Per agent. Per task. Per customer."
- image: /og.png（1200x630、後で作成）
```

### 3-3. Vercelにデプロイ（5分）

1. vercel.com にログイン
2. 「Add New...」→ 「Project」
3. GitHubリポ「neuria-dev/neurameter」を選択
   - もしくはLP用に別リポを作る: `neuria-dev/neurameter-web`
4. 環境変数を設定：
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxx...
   ```
5. 「Deploy」

### 3-4. ドメイン設定（5分）

1. Vercel → プロジェクト → Settings → Domains
2. 「meter.neuria.tech」を入力 → Add
3. Vercelが表示するDNSレコードをメモ：
   ```
   Type: CNAME
   Name: meter
   Value: cname.vercel-dns.com
   ```
4. neuria.tech のDNS管理画面に移動（Cloudflare? お名前.com?）
5. DNSレコードを追加：
   ```
   タイプ: CNAME
   名前: meter
   ターゲット: cname.vercel-dns.com
   TTL: Auto
   ```
6. 5〜10分でSSL証明書が自動発行
7. https://meter.neuria.tech にアクセスして確認

### 3-5. OGP画像の作成（5分）

Canva（canva.com）で1200×630pxの画像を作成：

```
背景: #09090b（zinc-950）
テキスト（中央配置）:
  "NeuraMeter"（大きめ、白、フォント: モダンなサンセリフ）
  "Know what your AI agents cost."（小さめ、zinc-400）
  "by NEURIA"（さらに小さめ、emerald-400）
```

→ `/public/og.png` としてリポに追加

---

## タスク4：コミュニティ参加（30分）

### 4-1. LangChain Discord（10分）

1. https://discord.gg/langchain にアクセス
2. Discordアカウントでログイン（なければ作成）
3. サーバーに参加
4. `#introductions` チャンネルに以下を投稿：

```
Hi everyone! 👋

I'm Ren, building AI agent infrastructure at NEURIA from Osaka, Japan.

Currently working on cost management and attribution for multi-agent 
systems — specifically tracking per-agent, per-task costs across 
LangChain/LangGraph workflows.

Happy to chat about agent economics, cost optimization, or anything 
related to production AI agent deployments!

GitHub: github.com/neuria-dev/neurameter
```

5. `#general` と `#help` チャンネルを開く
6. コスト関連の質問があればブックマーク（後日回答する候補）
7. **まだ宣伝はしない。** 今は存在を認知してもらうだけ

### 4-2. AI Engineer Slack（10分）

1. https://www.latent.space/community にアクセス（or 「AI Engineer Slack」で検索して招待リンクを探す）
2. Slackワークスペースに参加
3. `#introductions` に以下を投稿：

```
Hi! I'm Ren from NEURIA (Osaka, Japan). Working on AI agent 
cost attribution tooling. Interested in the economics side of 
agent systems — how teams track, manage, and optimize their 
LLM spend across multi-agent workflows. 

Looking forward to connecting!
```

4. `#agents` `#llm-ops` `#tools` 等のチャンネルがあれば参加

### 4-3. Reddit（5分）

1. 以下のサブレディットを購読（Subscribe）：
   - r/LangChain
   - r/LocalLLaMA
   - r/MachineLearning
   - r/artificial
   - r/SaaS

2. **投稿はまだしない。** ローンチ週まで温める
3. 過去投稿を検索：「agent cost」「LLM bill」→ 関連投稿をブックマーク

### 4-4. その他（5分）

- **Hacker News:** アカウント確認（投稿にはkarmaが必要。なければ今日から2-3個のコメントを残してkarmaを貯める）
- **Product Hunt:** アカウント作成。Maker Profileを設定
- **dev.to:** アカウント作成。プロフィール設定

---

## タスク5：ターゲット50人リスト作成（30分）

### 5-1. スプレッドシート準備（3分）

Google Sheetsで新規作成。シート名：「NeuraMeter Launch Targets」

列構成：
```
| 名前 | ハンドル | プラットフォーム | 投稿内容の要約 | フォロワー数 | DM済み | 反応 |
```

### 5-2. X/Twitter検索で25人（12分）

以下の検索クエリを順番に実行して、エージェントコストに言及している開発者をリストアップ：

```
検索クエリ1: "agent cost" lang:en
検索クエリ2: "LLM bill" lang:en
検索クエリ3: "OpenAI invoice" surprised
検索クエリ4: "AI spend" tracking
検索クエリ5: "token cost" optimization agent
検索クエリ6: CrewAI cost production
検索クエリ7: LangChain cost monitoring
検索クエリ8: "AI agent" budget overshoot
```

**各検索で：**
- 「最新」タブに切り替え
- 開発者っぽい人（プロフィールにエンジニア/founder/building等がある）を選ぶ
- 企業の公式アカウントは除外（個人開発者を狙う）
- 1検索あたり3-4人をスプレッドシートに記録

### 5-3. GitHub検索で15人（10分）

以下を検索：

```
GitHub検索1: https://github.com/search?q=agent+cost+tracking&type=repositories
GitHub検索2: https://github.com/search?q=llm+cost+monitor&type=repositories
GitHub検索3: https://github.com/search?q=openai+cost+attribution&type=repositories
GitHub検索4: https://github.com/topics/llm-observability
```

**各検索で：**
- Star数が10〜500程度のリポの作者を狙う（大きすぎると返信しない、小さすぎると活動していない）
- 作者のプロフィールを開く → X/Twitterリンクがあればメモ
- スプレッドシートに記録

### 5-4. Discord/Slack検索で10人（5分）

LangChain DiscordとAI Engineer Slackで：

```
検索: cost
検索: budget
検索: billing
検索: expensive
```

- コストについて質問や不満を書いている人をリストアップ
- Discord/Slackのユーザー名を記録

### 5-5. リストの整理（3分）

50人のリストを3つのカテゴリに分類：

```
A（最優先・15人）: 
  - エージェントコストの不満を明確に投稿している
  - フォロワー500+（リツイートされやすい）
  - DM開放 or メアドが公開

B（重要・20人）:
  - LLM関連ツールを作っている開発者
  - AIエージェントを本番運用している

C（候補・15人）:
  - AI/LLM関連の投稿をしているが、コスト特化ではない
  - 関連するリポの作者
```

→ ローンチ日はA→B→Cの順にDMを送る

---

## Week 0 完了チェックリスト

```
□ X/Twitterプロフィール設定完了
□ 英語の最初の投稿を公開＆ピン留め
□ 日本語の投稿を公開
□ 関連アカウント20人をフォロー
□ GitHub組織 neuria-dev を作成
□ neurameter リポを作成（Public, MIT）
□ README.mdを完成版で公開
□ トピック・Description・URLを設定
□ Supabase waitlistテーブル作成
□ ランディングページをClaude Codeで作成
□ Vercelにデプロイ
□ meter.neuria.tech のDNS設定完了
□ OGP画像を設定
□ LangChain Discordに参加＆自己紹介
□ AI Engineer Slackに参加＆自己紹介
□ Reddit 5サブレディットを購読
□ HNアカウント確認
□ Product Huntアカウント作成
□ dev.toアカウント作成
□ ターゲット50人リストを完成
□ リストをA/B/Cに分類
```

**全て完了したら → 翌日からWeek 1（開発）に入る**
