import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCost, formatNumber } from '@/lib/format';
import { CostChart } from '@/components/cost-chart';
import { ModelBarChart } from '@/components/model-bar-chart';

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const agentName = decodeURIComponent(name);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (!membership) return null;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Time series
  const { data: timeData } = await supabase
    .from('cost_summaries_hourly')
    .select('hour_bucket, total_cost_microdollars')
    .eq('org_id', membership.org_id)
    .eq('agent_name', agentName)
    .gte('hour_bucket', sevenDaysAgo)
    .order('hour_bucket', { ascending: true });

  const dailyMap = new Map<string, number>();
  timeData?.forEach((row) => {
    const day = new Date(row.hour_bucket).toISOString().slice(0, 10);
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + (row.total_cost_microdollars ?? 0));
  });
  const dailyTrend = Array.from(dailyMap.entries()).map(([date, cost]) => ({
    date,
    cost: cost / 1_000_000,
  }));

  // Model breakdown
  const monthStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  ).toISOString();

  const { data: modelData } = await supabase
    .from('cost_summaries_hourly')
    .select('model, total_cost_microdollars, total_events')
    .eq('org_id', membership.org_id)
    .eq('agent_name', agentName)
    .gte('hour_bucket', monthStart);

  const modelMap = new Map<string, { cost: number; events: number }>();
  modelData?.forEach((row) => {
    const prev = modelMap.get(row.model) ?? { cost: 0, events: 0 };
    modelMap.set(row.model, {
      cost: prev.cost + (row.total_cost_microdollars ?? 0),
      events: prev.events + (row.total_events ?? 0),
    });
  });

  const models = Array.from(modelMap.entries())
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.cost - a.cost);

  const totalCost = models.reduce((s, m) => s + m.cost, 0);
  const totalEvents = models.reduce((s, m) => s + m.events, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{agentName}</h1>
        <p className="text-muted-foreground">
          {formatNumber(totalEvents)} events | {formatCost(totalCost)} this month
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>7-Day Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <CostChart data={dailyTrend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Model Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ModelBarChart
              data={models.map((m) => ({
                name: m.name,
                cost: m.cost / 1_000_000,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Models Used</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2">Model</th>
                <th className="pb-2 text-right">Events</th>
                <th className="pb-2 text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {models.map((model) => (
                <tr key={model.name} className="border-b">
                  <td className="py-2 font-medium">{model.name}</td>
                  <td className="py-2 text-right">{formatNumber(model.events)}</td>
                  <td className="py-2 text-right">{formatCost(model.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
