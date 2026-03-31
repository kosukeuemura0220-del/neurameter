'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { formatNumber } from '@/lib/format';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  Legend,
  ZAxis,
} from 'recharts';

interface ContextEvent {
  agent_name: string;
  model: string;
  context_utilization: number | null;
  model_context_limit: number | null;
  message_count: number | null;
  system_prompt_tokens: number | null;
  conversation_tokens: number | null;
  tool_result_tokens: number | null;
  input_tokens: number | null;
  cost_microdollars: number | null;
  event_timestamp: string;
}

interface AgentContext {
  name: string;
  avgUtilization: number;
  maxUtilization: number;
  count: number;
  avgSystemTokens: number;
  avgConversationTokens: number;
  avgToolTokens: number;
  avgInputTokens: number;
}

const CHART_COLORS = {
  system: 'hsl(220, 70%, 50%)',
  conversation: 'hsl(160, 60%, 45%)',
  toolResult: 'hsl(30, 80%, 55%)',
  utilization: 'hsl(280, 60%, 55%)',
  scatter: 'hsl(190, 70%, 45%)',
  reference80: 'hsl(30, 80%, 55%)',
  reference95: 'hsl(0, 65%, 50%)',
};

export default function ContextPage() {
  const [contextEvents, setContextEvents] = useState<ContextEvent[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: membership } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      const orgId = membership?.org_id;
      if (!orgId) {
        setLoading(false);
        return;
      }

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data } = await supabase
        .from('cost_events')
        .select('agent_name, model, context_utilization, model_context_limit, message_count, system_prompt_tokens, conversation_tokens, tool_result_tokens, input_tokens, cost_microdollars, event_timestamp')
        .eq('org_id', orgId)
        .gte('event_timestamp', sevenDaysAgo)
        .not('context_utilization', 'is', null)
        .order('event_timestamp', { ascending: false })
        .limit(500);

      setContextEvents(data as ContextEvent[] | null);
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading context analysis...</p>
      </div>
    );
  }

  if (!contextEvents) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-muted-foreground">No organization found.</p>
      </div>
    );
  }

  // Aggregate by agent
  const agentContextMap = new Map<string, {
    totalUtilization: number;
    maxUtilization: number;
    count: number;
    totalSystemTokens: number;
    totalConversationTokens: number;
    totalToolTokens: number;
    totalInputTokens: number;
  }>();

  contextEvents.forEach((e) => {
    const prev = agentContextMap.get(e.agent_name) ?? {
      totalUtilization: 0, maxUtilization: 0, count: 0,
      totalSystemTokens: 0, totalConversationTokens: 0, totalToolTokens: 0, totalInputTokens: 0,
    };
    const util = Number(e.context_utilization ?? 0);
    agentContextMap.set(e.agent_name, {
      totalUtilization: prev.totalUtilization + util,
      maxUtilization: Math.max(prev.maxUtilization, util),
      count: prev.count + 1,
      totalSystemTokens: prev.totalSystemTokens + (e.system_prompt_tokens ?? 0),
      totalConversationTokens: prev.totalConversationTokens + (e.conversation_tokens ?? 0),
      totalToolTokens: prev.totalToolTokens + (e.tool_result_tokens ?? 0),
      totalInputTokens: prev.totalInputTokens + (e.input_tokens ?? 0),
    });
  });

  const agentContext: AgentContext[] = Array.from(agentContextMap.entries())
    .map(([name, data]) => ({
      name,
      avgUtilization: data.count > 0 ? (data.totalUtilization / data.count) * 100 : 0,
      maxUtilization: data.maxUtilization * 100,
      count: data.count,
      avgSystemTokens: data.count > 0 ? Math.round(data.totalSystemTokens / data.count) : 0,
      avgConversationTokens: data.count > 0 ? Math.round(data.totalConversationTokens / data.count) : 0,
      avgToolTokens: data.count > 0 ? Math.round(data.totalToolTokens / data.count) : 0,
      avgInputTokens: data.count > 0 ? Math.round(data.totalInputTokens / data.count) : 0,
    }))
    .sort((a, b) => b.avgUtilization - a.avgUtilization);

  // Overall stats
  const totalEvents = contextEvents.length;
  const avgUtilAll = totalEvents > 0
    ? (contextEvents.reduce((s, e) => s + Number(e.context_utilization ?? 0), 0) / totalEvents) * 100
    : 0;
  const maxUtilAll = totalEvents > 0
    ? Math.max(...contextEvents.map((e) => Number(e.context_utilization ?? 0))) * 100
    : 0;
  const highUtilCount = contextEvents.filter((e) => Number(e.context_utilization ?? 0) > 0.8).length;

  // --- Chart data ---

  // 1. Utilization bar chart data (horizontal bars, avg utilization by agent)
  const utilizationBarData = agentContext.map((a) => ({
    name: a.name,
    avgUtilization: Math.round(a.avgUtilization * 10) / 10,
  }));

  // 2. Context composition stacked bar chart data
  const compositionBarData = agentContext.map((a) => ({
    name: a.name,
    system: a.avgSystemTokens,
    conversation: a.avgConversationTokens,
    toolResult: a.avgToolTokens,
  }));

  // 3. Time series line chart data (utilization over time, grouped by day)
  const timeSeriesMap = new Map<string, { totalUtil: number; count: number }>();
  contextEvents.forEach((e) => {
    const day = e.event_timestamp.slice(0, 10); // YYYY-MM-DD
    const prev = timeSeriesMap.get(day) ?? { totalUtil: 0, count: 0 };
    timeSeriesMap.set(day, {
      totalUtil: prev.totalUtil + Number(e.context_utilization ?? 0) * 100,
      count: prev.count + 1,
    });
  });
  const timeSeriesData = Array.from(timeSeriesMap.entries())
    .map(([date, data]) => ({
      date,
      avgUtilization: Math.round((data.totalUtil / data.count) * 10) / 10,
      calls: data.count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 4. Scatter plot data (cost vs utilization, each dot = one API call)
  const scatterData = contextEvents
    .filter((e) => e.cost_microdollars != null && e.context_utilization != null)
    .map((e) => ({
      utilization: Math.round(Number(e.context_utilization ?? 0) * 1000) / 10,
      cost: (e.cost_microdollars ?? 0) / 1_000_000,
      agent: e.agent_name,
      model: e.model,
    }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Context Window Analysis</h1>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Utilization (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{avgUtilAll.toFixed(1)}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Max Utilization (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{maxUtilAll.toFixed(1)}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              High Util Calls (&gt;80%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatNumber(highUtilCount)}</p>
            <p className="text-sm text-muted-foreground">
              of {formatNumber(totalEvents)} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Agents Tracked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{agentContext.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 1: Utilization bar + Context composition */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* 1. Utilization Bar Chart by Agent */}
        <Card>
          <CardHeader>
            <CardTitle>Avg Utilization by Agent</CardTitle>
          </CardHeader>
          <CardContent>
            {utilizationBarData.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-muted-foreground">
                No utilization data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, utilizationBarData.length * 40 + 40)}>
                <BarChart data={utilizationBarData} layout="vertical" margin={{ left: 80, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(v: number) => `${v}%`}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                  <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, 'Avg Utilization']} />
                  <ReferenceLine x={80} stroke={CHART_COLORS.reference80} strokeDasharray="4 4" label={{ value: '80%', position: 'top', fontSize: 11, fill: CHART_COLORS.reference80 }} />
                  <ReferenceLine x={95} stroke={CHART_COLORS.reference95} strokeDasharray="4 4" label={{ value: '95%', position: 'top', fontSize: 11, fill: CHART_COLORS.reference95 }} />
                  <Bar dataKey="avgUtilization" fill={CHART_COLORS.utilization} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 2. Context Composition Stacked Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Context Composition by Agent</CardTitle>
          </CardHeader>
          <CardContent>
            {compositionBarData.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-muted-foreground">
                No composition data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, compositionBarData.length * 40 + 40)}>
                <BarChart data={compositionBarData} layout="vertical" margin={{ left: 80, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    type="number"
                    tickFormatter={(v: number) => formatNumber(v)}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                  <Tooltip formatter={(value: number) => [formatNumber(value), undefined]} />
                  <Legend />
                  <Bar dataKey="system" name="System Tokens" stackId="tokens" fill={CHART_COLORS.system} />
                  <Bar dataKey="conversation" name="Conversation Tokens" stackId="tokens" fill={CHART_COLORS.conversation} />
                  <Bar dataKey="toolResult" name="Tool Result Tokens" stackId="tokens" fill={CHART_COLORS.toolResult} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2: Time series + Scatter plot */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* 3. Time Series Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Utilization Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {timeSeriesData.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-muted-foreground">
                No time series data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v: number) => `${v}%`}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === 'avgUtilization') return [`${value.toFixed(1)}%`, 'Avg Utilization'];
                      return [value, name];
                    }}
                    labelFormatter={(label: string) => label}
                  />
                  <ReferenceLine y={80} stroke={CHART_COLORS.reference80} strokeDasharray="4 4" />
                  <ReferenceLine y={95} stroke={CHART_COLORS.reference95} strokeDasharray="4 4" />
                  <Line
                    type="monotone"
                    dataKey="avgUtilization"
                    stroke={CHART_COLORS.utilization}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="avgUtilization"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 4. Scatter Plot: Cost vs Utilization */}
        <Card>
          <CardHeader>
            <CardTitle>Cost vs Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            {scatterData.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-muted-foreground">
                No scatter data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart margin={{ bottom: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    type="number"
                    dataKey="utilization"
                    name="Utilization"
                    domain={[0, 100]}
                    tickFormatter={(v: number) => `${v}%`}
                    tick={{ fontSize: 12 }}
                    label={{ value: 'Utilization %', position: 'insideBottom', offset: -5, fontSize: 12 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="cost"
                    name="Cost"
                    tickFormatter={(v: number) => `$${v.toFixed(3)}`}
                    tick={{ fontSize: 12 }}
                    label={{ value: 'Cost ($)', angle: -90, position: 'insideLeft', fontSize: 12 }}
                  />
                  <ZAxis range={[40, 40]} />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ payload }) => {
                      if (!payload || payload.length === 0) return null;
                      const d = payload[0]?.payload as { utilization: number; cost: number; agent: string; model: string } | undefined;
                      if (!d) return null;
                      return (
                        <div className="rounded border bg-background p-2 text-xs shadow-md">
                          <p className="font-medium">{d.agent}</p>
                          <p className="text-muted-foreground">{d.model}</p>
                          <p>Utilization: {d.utilization.toFixed(1)}%</p>
                          <p>Cost: ${d.cost.toFixed(4)}</p>
                        </div>
                      );
                    }}
                  />
                  <Scatter
                    data={scatterData}
                    fill={CHART_COLORS.scatter}
                    fillOpacity={0.6}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agent Context Table */}
      <Card>
        <CardHeader>
          <CardTitle>Context Utilization by Agent</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2">Agent</th>
                <th className="pb-2 text-right">Avg Util</th>
                <th className="pb-2 text-right">Max Util</th>
                <th className="pb-2 text-right">Avg Input Tokens</th>
                <th className="pb-2 text-right">System</th>
                <th className="pb-2 text-right">Conversation</th>
                <th className="pb-2 text-right">Tool Results</th>
                <th className="pb-2 text-right">Calls</th>
              </tr>
            </thead>
            <tbody>
              {agentContext.map((agent) => (
                <tr key={agent.name} className="border-b">
                  <td className="py-2 font-medium">{agent.name}</td>
                  <td className="py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Progress value={agent.avgUtilization} className="w-16" />
                      <span className="w-14 text-right">{agent.avgUtilization.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="py-2 text-right">
                    <Badge variant={agent.maxUtilization > 80 ? 'destructive' : 'secondary'}>
                      {agent.maxUtilization.toFixed(0)}%
                    </Badge>
                  </td>
                  <td className="py-2 text-right">{formatNumber(agent.avgInputTokens)}</td>
                  <td className="py-2 text-right">{formatNumber(agent.avgSystemTokens)}</td>
                  <td className="py-2 text-right">{formatNumber(agent.avgConversationTokens)}</td>
                  <td className="py-2 text-right">{formatNumber(agent.avgToolTokens)}</td>
                  <td className="py-2 text-right">{formatNumber(agent.count)}</td>
                </tr>
              ))}
              {agentContext.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    No context analysis data yet. Enable guards in your NeuraMeter config.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Recent High Utilization Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent High-Utilization Calls (&gt;70%)</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2">Time</th>
                <th className="pb-2">Agent</th>
                <th className="pb-2">Model</th>
                <th className="pb-2 text-right">Utilization</th>
                <th className="pb-2 text-right">Input Tokens</th>
                <th className="pb-2 text-right">Messages</th>
              </tr>
            </thead>
            <tbody>
              {contextEvents
                .filter((e) => Number(e.context_utilization ?? 0) > 0.7)
                .slice(0, 20)
                .map((e, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2 text-muted-foreground">
                      {new Date(e.event_timestamp).toLocaleString()}
                    </td>
                    <td className="py-2 font-medium">{e.agent_name}</td>
                    <td className="py-2">{e.model}</td>
                    <td className="py-2 text-right">
                      <Badge variant={Number(e.context_utilization) > 0.9 ? 'destructive' : 'secondary'}>
                        {(Number(e.context_utilization) * 100).toFixed(1)}%
                      </Badge>
                    </td>
                    <td className="py-2 text-right">{formatNumber(e.input_tokens ?? 0)}</td>
                    <td className="py-2 text-right">{e.message_count ?? '-'}</td>
                  </tr>
                ))}
              {contextEvents.filter((e) => Number(e.context_utilization ?? 0) > 0.7).length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No high-utilization calls in the last 7 days.
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
