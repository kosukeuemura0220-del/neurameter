# NeuraMeter マーケティング戦略：最初の1ヶ月
## Week 0（開発前）→ Week 1（開発＆発信）→ Week 2（ローンチ）→ Week 3-4（初期獲得）

---

## 全体タイムライン

```
Week 0（1日）     種まき。LP公開、GitHub作成、X投稿、コミュニティ参加
Week 1（7日）     Claude Codeで開発。毎日ビルド過程を発信
Week 2（7日）     ローンチ週。HN→PH→Reddit→dev.to→振り返り
Week 3-4（14日）  初期獲得。10人の有料顧客を目指す
```

**1ヶ月後の目標：**
- GitHub Stars: 300+
- サインアップ: 100+
- 有料顧客: 5-10人
- X/Twitterフォロワー: 200+

---

## Week 0：種まき（1日で完了）

### 必須タスク（合計3時間）

**タスク1：X/Twitterアカウント整備＋最初の投稿（30分）**

プロフィール：
```
名前: Ren | Building NeuraMeter
Bio: Building the cost attribution layer for AI agents. 
     Know what each agent costs, per task, per customer. OSS.
     🔧 by NEURIA — Shipping daily.
リンク: meter.neuria.tech
```

最初の投稿（英語）：
```
My AI agent bill jumped from $1,200 to $4,800 last month.

Nobody on the team could explain why.

OpenAI dashboard shows total spend per day. That's it.
No per-agent breakdown. No per-task attribution.

I'm building an open-source tool to fix this — NeuraMeter.

Who else has this problem?
```

→ ピン留めに設定

**タスク2：GitHubリポ作成（30分）**
- `github.com/neuria-dev/neurameter`（NEURIA組織配下推奨）
- Public、MIT License
- README作成：

```markdown
# NeuraMeter
> Know exactly what your AI agents cost. Per agent. Per task. Per customer.

🚧 **Coming Soon** — Star this repo to get notified at launch.

## The Problem
You get a $4,800 bill from OpenAI. No one on your team can explain why.
Existing tools show total API costs. NeuraMeter shows which agent,
running which task, for which customer, burned the money.

## What NeuraMeter Does
- 🔍 Agent-level cost attribution (not just API-call level)
- 💰 Per-customer cost tracking for SaaS companies
- 🚨 Budget alerts before agents overspend
- 📊 Optimization recommendations
- 🔗 Works with LangChain, CrewAI, OpenAI Agents SDK, Vercel AI SDK

## Quick Start (Coming Soon)
npm install @neurameter/core @neurameter/openai

## Links
- 🌐 [meter.neuria.tech](https://meter.neuria.tech)
- 📧 [Sign up for early access](https://meter.neuria.tech)

## License
MIT — Built by [NEURIA](https://neuria.tech)
```

- トピック: `ai-agents` `llm` `cost-optimization` `observability` `neurameter`

**タスク3：ランディングページ公開（1時間）**
- meter.neuria.tech にデプロイ
- 構成：ヘッドライン → 問題提起 → 解決策 → Waitlistフォーム
- OGP画像設定

**タスク4：コミュニティ参加（30分）**
- LangChain Discord、AI Engineer Slack参加
- 自己紹介のみ：
```
Hi! I'm Ren, building AI agent tools at NEURIA from Osaka, Japan.
Working on cost management and attribution for multi-agent systems.
Happy to chat about agent economics!
```

**タスク5：ターゲット50人リスト作成（30分）**

---

## Week 1：開発＆発信（7日間）

### 原則：開発85% / 発信15%

### 毎日のルーティン

**朝（3分）：X投稿**
```
Day [N] of building NeuraMeter 🔧

Today: [その日やること]
Yesterday: [昨日の成果]

meter.neuria.tech | github.com/neuria-dev/neurameter
```

**夜（15分）：X投稿（画像付き）**
```
Day [N] done ✅

[スクリーンショット]

What I built:
- [成果1]
- [成果2]

Biggest challenge: [困難]

[残り日数] days until launch 🚀
```

### Day 1 特別タスク：「Why I'm building NeuraMeter」スレッド

OpenAI APIへの指示：
```
以下の情報で、X/Twitter用の5ツイートスレッドを英語で作成。
トーン：技術者向け、正直、セールストークなし。

1. AIエージェントの月額コストが予測不能な問題
2. 既存ツール（Helicone/Portkey）はAPI単位の追跡のみ
3. エージェント/タスク/顧客単位のコスト帰属がない
4. OTel準拠、OSS、Claude Codeで1週間で開発中
5. 名前はNeuraMeter。NEURIAが作っている。GitHubリンクとフィードバック依頼

各ツイート280文字以内。
```

### Day 7 特別タスク：dev.to記事の下書き

タイトル：`I built NeuraMeter — an AI agent cost tracker in 7 days with Claude Code`

---

## Week 2：ローンチ週

### 月曜日：Hacker News（最重要）

**22:00 JST に投稿**

タイトル：
```
Show HN: NeuraMeter – Open-source cost attribution for AI agent systems
```
→ github.com/neuria-dev/neurameter にリンク

### 火曜日：Product Hunt
### 水曜日：Reddit（r/LangChain, r/LocalLLaMA）
### 木曜日：dev.to + Zenn
### 金曜日：振り返り投稿

（各日の詳細は前版と同じ構成、名前をNeuraMeterに変更）

### ローンチ週の並行タスク
- [ ] ターゲット50人にDM
- [ ] LangChain公式リポにインテグレーションPR
- [ ] CrewAI公式リポにインテグレーションPR

---

## Week 3-4：初期獲得（14日間）

### 目標：5-10人の有料顧客

### ウェルカムメールテンプレート
```
Subject: Welcome to NeuraMeter — quick question

Hey [Name],

Thanks for signing up for NeuraMeter!

Quick question: what are you building with AI agents right now?
And what's your biggest frustration with tracking costs?

I'm building this at NEURIA to solve a real problem,
so your input directly shapes what I build next.

If you'd like a 15-min walkthrough of the SDK integration,
just reply and I'll set up a time.

— Ren (NEURIA)
```

### ブログ記事テーマ
- Week 3：「The real cost of running a CrewAI crew in production」
- Week 4：「GPT-4o vs Claude Sonnet: agent cost comparison 2026」

### 特別タスク
- [ ] Zoomオンボーディング（5人限定）
- [ ] 「モデル別コスト比較計算機」公開
- [ ] ニュースレター「Agent Economics Weekly」第1号

---

## OpenClawで自動化する部分

```
[Cron: 6時間ごと] → marketing_stars_monitor
  → GitHub API → マイルストーン到達時 → OpenAI API → ツイート生成 → Typefully

[Cron: 1時間ごと] → marketing_community_monitor
  → Reddit/HN API → OpenAI API(gpt-4o-mini)で判定 → Slack通知

[Webhook: GitHub Release] → marketing_release_announce
  → OpenAI API → ツイート生成 → Typefully

[Webhook: Supabase INSERT] → marketing_welcome_trigger
  → Loops.so API → ウェルカムメール

[Cron: 毎週金曜] → marketing_weekly_report
  → 全API → OpenAI API → サマリー → Slack + Typefully
```

### 手動で残す部分
- HN/Redditコメント返信
- Discord対応
- ブログ最終編集
- Zoomオンボーディング
- DM送信
- ストーリーテリング

---

## 費用まとめ（1ヶ月目）

| 項目 | 費用 |
|---|---|
| Typefully Creator | ¥2,800 |
| Hashnode | ¥0 |
| Loops.so Free | ¥0 |
| Buttondown（Week 3から） | ¥4,300 |
| OpenAI API（OpenClawマーケ自動化） | ¥250 |
| Supabase Pro（NeuraMeter本体用） | ¥3,700 |
| Vercel Free | ¥0 |
| Cloudflare Workers | ¥750 |
| neuria.techドメイン（既存） | ¥0（追加費用なし） |
| **合計** | **約¥11,800/月** |

---

## 1ヶ月後の判断基準

**「40%テスト」：** ユーザーに「NeuraMeterが使えなくなったらどう感じますか？」
- 40%以上が「非常に困る」→ PMFあり

| 指標 | 最低ライン | 好調ライン |
|---|---|---|
| GitHub Stars | 100 | 500+ |
| サインアップ | 50 | 200+ |
| npm DL/月 | 500 | 2,000+ |
| 有料顧客 | 3 | 10+ |
| Free→Paid率 | 2% | 5%+ |
