/**
 * Basic anomaly detection for cost spikes.
 *
 * Compares recent metrics against historical baselines using
 * simple statistical methods (mean + standard deviation).
 */

export interface AnomalyResult {
  isAnomaly: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  description: string;
  currentValue: number;
  baselineValue: number;
  deviationFactor: number;
}

interface DataPoint {
  value: number;
  timestamp: string;
}

/**
 * Detect anomalies using z-score method.
 * An anomaly is detected when the current value deviates
 * significantly from the historical mean.
 */
export function detectAnomalies(
  current: DataPoint,
  history: DataPoint[],
  label: string,
): AnomalyResult | null {
  if (history.length < 3) return null; // Need minimum history

  const values = history.map((d) => d.value);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return null; // No variation

  const zScore = (current.value - mean) / stdDev;

  if (zScore < 2) return null; // Within normal range

  const severity: AnomalyResult['severity'] =
    zScore >= 4 ? 'critical' :
    zScore >= 3 ? 'high' :
    zScore >= 2.5 ? 'medium' : 'low';

  return {
    isAnomaly: true,
    severity,
    type: label,
    description: `${label} is ${zScore.toFixed(1)}x standard deviations above normal`,
    currentValue: current.value,
    baselineValue: mean,
    deviationFactor: zScore,
  };
}

/**
 * Run anomaly detection on hourly cost summaries.
 * Returns a list of detected anomalies.
 */
export function detectCostAnomalies(
  summaries: Array<{
    hour: string;
    agent_name: string;
    total_cost_microdollars: number;
    call_count: number;
    avg_context_utilization?: number;
  }>,
): AnomalyResult[] {
  const anomalies: AnomalyResult[] = [];

  // Group by agent
  const byAgent = new Map<string, typeof summaries>();
  for (const s of summaries) {
    const arr = byAgent.get(s.agent_name) ?? [];
    arr.push(s);
    byAgent.set(s.agent_name, arr);
  }

  for (const [agentName, agentSummaries] of byAgent) {
    if (agentSummaries.length < 4) continue;

    // Sort by hour
    const sorted = [...agentSummaries].sort(
      (a, b) => new Date(a.hour).getTime() - new Date(b.hour).getTime(),
    );

    const latest = sorted[sorted.length - 1]!;
    const history = sorted.slice(0, -1);

    // Check cost spike
    const costAnomaly = detectAnomalies(
      { value: latest.total_cost_microdollars / 1_000_000, timestamp: latest.hour },
      history.map((h) => ({ value: h.total_cost_microdollars / 1_000_000, timestamp: h.hour })),
      `${agentName} hourly cost`,
    );
    if (costAnomaly) anomalies.push(costAnomaly);

    // Check call count spike
    const callAnomaly = detectAnomalies(
      { value: latest.call_count, timestamp: latest.hour },
      history.map((h) => ({ value: h.call_count, timestamp: h.hour })),
      `${agentName} call count`,
    );
    if (callAnomaly) anomalies.push(callAnomaly);

    // Check context utilization spike
    if (latest.avg_context_utilization != null) {
      const ctxHistory = history.filter((h) => h.avg_context_utilization != null);
      if (ctxHistory.length >= 3) {
        const ctxAnomaly = detectAnomalies(
          { value: Number(latest.avg_context_utilization), timestamp: latest.hour },
          ctxHistory.map((h) => ({ value: Number(h.avg_context_utilization), timestamp: h.hour })),
          `${agentName} context utilization`,
        );
        if (ctxAnomaly) anomalies.push(ctxAnomaly);
      }
    }
  }

  return anomalies.sort((a, b) => b.deviationFactor - a.deviationFactor);
}
