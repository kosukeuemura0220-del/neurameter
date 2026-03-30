import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BatchTransport } from '../batch-transport';

describe('BatchTransport', () => {
  let transport: BatchTransport;

  beforeEach(() => {
    vi.useFakeTimers();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accepted: 1, rejected: 0, errors: [] }),
    });
  });

  afterEach(() => {
    transport?.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('buffers events until batch size', () => {
    transport = new BatchTransport({
      endpoint: 'https://test.example.com',
      apiKey: 'nm_test_key',
      batchSize: 5,
      flushIntervalMs: 60_000,
    });

    transport.enqueue({ id: 1 });
    transport.enqueue({ id: 2 });
    transport.enqueue({ id: 3 });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(transport.pendingCount).toBe(3);
  });

  it('auto-flushes at batch size', () => {
    transport = new BatchTransport({
      endpoint: 'https://test.example.com',
      apiKey: 'nm_test_key',
      batchSize: 3,
      flushIntervalMs: 60_000,
    });

    transport.enqueue({ id: 1 });
    transport.enqueue({ id: 2 });
    transport.enqueue({ id: 3 });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('sends correct payload format', async () => {
    transport = new BatchTransport({
      endpoint: 'https://test.example.com',
      apiKey: 'nm_test_key',
      batchSize: 2,
      flushIntervalMs: 60_000,
    });

    transport.enqueue({ eventId: 'e1' });
    transport.enqueue({ eventId: 'e2' });

    // Let the flush promise settle
    await vi.advanceTimersByTimeAsync(100);

    const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(fetchCall[0]).toBe('https://test.example.com/v1/events');
    expect(fetchCall[1].method).toBe('POST');
    expect(fetchCall[1].headers['Authorization']).toBe('Bearer nm_test_key');

    const body = JSON.parse(fetchCall[1].body);
    expect(body.batch).toHaveLength(2);
    expect(body.batch[0].eventId).toBe('e1');
  });

  it('retries on 5xx errors', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount <= 2) {
        return Promise.resolve({ ok: false, status: 500 });
      }
      return Promise.resolve({ ok: true });
    });

    transport = new BatchTransport({
      endpoint: 'https://test.example.com',
      apiKey: 'nm_test_key',
      batchSize: 1,
      flushIntervalMs: 60_000,
      maxRetries: 3,
    });

    transport.enqueue({ id: 1 });

    // Advance enough time for retries with exponential backoff
    // backoff(0) = 1s, backoff(1) = 2s
    await vi.advanceTimersByTimeAsync(10_000);

    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('does not retry on 4xx (except 429)', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400 });

    transport = new BatchTransport({
      endpoint: 'https://test.example.com',
      apiKey: 'nm_test_key',
      batchSize: 1,
      flushIntervalMs: 60_000,
    });

    transport.enqueue({ id: 1 });
    await vi.advanceTimersByTimeAsync(1000);

    // Should only try once for 400 error
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 (rate limit)', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ ok: false, status: 429 });
      }
      return Promise.resolve({ ok: true });
    });

    transport = new BatchTransport({
      endpoint: 'https://test.example.com',
      apiKey: 'nm_test_key',
      batchSize: 1,
      flushIntervalMs: 60_000,
      maxRetries: 3,
    });

    transport.enqueue({ id: 1 });
    await vi.advanceTimersByTimeAsync(5_000);

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('marks offline on network error and buffers', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    transport = new BatchTransport({
      endpoint: 'https://test.example.com',
      apiKey: 'nm_test_key',
      batchSize: 1,
      flushIntervalMs: 60_000,
    });

    transport.enqueue({ id: 1 });
    await vi.advanceTimersByTimeAsync(1000);

    // Event should still be pending (buffered for retry)
    expect(transport.pendingCount).toBe(1);
  });

  it('flushes on timer interval', async () => {
    transport = new BatchTransport({
      endpoint: 'https://test.example.com',
      apiKey: 'nm_test_key',
      batchSize: 100,
      flushIntervalMs: 5_000,
    });

    transport.enqueue({ id: 1 });
    expect(global.fetch).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5_000);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('respects max batch size of 100', () => {
    transport = new BatchTransport({
      endpoint: 'https://test.example.com',
      apiKey: 'nm_test_key',
      batchSize: 200,
      flushIntervalMs: 60_000,
    });

    for (let i = 0; i < 101; i++) {
      transport.enqueue({ id: i });
    }

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
