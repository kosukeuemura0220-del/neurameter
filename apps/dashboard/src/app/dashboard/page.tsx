import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCost, formatNumber } from '@/lib/format';
import { CostChart } from '@/components/cost-chart';
import { AgentPieChart } from '@/components/agent-pie-chart';
import { ModelBarChart } from '@/components/model-bar-chart';
import { Progress } from '@/components/ui/progress';
import { CreateOrgForm } from '@/components/create-org-form';

export default async function DashboardPage() {
  const supabase = await createClient();

  // Get current user's org
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
        <h2 className="text-xl font-semibold">Welcome to NeuraMeter</h2>
        <p className="text-muted-foreground">
          No organization found. Create one to get started.
        </p>
        <CreateOrgForm />
      </div>
    );
  }

  // Current month date range
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Month total cost
  const { data: monthSummary } = await supabase
    .from('cost_summaries_hourly')
    .select('total_cost_microdollars')
    .eq('org_id', orgId)
    .gte('hour_bucket', monthStart);

  const monthTotal = monthSummary?.reduce(
    (sum, r) => sum + (r.total_cost_microdollars ?? 0),
    0,
  ) ?? 0;

  // Last month total
  const { data: lastMonthSummary } = await supabase
    .from('cost_summaries_hourly')
    .select('total_cost_microdollars')
    .eq('org_id', orgId)
    .gte('hour_bucket', lastMonthStart)
    .lte('hour_bucket', lastMonthEnd);

  const lastMonthTotal = lastMonthSummary?.reduce(
    (sum, r) => sum + (r.total_cost_microdollars ?? 0),
    0,
  ) ?? 0;

  const monthOverMonthPct =
    lastMonthTotal > 0
      ? ((monthTotal - lastMonthTotal) / lastMonthTotal) * 100
      : 0;

  // Today's cost
  const { data: todaySummary } = await supabase
    .from('cost_summaries_hourly')
    .select('total_cost_microdollars')
    .eq('org_id', orgId)
    .gte('hour_bucket', todayStart);

  const todayTotal = todaySummary?.reduce(
    (sum, r) => sum + (r.total_cost_microdollars ?? 0),
    0,
  ) ?? 0;

  // 7-day trend
  const { data: weekData } = await supabase
    .from('cost_summaries_hourly')
    .select('hour_bucket, total_cost_microdollars')
    .eq('org_id', orgId)
    .gte('hour_bucket', sevenDaysAgo)
    .order('hour_bucket', { ascending: true });

  // Aggregate by day
  const dailyMap = new Map<string, number>();
  weekData?.forEach((row) => {
    const day = new Date(row.hour_bucket).toISOString().slice(0, 10);
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + (row.total_cost_microdollars ?? 0));
  });
  const dailyTrend = Array.from(dailyMap.entries()).map(([date, cost]) => ({
    date,
    cost: cost / 1_000_000,
  }));

  // Agent breakdown
  const { data: agentData } = await supabase
    .from('cost_summaries_hourly')
    .select('agent_name, total_cost_microdollars, total_events')
    .eq('org_id', orgId)
    .gte('hour_bucket', monthStart);

  const agentMap = new Map<string, { cost: number; events: number }>();
  agentData?.forEach((row) => {
    const prev = agentMap.get(row.agent_name) ?? { cost: 0, events: 0 };
    agentMap.set(row.agent_name, {
      cost: prev.cost + (row.total_cost_microdollars ?? 0),
      events: prev.events + (row.total_events ?? 0),
    });
  });
  const agents = Array.from(agentMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.cost - a.cost);

  // Model breakdown
  const { data: modelData } = await supabase
    .from('cost_summaries_hourly')
    .select('model, total_cost_microdollars')
    .eq('org_id', orgId)
    .gte('hour_bucket', monthStart);

  const modelMap = new Map<string, number>();
  modelData?.forEach((row) => {
    modelMap.set(row.model, (modelMap.get(row.model) ?? 0) + (row.total_cost_microdollars ?? 0));
  });
  const models = Array.from(modelMap.entries())
    .map(([name, cost]) => ({ name, cost: cost / 1_000_000 }))
    .sort((a, b) => b.cost - a.cost);

  // Budget
  const { data: budgets } = await supabase
    .from('budgets')
    .select('*')
    .eq('org_id', orgId)
    .eq('period', 'monthly')
    .limit(1);

  const budget = budgets?.[0];
  const budgetPct = budget
    ? Math.min((monthTotal / budget.limit_microdollars) * 100, 100)
    : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCost(monthTotal)}</p>
            {lastMonthTotal > 0 && (
              <p
                className={`text-sm ${monthOverMonthPct >= 0 ? 'text-destructive' : 'text-emerald-400'}`}
              >
                {monthOverMonthPct >= 0 ? '+' : ''}
                {monthOverMonthPct.toFixed(1)}% vs last month
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCost(todayTotal)}</p>
            <p className="text-sm text-muted-foreground">
              {formatNumber(
                todaySummary?.reduce((s, r) => s + (r.total_cost_microdollars ?? 0), 0) ?? 0,
              )}{' '}
              events
            </p>
          </CardContent>
        </Card>

        {budgetPct !== null && budget && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Budget
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{budgetPct.toFixed(0)}%</p>
              <Progress value={budgetPct} className="mt-2" />
              <p className="mt-1 text-sm text-muted-foreground">
                {formatCost(monthTotal)} / {formatCost(budget.limit_microdollars)}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>7-Day Cost Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <CostChart data={dailyTrend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cost by Agent</CardTitle>
          </CardHeader>
          <CardContent>
            <AgentPieChart
              data={agents.map((a) => ({
                name: a.name,
                value: a.cost / 1_000_000,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cost by Model</CardTitle>
        </CardHeader>
        <CardContent>
          <ModelBarChart data={models} />
        </CardContent>
      </Card>

      {/* Agent table */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2">Agent</th>
                <th className="pb-2 text-right">Events</th>
                <th className="pb-2 text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.name} className="border-b">
                  <td className="py-2 font-medium">{agent.name}</td>
                  <td className="py-2 text-right">
                    {formatNumber(agent.events)}
                  </td>
                  <td className="py-2 text-right">
                    {formatCost(agent.cost)}
                  </td>
                </tr>
              ))}
              {agents.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-muted-foreground">
                    No data yet. Start sending events with the SDK.
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
