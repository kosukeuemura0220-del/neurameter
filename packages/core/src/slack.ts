/**
 * Slack notification utility for NeuraMeter guard alerts.
 * Sends Block Kit formatted messages via incoming webhooks.
 */

export interface SlackMessage {
  /** Plain text fallback */
  text: string;
  /** Name of the agent that triggered the guard */
  agentName: string;
  /** Type of guard rule triggered (e.g. 'context_utilization', 'input_tokens') */
  ruleType: string;
  /** Current value that exceeded the threshold */
  currentValue: number;
  /** Configured threshold that was exceeded */
  threshold: number;
  /** Optimization suggestion from the guard system */
  suggestion?: string;
}

/**
 * Format a value for display based on the rule type.
 */
function formatValue(ruleType: string, value: number): string {
  switch (ruleType) {
    case 'context_utilization':
      return `${value.toFixed(1)}%`;
    case 'cost_per_call':
    case 'cost_per_hour':
    case 'budget':
      return `$${value.toFixed(4)}`;
    case 'input_tokens':
      return value.toLocaleString();
    default:
      return String(value);
  }
}

/**
 * Format a rule type string for human-readable display.
 */
function formatRuleType(ruleType: string): string {
  return ruleType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Build a Slack Block Kit payload for a guard alert.
 */
function buildSlackPayload(message: SlackMessage): object {
  const blocks: object[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `:warning: NeuraMeter Guard Alert`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Agent:*\n${message.agentName}`,
        },
        {
          type: 'mrkdwn',
          text: `*Rule Triggered:*\n${formatRuleType(message.ruleType)}`,
        },
        {
          type: 'mrkdwn',
          text: `*Current Value:*\n${formatValue(message.ruleType, message.currentValue)}`,
        },
        {
          type: 'mrkdwn',
          text: `*Threshold:*\n${formatValue(message.ruleType, message.threshold)}`,
        },
      ],
    },
  ];

  if (message.suggestion) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Suggestion:*\n${message.suggestion}`,
      },
    });
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Sent by NeuraMeter at ${new Date().toISOString()}`,
      },
    ],
  });

  return {
    text: message.text,
    blocks,
  };
}

/**
 * Send a Slack notification via an incoming webhook.
 * Fire-and-forget: errors are silently caught and do not propagate.
 *
 * @param webhookUrl - Slack incoming webhook URL
 * @param message - Structured alert message
 */
export async function sendSlackNotification(
  webhookUrl: string,
  message: SlackMessage,
): Promise<void> {
  try {
    const payload = buildSlackPayload(message);
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Fire-and-forget: silently ignore errors
  }
}
