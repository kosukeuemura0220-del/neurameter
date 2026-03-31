import { describe, it, expect } from 'vitest';
import { checkGuards, NeuraMeterGuardError } from '../guards';
import type { GuardsConfig } from '../guards';
import type { Message } from '../context';

const makeMessages = (tokenTarget: number): Message[] => {
  // Each char is ~0.25 tokens, so 4 * tokenTarget chars = tokenTarget tokens
  const content = 'a'.repeat(tokenTarget * 4);
  return [{ role: 'user', content }];
};

describe('checkGuards', () => {
  it('returns allow when no rules are triggered', () => {
    const config: GuardsConfig = {
      maxInputTokens: 100_000,
      mode: 'notify',
    };

    const result = checkGuards(config, {
      messages: [{ role: 'user', content: 'Hello' }],
      model: 'gpt-4o',
      provider: 'openai',
      agentName: 'TestAgent',
    });

    expect(result.decision).toBe('allow');
    expect(result.triggeredRules).toHaveLength(0);
    expect(result.contextAnalysis).not.toBeNull();
  });

  it('triggers soft input_tokens rule in notify mode', () => {
    const config: GuardsConfig = {
      maxInputTokens: 10,
      mode: 'notify',
    };

    const result = checkGuards(config, {
      messages: makeMessages(100), // well over 10 tokens
      model: 'gpt-4o',
      provider: 'openai',
      agentName: 'TestAgent',
    });

    expect(result.decision).toBe('notify');
    expect(result.triggeredRules.length).toBeGreaterThan(0);
    expect(result.triggeredRules[0]!.ruleType).toBe('input_tokens');
    expect(result.triggeredRules[0]!.isHard).toBe(false);
  });

  it('triggers hard input_tokens rule in block mode', () => {
    const config: GuardsConfig = {
      maxInputTokensHard: 10,
      mode: 'block',
    };

    const result = checkGuards(config, {
      messages: makeMessages(100),
      model: 'gpt-4o',
      provider: 'openai',
      agentName: 'TestAgent',
    });

    expect(result.decision).toBe('block');
    const hardRule = result.triggeredRules.find((r) => r.isHard);
    expect(hardRule).toBeDefined();
    expect(hardRule!.ruleType).toBe('input_tokens');
  });

  it('does not block for soft violations in block mode', () => {
    const config: GuardsConfig = {
      maxInputTokens: 10, // soft limit
      mode: 'block',
    };

    const result = checkGuards(config, {
      messages: makeMessages(100),
      model: 'gpt-4o',
      provider: 'openai',
      agentName: 'TestAgent',
    });

    // Soft violation in block mode => notify, not block
    expect(result.decision).toBe('notify');
  });

  it('checks context utilization threshold', () => {
    const config: GuardsConfig = {
      maxContextUtilization: 0.5, // 50%
      mode: 'notify',
    };

    // gpt-4o has 128k context. 80k tokens = 62.5% utilization
    const result = checkGuards(config, {
      messages: makeMessages(80_000),
      model: 'gpt-4o',
      provider: 'openai',
      agentName: 'TestAgent',
    });

    expect(result.decision).toBe('notify');
    const ctxRule = result.triggeredRules.find((r) => r.ruleType === 'context_utilization');
    expect(ctxRule).toBeDefined();
  });

  it('includes context analysis in result', () => {
    const config: GuardsConfig = {
      mode: 'notify',
    };

    const messages: Message[] = [
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: 'User message' },
      { role: 'assistant', content: 'Response' },
    ];

    const result = checkGuards(config, {
      messages,
      model: 'gpt-4o',
      provider: 'openai',
      agentName: 'TestAgent',
    });

    expect(result.contextAnalysis).not.toBeNull();
    expect(result.contextAnalysis!.messageCount).toBe(3);
    expect(result.contextAnalysis!.systemPromptTokens).toBeGreaterThan(0);
    expect(result.contextAnalysis!.conversationTokens).toBeGreaterThan(0);
    expect(result.contextAnalysis!.modelContextLimit).toBe(128_000);
  });

  it('generates suggestions for triggered rules', () => {
    const config: GuardsConfig = {
      maxInputTokens: 10,
      mode: 'notify',
    };

    const result = checkGuards(config, {
      messages: makeMessages(100),
      model: 'gpt-4o',
      provider: 'openai',
      agentName: 'TestAgent',
    });

    expect(result.suggestion).toBeDefined();
    expect(result.suggestion!.length).toBeGreaterThan(0);
  });

  it('defaults to notify mode when mode is not specified', () => {
    const config: GuardsConfig = {
      maxInputTokens: 10,
    };

    const result = checkGuards(config, {
      messages: makeMessages(100),
      model: 'gpt-4o',
      provider: 'openai',
      agentName: 'TestAgent',
    });

    expect(result.decision).toBe('notify');
  });
});

describe('NeuraMeterGuardError', () => {
  it('creates error with correct properties', () => {
    const error = new NeuraMeterGuardError(
      {
        ruleType: 'input_tokens',
        currentValue: 50000,
        threshold: 10000,
        isHard: true,
      },
      'Reduce input tokens',
    );

    expect(error.name).toBe('NeuraMeterGuardError');
    expect(error.rule).toBe('input_tokens');
    expect(error.current).toBe(50000);
    expect(error.threshold).toBe(10000);
    expect(error.suggestion).toBe('Reduce input tokens');
    expect(error.message).toContain('input_tokens');
    expect(error.message).toContain('50000');
    expect(error.message).toContain('10000');
  });

  it('is an instance of Error', () => {
    const error = new NeuraMeterGuardError(
      { ruleType: 'cost_per_call', currentValue: 1, threshold: 0.5, isHard: true },
      'Use cheaper model',
    );

    expect(error).toBeInstanceOf(Error);
  });
});
