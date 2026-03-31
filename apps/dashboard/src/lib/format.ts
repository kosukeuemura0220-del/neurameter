/** Convert microdollars (integer) to formatted dollar string */
export function formatCost(microdollars: number): string {
  const dollars = microdollars / 1_000_000;
  if (dollars >= 1) {
    return `$${dollars.toFixed(2)}`;
  }
  if (dollars >= 0.01) {
    return `$${dollars.toFixed(3)}`;
  }
  return `$${dollars.toFixed(4)}`;
}

/** Format large numbers with commas */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/** Format percentage */
export function formatPercent(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${((value / total) * 100).toFixed(1)}%`;
}

/** Format latency */
export function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
