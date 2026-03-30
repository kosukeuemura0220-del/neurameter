import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCost, formatNumber } from '@/lib/format';

interface AlertItem {
  id: string;
  type: 'guard' | 'budget';
  timestamp: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  metadata: Record<string, unknown>;
}

export default async function AlertsPage() {
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

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Get guard events (block/notify)
  const { data: guardEvents } = await supabase
    .from('guard_events')
    .select('*')
    .eq('org_id', orgId)
    .gte('event_timestamp', thirtyDaysAgo)
    .order('event_timestamp', { ascending: false })
    .limit(100);

  // Get budgets and check for threshold breaches
  const { data: budgets } = await supabase
    .from('budgets')
    .select('*')
    .eq('org_id', orgId);

  const monthStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  ).toISOString();

  const { data: summaryData } = await supabase
    .from('cost_summaries_hourly')
    .select('agent_name, customer_id, total_cost_microdollars')
    .eq('org_id', orgId)
    .gte('hour_bucket', monthStart);

  // Calculate spend for budget alerts
  let orgSpend = 0;
  const agentSpend = new Map<string, number>();
  const customerSpend = new Map<string, number>();
  summaryData?.forEach((row) => {
    const cost = row.total_cost_microdollars ?? 0;
    orgSpend += cost;
    if (row.agent_name) {
      agentSpend.set(row.agent_name, (agentSpend.get(row.agent_name) ?? 0) + cost);
    }
    if (row.customer_id) {
      customerSpend.set(row.customer_id, (customerSpend.get(row.customer_id) ?? 0) + cost);
    }
  });

  // Build unified alert list
  const alerts: AlertItem[] = [];

  // Guard event alerts
  guardEvents?.forEach((event) => {
    const rules = Array.isArray(event.triggered_rules) ? event.triggered_rules : [];
    const ruleNames = rules.map((r: Record<string, unknown>) => String(r.ruleType ?? r.rule_type ?? 'unknown')).join(', ');

    alerts.push({
      id: `guard-${event.id}`,
      type: 'guard',
      timestamp: event.event_timestamp,
      title: `Guard ${event.decision}: ${event.agent_name}`,
      description: event.suggestion ?? `Triggered rules: ${ruleNames}`,
      severity: event.decision === 'block' ? 'critical' : 'warning',
      metadata: { guardMode: event.guard_mode, decision: event.decision, rules },
    });
  });

  // Budget alerts
  budgets?.forEach((budget) => {
    const limitAmount = budget.limit_microdollars ?? budget.amount_microdollars;
    let spend = 0;
    if (budget.scope_type === 'org') spend = orgSpend;
    else if (budget.scope_type === 'agent') spend = agentSpend.get(budget.scope_id) ?? 0;
    else if (budget.scope_type === 'customer') spend = customerSpend.get(budget.scope_id) ?? 0;

    const pct = limitAmount > 0 ? spend / limitAmount : 0;
    const threshold = budget.alert_threshold ?? 0.8;

    if (pct >= 1) {
      alerts.push({
        id: `budget-over-${budget.id}`,
        type: 'budget',
        timestamp: new Date().toISOString(),
        title: `Budget exceeded: ${budget.scope_type === 'org' ? 'Organization' : `${budget.scope_type} ${budget.scope_id}`}`,
        description: `Spending ${formatCost(spend)} exceeds budget of ${formatCost(limitAmount)} (${(pct * 100).toFixed(0)}%)`,
        severity: 'critical',
        metadata: { spend, limit: limitAmount, pct },
      });
    } else if (pct >= threshold) {
      alerts.push({
        id: `budget-warn-${budget.id}`,
        type: 'budget',
        timestamp: new Date().toISOString(),
        title: `Budget warning: ${budget.scope_type === 'org' ? 'Organization' : `${budget.scope_type} ${budget.scope_id}`}`,
        description: `Spending ${formatCost(spend)} is at ${(pct * 100).toFixed(0)}% of ${formatCost(limitAmount)} budget (threshold: ${(threshold * 100).toFixed(0)}%)`,
        severity: 'warning',
        metadata: { spend, limit: limitAmount, pct },
      });
    }
  });

  // Sort by timestamp descending
  alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const warningCount = alerts.filter((a) => a.severity === 'warning').length;

  function severityBadge(severity: string) {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'warning':
        return <Badge className="bg-amber-100 text-amber-800">Warning</Badge>;
      default:
        return <Badge variant="secondary">Info</Badge>;
    }
  }

  function typeBadge(type: string) {
    switch (type) {
      case 'guard':
        return <Badge variant="outline">Guard</Badge>;
      case 'budget':
        return <Badge variant="outline">Budget</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Alerts</h1>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatNumber(alerts.length)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Critical
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive">{formatNumber(criticalCount)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-600">{formatNumber(warningCount)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Alert List */}
      <Card>
        <CardHeader>
          <CardTitle>Alert History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.id} className="flex items-start gap-4 rounded-lg border p-4">
                <div className="flex flex-col gap-1">
                  {severityBadge(alert.severity)}
                  {typeBadge(alert.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{alert.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
                </div>
                <p className="whitespace-nowrap text-sm text-muted-foreground">
                  {new Date(alert.timestamp).toLocaleString()}
                </p>
              </div>
            ))}
            {alerts.length === 0 && (
              <p className="py-8 text-center text-muted-foreground">
                No alerts. Configure budgets or guards to receive alerts.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
