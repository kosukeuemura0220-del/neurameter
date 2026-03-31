# NeuraMeter

**Know what your AI agents actually cost.** Per-agent. Per-task. Per-customer. Open source.

NeuraMeter is an open-source cost attribution platform for AI agent systems. Wrap your LLM client in 2 lines of code and get real-time cost tracking, trace trees, guard rails, and budget alerts.

## Quick Start

```bash
npm install @neurameter/core @neurameter/openai
```

```typescript
import { NeuraMeter } from '@neurameter/core';
import { withMeter } from '@neurameter/openai';
import OpenAI from 'openai';

const meter = new NeuraMeter({ apiKey: 'nm_xxx', projectId: 'proj_xxx' });
const openai = withMeter(new OpenAI(), meter);

// Costs are now tracked per agent, per task, per customer
const response = await openai.chat.completions.create(
  { model: 'gpt-4o', messages: [{ role: 'user', content: 'Hello' }] },
  { agentName: 'SupportAgent', taskName: 'classify-ticket', customerId: 'cust_123' },
);
```

## Packages

| Package | Description |
|---------|-------------|
| [`@neurameter/core`](./packages/core) | Core SDK — event types, cost calculation, tracing, guards |
| [`@neurameter/openai`](./packages/openai) | OpenAI SDK wrapper with automatic instrumentation |
| [`@neurameter/anthropic`](./packages/anthropic) | Anthropic SDK wrapper with automatic instrumentation |
| [`@neurameter/transport`](./packages/transport) | Batch transport layer for event delivery |
| [`@neurameter/pricing`](./packages/pricing) | Model pricing database (GPT-4o, Claude, etc.) |

## Architecture

```
Your App
  │
  ├─ @neurameter/openai (or /anthropic)  ← 2-line wrapper
  │     │
  │     ├─ @neurameter/core              ← cost calc, tracing, guards
  │     └─ @neurameter/transport         ← batched HTTP delivery
  │           │
  │           ▼
  │     Cloudflare Worker                ← /v1/events ingestion API
  │           │
  │           ▼
  │     Supabase PostgreSQL              ← cost_events, summaries, budgets
  │
  └─ Dashboard (Next.js)                ← meter.neuria.tech
        └─ Supabase queries             ← real-time cost visibility
```

## Features

- **Agent Attribution** — Track costs per agent, not just per API call
- **Trace Trees** — Visualize cost flow through parent-child agent hierarchies
- **Customer Costs** — Per-customer AI cost tracking for SaaS companies
- **Guard Rails** — Input token limits, context utilization thresholds, auto-optimization
- **Budget Alerts** — Set limits per org, agent, or customer with notifications
- **Multi-Provider** — OpenAI + Anthropic. LangChain and CrewAI coming soon

## Dashboard

The dashboard at `meter.neuria.tech` provides:

- Cost overview with time-series charts
- Agent-level cost breakdown with drill-down
- Trace viewer with span trees
- Model usage comparison
- Context window analysis
- Guard rails monitoring
- Budget management
- Alert feed

## Development

### Prerequisites

- Node.js 20+
- pnpm 9+

### Setup

```bash
git clone https://github.com/neuria-dev/neurameter.git
cd neurameter
pnpm install
pnpm build
```

### Commands

```bash
pnpm build       # Build all packages
pnpm typecheck   # Type-check all packages
pnpm test        # Run all tests
pnpm dev         # Start dashboard dev server
```

### Project Structure

```
neurameter/
├── packages/
│   ├── core/         # Core SDK
│   ├── openai/       # OpenAI wrapper
│   ├── anthropic/    # Anthropic wrapper
│   ├── transport/    # Batch transport
│   └── pricing/      # Model pricing data
├── apps/
│   ├── dashboard/    # Next.js dashboard
│   └── worker/       # Cloudflare Workers ingestion API
└── .github/
    └── workflows/    # CI pipeline
```

## Design Decisions

- **Integer arithmetic** — All costs in microdollars ($1 = 1,000,000). No floating-point.
- **Fire-and-forget** — SDK errors never propagate to your application code.
- **Batch sending** — Events buffered and sent in batches of 50-100.
- **Zero dependencies** — Core SDK uses only native `fetch()` and `crypto`.
- **SHA-256 API keys** — Keys are hashed before storage. No plaintext in DB.

## License

MIT — by [NEURIA](https://neuria.tech)
