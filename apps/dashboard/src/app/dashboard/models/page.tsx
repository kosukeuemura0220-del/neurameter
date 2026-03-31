import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCost, formatNumber, formatLatency } from '@/lib/format';

export default async function ModelsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  const orgId = membership?.org_id;
  if (!orgId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-muted-foreground">No organization found.</p>
      </div>
    );
  }

  const monthStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  ).toISOString();

  // Get summary data grouped by model
  const { data: summaryData } = await supabase
    .from('cost_summaries_hourly')
    .select('model, provider, total_events, total_input_tokens, total_output_tokens, total_cost_microdollars, avg_latency_ms, avg_context_utilization, max_context_utilization')
    .eq('org_id', orgId)
    .gte('hour_bucket', monthStart);

  // Get model pricing
  const { data: pricingData } = await supabase
    .from('model_pricing')
    .select('provider, model, input_price_per_m_token, output_price_per_m_token, context_window_size, max_output_tokens');

  const pricingMap = new Map<string, { inputPrice: number; outputPrice: number; contextWindow: number | null; maxOutput: number | null }>();
  pricingData?.forEach((p) => {
    pricingMap.set(`${p.provider}:${p.model}`, {
      inputPrice: p.input_price_per_m_token,
      outputPrice: p.output_price_per_m_token,
      contextWindow: p.context_window_size,
      maxOutput: p.max_output_tokens,
    });
  });

  // Aggregate by model
  const modelMap = new Map<string, {
    provider: string;
    totalEvents: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCost: number;
    totalLatencyWeighted: number;
    avgContextUtil: number;
    maxContextUtil: number;
    rowCount: number;
  }>();

  summaryData?.forEach((row) => {
    const key = `${row.provider}:${row.model}`;
    const prev = modelMap.get(key) ?? {
      provider: row.provider,
      totalEvents: 0, totalInputTokens: 0, totalOutputTokens: 0,
      totalCost: 0, totalLatencyWeighted: 0, avgContextUtil: 0, maxContextUtil: 0, rowCount: 0,
    };
    const events = row.total_events ?? 0;
    modelMap.set(key, {
      provider: row.provider,
      totalEvents: prev.totalEvents + events,
      totalInputTokens: prev.totalInputTokens + (row.total_input_tokens ?? 0),
      totalOutputTokens: prev.totalOutputTokens + (row.total_output_tokens ?? 0),
      totalCost: prev.totalCost + (row.total_cost_microdollars ?? 0),
      totalLatencyWeighted: prev.totalLatencyWeighted + (row.avg_latency_ms ?? 0) * events,
      avgContextUtil: prev.avgContextUtil + Number(row.avg_context_utilization ?? 0) * events,
      maxContextUtil: Math.max(prev.maxContextUtil, Number(row.max_context_utilization ?? 0)),
      rowCount: prev.rowCount + events,
    });
  });

  const models = Array.from(modelMap.entries())
    .map(([key, data]) => {
      const model = key.split(':').slice(1).join(':');
      const pricing = pricingMap.get(key);
      return {
        model,
        provider: data.provider,
        totalEvents: data.totalEvents,
        totalInputTokens: data.totalInputTokens,
        totalOutputTokens: data.totalOutputTokens,
        totalCost: data.totalCost,
        avgLatency: data.rowCount > 0 ? Math.round(data.totalLatencyWeighted / data.rowCount) : 0,
        avgContextUtil: data.rowCount > 0 ? (data.avgContextUtil / data.rowCount) * 100 : 0,
        maxContextUtil: data.maxContextUtil * 100,
        contextWindow: pricing?.contextWindow ?? null,
        maxOutput: pricing?.maxOutput ?? null,
        inputPrice: pricing?.inputPrice ?? 0,
        outputPrice: pricing?.outputPrice ?? 0,
      };
    })
    .sort((a, b) => b.totalCost - a.totalCost);

  const totalCostAll = models.reduce((s, m) => s + m.totalCost, 0);
  const totalEventsAll = models.reduce((s, m) => s + m.totalEvents, 0);
  const totalTokensAll = models.reduce((s, m) => s + m.totalInputTokens + m.totalOutputTokens, 0);

  function providerColor(provider: string) {
    switch (provider) {
      case 'openai': return 'bg-green-100 text-green-800';
      case 'anthropic': return 'bg-orange-100 text-orange-800';
      case 'google': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Model Usage</h1>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Models Used (This Month)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{models.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Cost (This Month)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCost(totalCostAll)}</p>
            <p className="text-sm text-muted-foreground">
              {formatNumber(totalEventsAll)} calls
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Tokens (This Month)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatNumber(totalTokensAll)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Model Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Model Comparison</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2">Model</th>
                <th className="pb-2">Provider</th>
                <th className="pb-2 text-right">Calls</th>
                <th className="pb-2 text-right">Input Tokens</th>
                <th className="pb-2 text-right">Output Tokens</th>
                <th className="pb-2 text-right">Cost</th>
                <th className="pb-2 text-right">Cost/Call</th>
                <th className="pb-2 text-right">Avg Latency</th>
                <th className="pb-2 text-right">Avg Context</th>
                <th className="pb-2 text-right">Context Window</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => {
                const costPerCall = m.totalEvents > 0 ? m.totalCost / m.totalEvents : 0;
                return (
                  <tr key={`${m.provider}:${m.model}`} className="border-b">
                    <td className="py-2 font-medium">{m.model}</td>
                    <td className="py-2">
                      <Badge className={providerColor(m.provider)}>{m.provider}</Badge>
                    </td>
                    <td className="py-2 text-right">{formatNumber(m.totalEvents)}</td>
                    <td className="py-2 text-right">{formatNumber(m.totalInputTokens)}</td>
                    <td className="py-2 text-right">{formatNumber(m.totalOutputTokens)}</td>
                    <td className="py-2 text-right font-medium">{formatCost(m.totalCost)}</td>
                    <td className="py-2 text-right">{formatCost(costPerCall)}</td>
                    <td className="py-2 text-right">{formatLatency(m.avgLatency)}</td>
                    <td className="py-2 text-right">
                      {m.avgContextUtil > 0 ? `${m.avgContextUtil.toFixed(1)}%` : '-'}
                    </td>
                    <td className="py-2 text-right">
                      {m.contextWindow ? formatNumber(m.contextWindow) : '-'}
                    </td>
                  </tr>
                );
              })}
              {models.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-muted-foreground">
                    No model usage data yet. Start sending events with the SDK.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Pricing Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing Reference</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2">Model</th>
                <th className="pb-2">Provider</th>
                <th className="pb-2 text-right">Input $/1M tokens</th>
                <th className="pb-2 text-right">Output $/1M tokens</th>
                <th className="pb-2 text-right">Context Window</th>
                <th className="pb-2 text-right">Max Output</th>
              </tr>
            </thead>
            <tbody>
              {pricingData?.map((p) => (
                <tr key={`${p.provider}:${p.model}`} className="border-b">
                  <td className="py-2 font-medium">{p.model}</td>
                  <td className="py-2">
                    <Badge className={providerColor(p.provider)}>{p.provider}</Badge>
                  </td>
                  <td className="py-2 text-right">
                    ${(p.input_price_per_m_token / 1_000_000).toFixed(2)}
                  </td>
                  <td className="py-2 text-right">
                    ${(p.output_price_per_m_token / 1_000_000).toFixed(2)}
                  </td>
                  <td className="py-2 text-right">
                    {p.context_window_size ? formatNumber(p.context_window_size) : '-'}
                  </td>
                  <td className="py-2 text-right">
                    {p.max_output_tokens ? formatNumber(p.max_output_tokens) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
