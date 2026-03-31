import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCost, formatNumber } from '@/lib/format';

export default async function CustomersPage() {
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

  // Get summary data grouped by customer
  const { data: summaryData } = await supabase
    .from('cost_summaries_hourly')
    .select('customer_id, agent_name, model, total_events, total_input_tokens, total_output_tokens, total_cost_microdollars, avg_latency_ms')
    .eq('org_id', orgId)
    .gte('hour_bucket', monthStart);

  // Aggregate by customer
  const customerMap = new Map<string, {
    totalEvents: number;
    totalCost: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    agents: Set<string>;
    models: Set<string>;
    latencyWeighted: number;
    rowCount: number;
  }>();

  summaryData?.forEach((row) => {
    const custId = row.customer_id || '(no customer)';
    const prev = customerMap.get(custId) ?? {
      totalEvents: 0, totalCost: 0, totalInputTokens: 0, totalOutputTokens: 0,
      agents: new Set(), models: new Set(), latencyWeighted: 0, rowCount: 0,
    };
    const events = row.total_events ?? 0;
    prev.totalEvents += events;
    prev.totalCost += row.total_cost_microdollars ?? 0;
    prev.totalInputTokens += row.total_input_tokens ?? 0;
    prev.totalOutputTokens += row.total_output_tokens ?? 0;
    prev.agents.add(row.agent_name);
    prev.models.add(row.model);
    prev.latencyWeighted += (row.avg_latency_ms ?? 0) * events;
    prev.rowCount += events;
    customerMap.set(custId, prev);
  });

  const customers = Array.from(customerMap.entries())
    .filter(([id]) => id !== '(no customer)')
    .map(([id, data]) => ({
      id,
      totalEvents: data.totalEvents,
      totalCost: data.totalCost,
      totalInputTokens: data.totalInputTokens,
      totalOutputTokens: data.totalOutputTokens,
      agentCount: data.agents.size,
      topAgent: [...data.agents][0] ?? '-',
      modelCount: data.models.size,
      topModel: [...data.models][0] ?? '-',
      avgLatency: data.rowCount > 0 ? Math.round(data.latencyWeighted / data.rowCount) : 0,
      costPerEvent: data.totalEvents > 0 ? data.totalCost / data.totalEvents : 0,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);

  const totalCostAll = customers.reduce((s, c) => s + c.totalCost, 0);
  const totalEventsAll = customers.reduce((s, c) => s + c.totalEvents, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Customer Costs</h1>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Customers (This Month)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{customers.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Customer Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCost(totalCostAll)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Cost per Customer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {customers.length > 0 ? formatCost(Math.round(totalCostAll / customers.length)) : '$0'}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatNumber(totalEventsAll)} total events
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Customer Table */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2">Customer ID</th>
                <th className="pb-2 text-right">Events</th>
                <th className="pb-2 text-right">Total Cost</th>
                <th className="pb-2 text-right">Cost/Event</th>
                <th className="pb-2 text-right">Input Tokens</th>
                <th className="pb-2 text-right">Output Tokens</th>
                <th className="pb-2">Top Agent</th>
                <th className="pb-2">Top Model</th>
                <th className="pb-2 text-right">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="py-2 font-medium font-mono text-sm">{c.id}</td>
                  <td className="py-2 text-right">{formatNumber(c.totalEvents)}</td>
                  <td className="py-2 text-right font-medium">{formatCost(c.totalCost)}</td>
                  <td className="py-2 text-right">{formatCost(c.costPerEvent)}</td>
                  <td className="py-2 text-right">{formatNumber(c.totalInputTokens)}</td>
                  <td className="py-2 text-right">{formatNumber(c.totalOutputTokens)}</td>
                  <td className="py-2">
                    <Badge variant="secondary">{c.topAgent}</Badge>
                    {c.agentCount > 1 && (
                      <span className="ml-1 text-xs text-muted-foreground">+{c.agentCount - 1}</span>
                    )}
                  </td>
                  <td className="py-2">
                    <Badge variant="outline">{c.topModel}</Badge>
                    {c.modelCount > 1 && (
                      <span className="ml-1 text-xs text-muted-foreground">+{c.modelCount - 1}</span>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    {totalCostAll > 0 ? ((c.totalCost / totalCostAll) * 100).toFixed(1) : '0'}%
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    No customer cost data yet. Pass customerId when using the SDK.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
