import { describe, it, expect } from 'vitest';
import { analyzeContext, estimateTokens, getModelContextLimit, MODEL_CONTEXT_LIMITS } from '../context';
import type { Message } from '../context';

describe('estimateTokens', () => {
  it('estimates tokens for English text (~4 chars/token)', () => {
    const text = 'Hello world'; // 11 chars => ceil(11/4) = 3
    expect(estimateTokens(text)).toBe(3);
  });

  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('handles non-string content by serializing', () => {
    const obj = { key: 'value', nested: { a: 1 } };
    const serialized = JSON.stringify(obj);
    expect(estimateTokens(obj)).toBe(Math.ceil(serialized.length / 4));
  });

  it('handles null/undefined content', () => {
    expect(estimateTokens(null)).toBe(1); // "null" => ceil(4/4) = 1
    expect(estimateTokens(undefined)).toBe(0); // "" => 0
  });
});

describe('getModelContextLimit', () => {
  it('returns exact match for known models', () => {
    expect(getModelContextLimit('gpt-4o')).toBe(128_000);
    expect(getModelContextLimit('gpt-4.1')).toBe(1_000_000);
    expect(getModelContextLimit('o1')).toBe(200_000);
  });

  it('uses prefix matching for versioned model names', () => {
    expect(getModelContextLimit('claude-sonnet-4-20250514')).toBe(200_000);
    expect(getModelContextLimit('claude-opus-4-20250514')).toBe(200_000);
  });

  it('returns default 128k for unknown models', () => {
    expect(getModelContextLimit('unknown-model-v1')).toBe(128_000);
  });
});

describe('analyzeContext', () => {
  it('categorizes tokens by role', () => {
    const messages: Message[] = [
      { role: 'system', content: 'You are a helpful assistant.' }, // 28 chars => 7 tokens
      { role: 'user', content: 'Hello' },     // 5 chars => 2 tokens
      { role: 'assistant', content: 'Hi there' }, // 8 chars => 2 tokens
      { role: 'tool', content: 'Tool result data here' }, // 21 chars => 6 tokens
    ];

    const result = analyzeContext(messages, 'gpt-4o');

    expect(result.messageCount).toBe(4);
    expect(result.systemPromptTokens).toBe(7);
    expect(result.conversationTokens).toBe(4); // user + assistant
    expect(result.toolResultTokens).toBe(6);
    expect(result.estimatedInputTokens).toBe(17); // 7 + 4 + 6
    expect(result.modelContextLimit).toBe(128_000);
  });

  it('calculates utilization percentage', () => {
    // Create a message that uses ~50% of gpt-4o context (128k tokens = ~512k chars)
    const bigContent = 'a'.repeat(256_000); // 256000 chars => 64000 tokens
    const messages: Message[] = [
      { role: 'user', content: bigContent },
    ];

    const result = analyzeContext(messages, 'gpt-4o');

    expect(result.estimatedInputTokens).toBe(64_000);
    expect(result.utilizationPercent).toBeCloseTo(0.5, 2);
  });

  it('handles empty messages', () => {
    const result = analyzeContext([], 'gpt-4o');

    expect(result.estimatedInputTokens).toBe(0);
    expect(result.utilizationPercent).toBe(0);
    expect(result.messageCount).toBe(0);
    expect(result.systemPromptTokens).toBe(0);
    expect(result.conversationTokens).toBe(0);
    expect(result.toolResultTokens).toBe(0);
  });

  it('handles unknown model with default context limit', () => {
    const messages: Message[] = [
      { role: 'user', content: 'test' },
    ];

    const result = analyzeContext(messages, 'custom-model-v1');

    expect(result.modelContextLimit).toBe(128_000);
  });
});
