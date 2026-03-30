# @neurameter/core

Core SDK for NeuraMeter — real-time AI agent cost tracking.

## Installation

```bash
npm install @neurameter/core
# or
pnpm add @neurameter/core
```

## Quick Start

```typescript
import { NeuraMeter } from '@neurameter/core';

const meter = new NeuraMeter({
  apiKey: 'nm_xxx',
  projectId: 'proj_xxx',
});

// Record a cost event manually
meter.record({
  traceId: 'trace-123',
  spanId: 'span-456',
  agentName: 'SupportAgent',
  provider: 'openai',
  model: 'gpt-4o',
  inputTokens: 1500,
  outputTokens: 800,
  costMicrodollars: 11750,
  latencyMs: 450,
});

// Flush all buffered events before shutdown
await meter.flush();
```

## Multi-Agent Tracing

```typescript
const meter = new NeuraMeter({ apiKey: 'nm_xxx', projectId: 'proj_xxx' });

// Start a trace for a multi-agent workflow
const trace = meter.startTrace({
  agentName: 'OrchestratorAgent',
  customerId: 'cust_123',
});

// Record spans for each agent call
const parentSpan = trace.span({
  provider: 'openai',
  model: 'gpt-4o',
  usage: { inputTokens: 500, outputTokens: 200 },
  latencyMs: 300,
});

// Child spans
trace.span({
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  usage: { inputTokens: 1000, outputTokens: 500 },
  latencyMs: 800,
  parentSpanId: parentSpan,
  agentName: 'DraftAgent',
});
```

## With OpenAI / Anthropic SDKs

Use `@neurameter/openai` or `@neurameter/anthropic` for automatic instrumentation:

```typescript
import { NeuraMeter } from '@neurameter/core';
import { withMeter } from '@neurameter/openai';
import OpenAI from 'openai';

const meter = new NeuraMeter({ apiKey: 'nm_xxx', projectId: 'proj_xxx' });
const openai = withMeter(new OpenAI(), meter);

// Automatically tracks tokens, cost, and latency
const response = await openai.chat.completions.create(
  { model: 'gpt-4o', messages: [{ role: 'user', content: 'Hello' }] },
  { agentName: 'SupportAgent', taskName: 'classify-ticket' },
);
```

## CostEvent Type

```typescript
interface CostEvent {
  eventId: string;           // Auto-generated UUID
  timestamp: string;         // ISO 8601
  traceId: string;           // Groups related spans
  spanId: string;            // Unique span identifier
  parentSpanId?: string;     // Parent span (for tree structure)
  agentName: string;         // Name of the AI agent
  taskName?: string;         // Optional task label
  customerId?: string;       // End-user identifier
  provider: 'openai' | 'anthropic' | 'google' | 'other';
  model: string;             // Model identifier
  inputTokens: number;       // Prompt tokens
  outputTokens: number;      // Completion tokens
  reasoningTokens?: number;  // Reasoning tokens (o1, o3)
  cachedTokens?: number;     // Cached input tokens
  costMicrodollars: number;  // Cost in microdollars (1 USD = 1,000,000)
  latencyMs: number;         // Response latency
  tags?: Record<string, string>;
  orgId: string;             // Organization ID
  projectId: string;         // Project ID
}
```

## Key Design Decisions

- **Zero dependencies** — only uses native `fetch()` and `crypto`
- **Integer cost arithmetic** — all costs in microdollars (no floating-point)
- **Fire-and-forget** — SDK errors never propagate to your application
- **Batch sending** — events are buffered and sent in batches of 50-100
- **< 5KB gzipped** — minimal impact on bundle size
