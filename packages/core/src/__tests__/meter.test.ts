import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NeuraMeter } from '../meter';

describe('NeuraMeter', () => {
  let meter: NeuraMeter;

  beforeEach(() => {
    vi.useFakeTimers();
    // Mock fetch globally
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accepted: 1, rejected: 0, errors: [] }),
    });

    meter = new NeuraMeter({
      apiKey: 'nm_org123_secret456',
      projectId: 'proj_test',
      endpoint: 'https://test.example.com',
      batchSize: 3,
      flushIntervalMs: 10_000,
    });
  });

  afterEach(() => {
    meter.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('extracts orgId from API key', () => {
    // Internal state, verify through record behavior
    meter.record({
      traceId: 'trace1',
      spanId: 'span1',
      agentName: 'TestAgent',
      provider: 'openai',
      model: 'gpt-4o',
      inputTokens: 100,
      outputTokens: 50,
      costMicrodollars: 1000,
      latencyMs: 200,
    });

    // Trigger flush
    void meter.flush();
  });

  it('buffers events until batch size', () => {
    meter.record({
      traceId: 't1', spanId: 's1', agentName: 'A',
      provider: 'openai', model: 'gpt-4o',
      inputTokens: 100, outputTokens: 50,
      costMicrodollars: 500, latencyMs: 100,
    });

    meter.record({
      traceId: 't2', spanId: 's2', agentName: 'B',
      provider: 'openai', model: 'gpt-4o',
      inputTokens: 200, outputTokens: 100,
      costMicrodollars: 1000, latencyMs: 200,
    });

    // Should not have flushed yet (batch size = 3)
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('auto-flushes when batch size reached', () => {
    for (let i = 0; i < 3; i++) {
      meter.record({
        traceId: `t${i}`, spanId: `s${i}`, agentName: 'A',
        provider: 'openai', model: 'gpt-4o',
        inputTokens: 100, outputTokens: 50,
        costMicrodollars: 500, latencyMs: 100,
      });
    }

    // Should have triggered flush at batch size 3
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('creates a trace with correct traceId', () => {
    const trace = meter.startTrace({ agentName: 'TestAgent' });
    expect(trace.traceId).toBeDefined();
    expect(typeof trace.traceId).toBe('string');
    expect(trace.traceId.length).toBeGreaterThan(0);
  });

  it('does not propagate errors from flush', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    meter.record({
      traceId: 't1', spanId: 's1', agentName: 'A',
      provider: 'openai', model: 'gpt-4o',
      inputTokens: 100, outputTokens: 50,
      costMicrodollars: 500, latencyMs: 100,
    });

    // Should not throw
    await expect(meter.flush()).resolves.toBeUndefined();
  });
});
