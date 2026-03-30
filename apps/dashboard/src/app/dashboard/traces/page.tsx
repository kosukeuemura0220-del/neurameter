import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCost, formatLatency } from '@/lib/format';
import Link from 'next/link';

export default async function TracesPage() {
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

  // Get recent unique traces (last 100)
  const { data: events } = await supabase
    .from('cost_events')
    .select('trace_id, agent_name, event_timestamp, cost_microdollars, latency_ms')
    .eq('org_id', membership.org_id)
    .order('event_timestamp', { ascending: false })
    .limit(500);

  // Aggregate by trace
  const traceMap = new Map<
    string,
    { agents: Set<string>; totalCost: number; totalLatency: number; spans: number; timestamp: string }
  >();
  events?.forEach((e) => {
    const prev = traceMap.get(e.trace_id) ?? {
      agents: new Set<string>(),
      totalCost: 0,
      totalLatency: 0,
      spans: 0,
      timestamp: e.event_timestamp,
    };
    prev.agents.add(e.agent_name);
    prev.totalCost += e.cost_microdollars ?? 0;
    prev.totalLatency += e.latency_ms ?? 0;
    prev.spans += 1;
    if (e.event_timestamp < prev.timestamp) prev.timestamp = e.event_timestamp;
    traceMap.set(e.trace_id, prev);
  });

  const traces = Array.from(traceMap.entries())
    .map(([id, d]) => ({
      id,
      agents: Array.from(d.agents),
      totalCost: d.totalCost,
      totalLatency: d.totalLatency,
      spans: d.spans,
      timestamp: d.timestamp,
    }))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 100);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Traces</h1>
      <Card>
        <CardHeader>
          <CardTitle>Recent Traces</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2">Trace ID</th>
                <th className="pb-2">Agents</th>
                <th className="pb-2 text-right">Spans</th>
                <th className="pb-2 text-right">Total Latency</th>
                <th className="pb-2 text-right">Cost</th>
                <th className="pb-2 text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {traces.map((trace) => (
                <tr key={trace.id} className="border-b hover:bg-muted/50">
                  <td className="py-2">
                    <Link
                      href={`/dashboard/traces/${trace.id}`}
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {trace.id.slice(0, 8)}...
                    </Link>
                  </td>
                  <td className="py-2">
                    {trace.agents.map((a) => (
                      <span
                        key={a}
                        className="mr-1 inline-block rounded bg-muted px-1.5 py-0.5 text-xs"
                      >
                        {a}
                      </span>
                    ))}
                  </td>
                  <td className="py-2 text-right">{trace.spans}</td>
                  <td className="py-2 text-right">{formatLatency(trace.totalLatency)}</td>
                  <td className="py-2 text-right font-medium">{formatCost(trace.totalCost)}</td>
                  <td className="py-2 text-right text-muted-foreground">
                    {new Date(trace.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
              {traces.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No traces yet.
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
