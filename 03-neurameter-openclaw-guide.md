# OpenClaw セットアップ＆NeuraMeterマーケ自動化ガイド
## ゼロからの環境構築 → OpenAI APIでマーケティング自動化

---

## 前提条件

- **PC：** 専用Windows 10 PC（24時間稼働用）
- **WSL2：** Ubuntu 22.04
- **OpenClawパス：** `/Users/UemuraKousuke/Desktop/management-claw/neuria`
- **AI API：** OpenAI API（GPT-4o-mini / GPT-4o）
- **目的：** NeuraMeterのマーケティングタスクをOpenClawで自動化

---

## Part 1：環境構築（ゼロからの場合）

### Step 1：WSL2が有効か確認

PowerShell（管理者権限）で実行：
```powershell
wsl --list --verbose
```

Ubuntu 22.04が表示される → Step 3へ
表示されない → Step 2へ

### Step 2：WSL2 + Ubuntu 22.04 のインストール

```powershell
wsl --install
wsl --install -d Ubuntu-22.04
# PCを再起動
```

### Step 3：Ubuntuの基本セットアップ

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential

# Node.js v20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

node -v   # v20.x.x
npm -v    # 10.x.x

npm install -g pnpm
```

### Step 4：OpenClawの確認

```bash
cd /mnt/c/Users/UemuraKousuke/Desktop/management-claw/neuria
ls -la

# 存在する場合
git pull origin main

# 依存関係インストール
npm install
```

### Step 5：APIキーの取得と設定

`.env` ファイル：

```env
# ==============================
# AI API（OpenAI — メインで使用）
# ==============================
OPENAI_API_KEY=sk-xxxxx
# 取得: https://platform.openai.com/api-keys → Create new secret key

# ==============================
# GitHub
# ==============================
GITHUB_TOKEN=ghp_xxxxx
GITHUB_REPO=neuria-dev/neurameter
# 取得: https://github.com/settings/tokens → Generate new token (classic)
# スコープ: repo, read:org

# ==============================
# X/Twitter（Typefully経由）
# ==============================
TYPEFULLY_API_KEY=ty_xxxxx
# 取得: https://typefully.com → Settings → API → Generate Key

# ==============================
# Slack（通知用）
# ==============================
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxxxx
# 取得: Slack App → Incoming Webhooks → Add New Webhook

# ==============================
# Email（Loops.so）
# ==============================
LOOPS_API_KEY=xxxxx
# 取得: https://app.loops.so → Settings → API Keys

# ==============================
# Blog（Hashnode）
# ==============================
HASHNODE_API_TOKEN=xxxxx
HASHNODE_PUBLICATION_ID=xxxxx
# 取得: https://hashnode.com → Settings → Developer → Personal Access Token

# ==============================
# Newsletter（Buttondown）
# ==============================
BUTTONDOWN_API_KEY=xxxxx
# 取得: https://buttondown.com → Settings → API

# ==============================
# 監視キーワード
# ==============================
MONITOR_KEYWORDS=neurameter,neuria meter,agent cost,llm cost tracking,ai agent bill,helicone,portkey,burnrate
```

**dotenvインストール：**
```bash
cd /mnt/c/Users/UemuraKousuke/Desktop/management-claw/neuria
npm install dotenv
```

---

## Part 2：マーケティング自動化タスク（OpenAI API版）

### ディレクトリ作成

```bash
mkdir -p tasks/marketing
```

### 共通ユーティリティ

`tasks/marketing/_utils.js`:
```javascript
require('dotenv').config({
  path: '/mnt/c/Users/UemuraKousuke/Desktop/management-claw/neuria/.env'
});
const fs = require('fs');

// OpenAI API呼び出し（GPT-4o-mini or GPT-4o）
async function callOpenAI(prompt, { model = 'gpt-4o-mini', maxTokens = 500 } = {}) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// Typefullyにツイート予約
async function postToTypefully(content) {
  const res = await fetch('https://api.typefully.com/v1/drafts/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': `Bearer ${process.env.TYPEFULLY_API_KEY}`
    },
    body: JSON.stringify({
      content,
      threadify: false,
      schedule_date: 'next-free-slot'
    })
  });
  return res.json();
}

// Slack通知
async function notifySlack(message) {
  if (!process.env.SLACK_WEBHOOK_URL) return;
  await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message })
  });
}

// 状態ファイルの読み書き
function readState(file, defaultValue = {}) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return defaultValue; }
}

function writeState(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

module.exports = { callOpenAI, postToTypefully, notifySlack, readState, writeState };
```

### タスク1：GitHub Stars監視＆マイルストーンツイート

`tasks/marketing/stars-monitor.js`:
```javascript
const { callOpenAI, postToTypefully, notifySlack, readState, writeState } = require('./_utils');

const MILESTONES = [50, 100, 200, 500, 1000, 2000, 5000];
const REPO = process.env.GITHUB_REPO;
const STATE_FILE = './tasks/marketing/.stars-state.json';

async function getStarCount() {
  const res = await fetch(`https://api.github.com/repos/${REPO}`, {
    headers: { 'Authorization': `Bearer ${process.env.GITHUB_TOKEN}` }
  });
  const data = await res.json();
  return data.stargazers_count;
}

async function run() {
  const currentStars = await getStarCount();
  const state = readState(STATE_FILE, { stars: 0 });

  console.log(`[Stars] Current: ${currentStars}, Last: ${state.stars}`);

  const milestone = MILESTONES.find(m => state.stars < m && currentStars >= m);

  if (milestone) {
    console.log(`🎉 Milestone: ${milestone} stars!`);

    const tweet = await callOpenAI(
      `NeuraMeter (open-source AI agent cost tracking tool by NEURIA) just hit ${milestone} GitHub stars (currently ${currentStars}). Write a celebratory tweet under 250 chars. Be genuine, humble, grateful. No hashtags. Max 1 emoji. Include: https://github.com/${REPO}`,
      { model: 'gpt-4o-mini' }
    );

    await postToTypefully(tweet);
    await notifySlack(`🎉 NeuraMeter hit ${milestone} GitHub stars! Tweet scheduled.`);
  }

  writeState(STATE_FILE, { stars: currentStars, updatedAt: new Date().toISOString() });
}

run().catch(console.error);
```

### タスク2：Reddit/HNキーワード監視

`tasks/marketing/community-monitor.js`:
```javascript
const { callOpenAI, notifySlack, readState, writeState } = require('./_utils');

const KEYWORDS = (process.env.MONITOR_KEYWORDS || '').split(',');

async function searchHN(keyword) {
  const since = Math.floor(Date.now() / 1000) - 3600;
  const res = await fetch(
    `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(keyword)}&tags=story&numericFilters=created_at_i>${since}`
  );
  const data = await res.json();
  return data.hits.map(h => ({
    title: h.title,
    url: `https://news.ycombinator.com/item?id=${h.objectID}`,
    source: 'HN', points: h.points
  }));
}

async function searchReddit(keyword) {
  const res = await fetch(
    `https://www.reddit.com/search.json?q=${encodeURIComponent(keyword)}&sort=new&t=hour&limit=10`,
    { headers: { 'User-Agent': 'NeuraMeter-Monitor/1.0' } }
  );
  const data = await res.json();
  return (data.data?.children || []).map(c => ({
    title: c.data.title,
    url: `https://reddit.com${c.data.permalink}`,
    source: `r/${c.data.subreddit}`, points: c.data.score
  }));
}

async function run() {
  console.log(`[Community] Checking ${KEYWORDS.length} keywords...`);

  let allPosts = [];
  for (const kw of KEYWORDS) {
    const hn = await searchHN(kw.trim());
    const reddit = await searchReddit(kw.trim());
    allPosts = [...allPosts, ...hn, ...reddit];
    await new Promise(r => setTimeout(r, 1000));
  }

  const unique = [...new Map(allPosts.map(p => [p.url, p])).values()];
  console.log(`Found ${unique.length} posts.`);

  if (unique.length === 0) return;

  // GPT-4o-miniで関連性判定（最安）
  const response = await callOpenAI(
    `以下の投稿リストから、AIエージェントのコスト管理・追跡・最適化に関連するものだけをフィルタしてください。
関連性スコア(1-10)と推奨アクション(reply/monitor/ignore)を付けてJSON配列で返してください。

${JSON.stringify(unique.slice(0, 20), null, 2)}

応答形式: [{"title":"...","url":"...","relevance":8,"action":"reply","reason":"..."}]
JSONのみ返してください。`,
    { model: 'gpt-4o-mini', maxTokens: 800 }
  );

  try {
    const relevant = JSON.parse(response).filter(p => p.relevance >= 6);
    if (relevant.length > 0) {
      const blocks = relevant.map(p =>
        `*[${p.action?.toUpperCase()}]* (${p.relevance}/10)\n<${p.url}|${p.title}>\n_${p.reason}_`
      ).join('\n\n');
      await notifySlack(`🔍 *NeuraMeter Community Monitor*\n\n${blocks}`);
      console.log(`${relevant.length} actionable posts found.`);
    }
  } catch (e) {
    console.error('Parse error:', e.message);
  }
}

run().catch(console.error);
```

### タスク3：GitHub Release → 自動ツイート

`tasks/marketing/release-announce.js`:
```javascript
const { callOpenAI, postToTypefully, notifySlack, readState, writeState } = require('./_utils');

const REPO = process.env.GITHUB_REPO;
const STATE_FILE = './tasks/marketing/.release-state.json';

async function run() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { 'Authorization': `Bearer ${process.env.GITHUB_TOKEN}` }
  });
  const release = await res.json();
  const state = readState(STATE_FILE, { tag: null });

  if (!release.tag_name || release.tag_name === state.tag) {
    console.log('[Release] No new release.');
    return;
  }

  console.log(`[Release] New: ${release.tag_name}`);

  const tweet = await callOpenAI(
    `NeuraMeter ${release.tag_name} was just released. Release notes:\n\n${(release.body || '').slice(0, 500)}\n\nWrite a tweet announcing this release. Under 250 chars. Highlight 1-2 key improvements. Include: ${release.html_url}. No hashtags. Max 1 emoji.`,
    { model: 'gpt-4o-mini' }
  );

  await postToTypefully(tweet);
  await notifySlack(`📦 NeuraMeter ${release.tag_name} released! Tweet scheduled.`);
  writeState(STATE_FILE, { tag: release.tag_name });
}

run().catch(console.error);
```

### タスク4：週次メトリクスレポート

`tasks/marketing/weekly-report.js`:
```javascript
const { callOpenAI, postToTypefully, notifySlack, readState, writeState } = require('./_utils');

const REPO = process.env.GITHUB_REPO;
const STATE_FILE = './tasks/marketing/.metrics-history.json';

async function getGitHubMetrics() {
  const res = await fetch(`https://api.github.com/repos/${REPO}`, {
    headers: { 'Authorization': `Bearer ${process.env.GITHUB_TOKEN}` }
  });
  const d = await res.json();
  return { stars: d.stargazers_count, forks: d.forks_count, issues: d.open_issues_count };
}

async function getNpmDownloads() {
  const res = await fetch('https://api.npmjs.org/downloads/point/last-week/@neurameter/core');
  const d = await res.json();
  return d.downloads || 0;
}

async function run() {
  console.log('[Weekly Report] Collecting metrics...');

  const github = await getGitHubMetrics();
  const npmDL = await getNpmDownloads();
  const metrics = { github, npmDownloads: npmDL, date: new Date().toISOString() };

  // 履歴保存
  const history = readState(STATE_FILE, []);
  history.push(metrics);
  writeState(STATE_FILE, history);

  // GPT-4o-miniでサマリー生成
  const report = await callOpenAI(
    `NeuraMeter（by NEURIA）の週次メトリクス:
${JSON.stringify(metrics, null, 2)}
${history.length > 1 ? `前回: ${JSON.stringify(history[history.length - 2], null, 2)}` : '(初回)'}

以下を生成:
1. Slack用サマリー（日本語、200字、前週比の変化を含む）
2. X/Twitter用「今週の数字」投稿（英語、250字以内、1-2 emoji、meter.neuria.techを含む）

JSON形式: {"slack":"...","tweet":"..."}`,
    { model: 'gpt-4o-mini', maxTokens: 500 }
  );

  try {
    const parsed = JSON.parse(report);
    await notifySlack(`📊 *NeuraMeter Weekly Report*\n\n${parsed.slack}`);
    await postToTypefully(parsed.tweet);
    console.log('Report sent.');
  } catch (e) {
    await notifySlack(`📊 NeuraMeter Weekly:\n${JSON.stringify(metrics, null, 2)}`);
    console.error('Parse error:', e.message);
  }
}

run().catch(console.error);
```

---

## Part 3：Cron設定

### crontabの編集

```bash
crontab -e
```

追加内容：

```cron
# ==============================
# NeuraMeter Marketing Automation (via OpenClaw)
# ==============================

OPENCLAW_DIR=/mnt/c/Users/UemuraKousuke/Desktop/management-claw/neuria

# GitHub Stars監視（6時間ごと）
0 */6 * * * cd $OPENCLAW_DIR && /usr/bin/node tasks/marketing/stars-monitor.js >> /tmp/nm-stars.log 2>&1

# コミュニティ監視（1時間ごと）
0 * * * * cd $OPENCLAW_DIR && /usr/bin/node tasks/marketing/community-monitor.js >> /tmp/nm-community.log 2>&1

# Release監視（1時間ごと）
30 * * * * cd $OPENCLAW_DIR && /usr/bin/node tasks/marketing/release-announce.js >> /tmp/nm-release.log 2>&1

# 週次レポート（毎週金曜17:00 JST = UTC 08:00）
0 8 * * 5 cd $OPENCLAW_DIR && /usr/bin/node tasks/marketing/weekly-report.js >> /tmp/nm-weekly.log 2>&1
```

### cronサービス有効化

```bash
sudo service cron start
echo 'sudo service cron start' >> ~/.bashrc
sudo service cron status
```

### Windows起動時にWSL2を自動起動

タスクスケジューラ：
1. 名前: `WSL2 NeuraMeter AutoStart`
2. トリガー: コンピューターの起動時
3. プログラム: `wsl.exe`
4. 引数: `-d Ubuntu-22.04 -- bash -c "sudo service cron start && sleep infinity"`
5. 「最上位の特権で実行する」にチェック

---

## Part 4：動作確認

### テスト実行

```bash
cd /mnt/c/Users/UemuraKousuke/Desktop/management-claw/neuria

# 各タスクのテスト
node tasks/marketing/stars-monitor.js
node tasks/marketing/community-monitor.js
node tasks/marketing/release-announce.js
node tasks/marketing/weekly-report.js
```

### ログ確認

```bash
tail -f /tmp/nm-stars.log
tail -f /tmp/nm-community.log
tail -f /tmp/nm-release.log
tail -f /tmp/nm-weekly.log
```

### トラブルシューティング

```bash
# cronが動いているか
sudo service cron status

# cronのログ
grep CRON /var/log/syslog | tail -20

# Node.jsのパス確認
which node  # /usr/bin/node

# OpenAI APIの疎通確認
curl -s https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY" | head -c 200
```

---

## Part 5：API費用の詳細（OpenAI API）

### モデル別の使い分け

| タスク | モデル | 理由 |
|---|---|---|
| コミュニティ監視の判定 | **GPT-4o-mini** | 安い（$0.15/1M入力）。判定精度は十分 |
| ツイート生成 | **GPT-4o-mini** | 短文生成は安いモデルで十分 |
| ブログ下書き | **GPT-4o** | 長文は品質差が出る。$2.50/1M入力 |
| 週次レポート | **GPT-4o-mini** | 構造化データのサマリーは安いモデルで十分 |

### 月額コスト内訳

| タスク | 月間実行回数 | 月間トークン（推定） | 月額 |
|---|---|---|---|
| コミュニティ監視 | 720回 | 入力〜500K、出力〜100K | ¥100 |
| Stars監視 | 120回（生成は月1-2回） | 〜5K | ¥2 |
| Release告知 | 確認720回、生成月2-3回 | 〜10K | ¥3 |
| 週次レポート | 4回 | 入力〜20K、出力〜8K | ¥5 |
| ブログ下書き（Phase 2） | 4回 | 入力〜40K、出力〜30K | ¥100 |
| **合計** | | | **約¥210/月** |

**クレジット残高があれば実質¥0で開始可能。**

---

## Part 6：拡張タスク一覧

```
tasks/marketing/
├── _utils.js                 ✅ 共通ユーティリティ（OpenAI API）
├── stars-monitor.js          ✅ GitHub Stars監視
├── community-monitor.js      ✅ Reddit/HN監視
├── release-announce.js       ✅ Release自動告知
├── weekly-report.js          ✅ 週次レポート
├── blog-drafter.js           📝 Phase 2：ブログ下書き（GPT-4o）
├── crosspost.js              📝 Phase 2：Hashnode→dev.to
├── email-trigger.js          📝 Phase 2：Loops.so連携
└── competitor-tracker.js     📝 Phase 3：競合監視
```

### OpenClaw L1との統合位置

```
L1（効率化）
├── orchestrator           ← 既存
├── debugger               ← 既存
├── doc-generation         ← 既存
├── subsidy-scout          ← 既存
├── marketing-twitter      ← NEW（stars-monitor, release-announce）
├── marketing-community    ← NEW（community-monitor）
└── marketing-report       ← NEW（weekly-report）
```

---

## 運用チェックリスト

### 毎日（確認のみ・5分）
- [ ] Slackの通知を確認（関連投稿があれば手動で返信）
- [ ] Typefullyの予約投稿を確認

### 毎週金曜（10分）
- [ ] 週次レポートの確認
- [ ] メトリクス推移の確認

### 毎月1日（15分）
- [ ] OpenAI APIの使用量確認（platform.openai.com/usage）
- [ ] ログファイルのクリーンアップ: `rm /tmp/nm-*.log`
- [ ] 監視キーワードの見直し
