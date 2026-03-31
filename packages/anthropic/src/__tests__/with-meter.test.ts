import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withMeter } from '../with-meter';

// Mock NeuraMeter
const mockRecord = vi.fn();
const mockCheckGuards = vi.fn().mockReturnValue(null);
const mockMeter = {
  record: mockRecord,
  checkGuards: mockCheckGuards,
  guards: undefined,
  startTrace: vi.fn(),
  flush: vi.fn(),
  destroy: vi.fn(),
} as any;

// Mock Anthropic client
function createMockAnthropic() {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-4-20250514',
        content: [{ type: 'text', text: 'Hello!' }],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 20,
          output_tokens: 10,
          cache_read_input_tokens: 5,
        },
      }),
    },
    // Other Anthropic client properties
    completions: { create: vi.fn() },
  } as any;
}

describe('withMeter (Anthropic)', () => {
  beforeEach(() => {
    mockRecord.mockClear();
    mockCheckGuards.mockClear();
    mockMeter.guards = undefined;
  });

  it('wraps Anthropic client and records cost events', async () => {
    const anthropic = createMockAnthropic();
    const wrapped = withMeter(anthropic, mockMeter);

    await wrapped.messages.create(
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Hello' }],
      },
      {
        agentName: 'TestAgent',
        taskName: 'test-task',
        customerId: 'cust_123',
        tags: { env: 'test' },
      },
    );

    expect(mockRecord).toHaveBeenCalledTimes(1);
    const event = mockRecord.mock.calls[0]![0];

    expect(event.agentName).toBe('TestAgent');
    expect(event.taskName).toBe('test-task');
    expect(event.customerId).toBe('cust_123');
    expect(event.provider).toBe('anthropic');
    expect(event.model).toBe('claude-sonnet-4-20250514');
    expect(event.inputTokens).toBe(20);
    expect(event.outputTokens).toBe(10);
    expect(event.cachedTokens).toBe(5);
    expect(event.tags).toEqual({ env: 'test' });
    expect(event.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('does not record when agentName is not provided', async () => {
    const anthropic = createMockAnthropic();
    const wrapped = withMeter(anthropic, mockMeter);

    await wrapped.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('passes through other client properties', () => {
    const anthropic = createMockAnthropic();
    const wrapped = withMeter(anthropic, mockMeter);

    expect(wrapped.completions).toBeDefined();
    expect(wrapped.completions.create).toBeDefined();
  });

  it('calls original create with correct args', async () => {
    const anthropic = createMockAnthropic();
    const wrapped = withMeter(anthropic, mockMeter);

    const body = {
      model: 'claude-sonnet-4-20250514' as const,
      max_tokens: 1024,
      messages: [{ role: 'user' as const, content: 'Hello' }],
    };

    await wrapped.messages.create(body, {
      agentName: 'TestAgent',
    });

    expect(anthropic.messages.create).toHaveBeenCalledTimes(1);
    expect(anthropic.messages.create.mock.calls[0]![0]).toBe(body);
  });

  it('measures latency', async () => {
    const anthropic = createMockAnthropic();
    anthropic.messages.create.mockImplementation(
      () => new Promise((resolve) =>
        setTimeout(() => resolve({
          model: 'claude-sonnet-4-20250514',
          usage: {
            input_tokens: 20,
            output_tokens: 10,
          },
        }), 50),
      ),
    );

    const wrapped = withMeter(anthropic, mockMeter);

    await wrapped.messages.create(
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [],
      },
      { agentName: 'TestAgent' },
    );

    const event = mockRecord.mock.calls[0]![0];
    expect(event.latencyMs).toBeGreaterThanOrEqual(40);
  });

  it('extracts system prompt for guard checks', async () => {
    mockMeter.guards = { mode: 'notify', maxInputTokens: 100000 };
    mockCheckGuards.mockReturnValue({
      decision: 'allow',
      triggeredRules: [],
      contextAnalysis: {
        estimatedInputTokens: 100,
        modelContextLimit: 200000,
        utilizationPercent: 0.0005,
        messageCount: 2,
        systemPromptTokens: 50,
        conversationTokens: 50,
        toolResultTokens: 0,
      },
    });

    const anthropic = createMockAnthropic();
    const wrapped = withMeter(anthropic, mockMeter);

    await wrapped.messages.create(
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: 'You are a helpful assistant.',
        messages: [{ role: 'user', content: 'Hello' }],
      },
      { agentName: 'TestAgent' },
    );

    expect(mockCheckGuards).toHaveBeenCalledTimes(1);
    const guardParams = mockCheckGuards.mock.calls[0]![0];
    expect(guardParams.messages).toHaveLength(2); // system + user
    expect(guardParams.messages[0].role).toBe('system');
    expect(guardParams.provider).toBe('anthropic');
    expect(guardParams.agentName).toBe('TestAgent');
  });
});
