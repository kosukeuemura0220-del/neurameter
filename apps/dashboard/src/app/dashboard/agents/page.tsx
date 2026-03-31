import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCost, formatNumber, formatLatency } from '@/lib/format';
import Link from 'next/link';

export default async function AgentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (!membership) return <p>No organization found.</p>;

  const monthStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  ).toISOString();

  const { data } = await supabase
    .from('cost_summaries_hourly')
    .select('agent_name, total_cost_microdollars, total_events, avg_latency_ms, total_input_tokens, total_output_tokens')
    .eq('org_id', membership.org_id)
    .gte('hour_bucket', monthStart);

  // Aggregate by agent
  const agentMap = new Map<
    string,
    { cost: number; events: number; latencySum: number; inputTokens: number; outputTokens: number }
  >();
  data?.forEach((row) => {
    const prev = agentMap.get(row.agent_name) ?? {
      cost: 0, events: 0, latencySum: 0, inputTokens: 0, outputTokens: 0,
    };
    agentMap.set(row.agent_name, {
      cost: prev.cost + (row.total_cost_microdollars ?? 0),
      events: prev.events + (row.total_events ?? 0),
      latencySum: prev.latencySum + (row.avg_latency_ms ?? 0) * (row.total_events ?? 0),
      inputTokens: prev.inputTokens + Number(row.total_input_tokens ?? 0),
      outputTokens: prev.outputTokens + Number(row.total_output_tokens ?? 0),
    });
  });

  const agents = Array.from(agentMap.entries())
    .map(([name, d]) => ({
      name,
      ...d,
      avgLatency: d.events > 0 ? Math.round(d.latencySum / d.events) : 0,
    }))
    .sort((a, b) => b.cost - a.cost);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Agents</h1>
      <Card>
        <CardHeader>
          <CardTitle>Agent Cost (This Month)</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2">Agent</th>
                <th className="pb-2 text-right">Events</th>
                <th className="pb-2 text-right">Input Tokens</th>
                <th className="pb-2 text-right">Output Tokens</th>
                <th className="pb-2 text-right">Avg Latency</th>
                <th className="pb-2 text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.name} className="border-b hover:bg-muted/50">
                  <td className="py-2">
                    <Link
                      href={`/dashboard/agents/${encodeURIComponent(agent.name)}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {agent.name}
                    </Link>
                  </td>
                  <td className="py-2 text-right">{formatNumber(agent.events)}</td>
                  <td className="py-2 text-right">{formatNumber(agent.inputTokens)}</td>
                  <td className="py-2 text-right">{formatNumber(agent.outputTokens)}</td>
                  <td className="py-2 text-right">{formatLatency(agent.avgLatency)}</td>
                  <td className="py-2 text-right font-medium">{formatCost(agent.cost)}</td>
                </tr>
              ))}
              {agents.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No agent data yet.
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
