import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withMeter } from '../with-meter';

// Mock NeuraMeter
const mockRecord = vi.fn();
const mockMeter = {
  record: mockRecord,
  startTrace: vi.fn(),
  flush: vi.fn(),
  destroy: vi.fn(),
} as any;

// Mock OpenAI client
function createMockOpenAI() {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          model: 'gpt-4o-2024-08-06',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Hello!' },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
            prompt_tokens_details: { cached_tokens: 3 },
            completion_tokens_details: { reasoning_tokens: 0 },
          },
        }),
      },
    },
    // Other OpenAI client properties
    models: { list: vi.fn() },
  } as any;
}

describe('withMeter (OpenAI)', () => {
  beforeEach(() => {
    mockRecord.mockClear();
  });

  it('wraps OpenAI client and records cost events', async () => {
    const openai = createMockOpenAI();
    const wrapped = withMeter(openai, mockMeter);

    await wrapped.chat.completions.create(
      {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
      },
      {
        agentName: 'TestAgent',
        taskName: 'test-task',
        customerId: 'cust_123',
        tags: { team: 'support' },
      },
    );

    expect(mockRecord).toHaveBeenCalledTimes(1);
    const event = mockRecord.mock.calls[0]![0];

    expect(event.agentName).toBe('TestAgent');
    expect(event.taskName).toBe('test-task');
    expect(event.customerId).toBe('cust_123');
    expect(event.provider).toBe('openai');
    expect(event.model).toBe('gpt-4o-2024-08-06');
    expect(event.inputTokens).toBe(10);
    expect(event.outputTokens).toBe(5);
    expect(event.cachedTokens).toBe(3);
    expect(event.tags).toEqual({ team: 'support' });
    expect(event.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('does not record when agentName is not provided', async () => {
    const openai = createMockOpenAI();
    const wrapped = withMeter(openai, mockMeter);

    await wrapped.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('passes through other client properties', () => {
    const openai = createMockOpenAI();
    const wrapped = withMeter(openai, mockMeter);

    // Other properties should be accessible
    expect(wrapped.models).toBeDefined();
    expect(wrapped.models.list).toBeDefined();
  });

  it('calls original create with correct args', async () => {
    const openai = createMockOpenAI();
    const wrapped = withMeter(openai, mockMeter);

    const body = {
      model: 'gpt-4o' as const,
      messages: [{ role: 'user' as const, content: 'Hello' }],
    };

    await wrapped.chat.completions.create(body, {
      agentName: 'TestAgent',
    });

    expect(openai.chat.completions.create).toHaveBeenCalledTimes(1);
    expect(openai.chat.completions.create.mock.calls[0][0]).toBe(body);
  });

  it('measures latency', async () => {
    const openai = createMockOpenAI();
    // Simulate a 50ms delay
    openai.chat.completions.create.mockImplementation(
      () => new Promise((resolve) =>
        setTimeout(() => resolve({
          model: 'gpt-4o',
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        }), 50),
      ),
    );

    const wrapped = withMeter(openai, mockMeter);

    await wrapped.chat.completions.create(
      { model: 'gpt-4o', messages: [] },
      { agentName: 'TestAgent' },
    );

    const event = mockRecord.mock.calls[0]![0];
    expect(event.latencyMs).toBeGreaterThanOrEqual(40); // allow some timing variance
  });
});
