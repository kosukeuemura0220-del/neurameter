import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCost, formatNumber } from '@/lib/format';

interface Recommendation {
  type: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  agentName: string;
  currentCostMicrodollars: number;
  projectedCostMicrodollars: number;
  monthlySavingsMicrodollars: number;
}

function priorityBadge(priority: 'high' | 'medium' | 'low') {
  switch (priority) {
    case 'high':
      return <Badge variant="destructive">High</Badge>;
    case 'medium':
      return <Badge className="bg-amber-100 text-amber-800">Medium</Badge>;
    case 'low':
      return <Badge variant="secondary">Low</Badge>;
  }
}

function typeBadge(type: string) {
  switch (type) {
    case 'compress_history':
      return <Badge variant="outline">Context</Badge>;
    case 'model_downgrade':
      return <Badge variant="outline">Model</Badge>;
    case 'prompt_caching':
      return <Badge variant="outline">Caching</Badge>;
    case 'review_efficiency':
      return <Badge variant="outline">Efficiency</Badge>;
    default:
      return <Badge variant="outline">{type}</Badge>;
  }
}

export default async function OptimizePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (!membership) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-muted-foreground">No organization found.</p>
      </div>
    );
  }

  const orgId = membership.org_id;
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Query cost_events for detailed per-call data
  const { data: costEvents } = await supabase
    .from('cost_events')
    .select(
      'agent_name, model, input_tokens, output_tokens, cost_microdollars, context_window, conversation_history_tokens, system_prompt_tokens, cached_tokens',
    )
    .eq('org_id', orgId)
    .gte('event_timestamp', sevenDaysAgo)
    .limit(5000);

  // Query hourly summaries for aggregated data
  const { data: summaryData } = await supabase
    .from('cost_summaries_hourly')
    .select(
      'agent_name, total_cost_microdollars, total_events, total_input_tokens, total_output_tokens',
    )
    .eq('org_id', orgId)
    .gte('hour_bucket', sevenDaysAgo);

  // Aggregate by agent from summaries
  const agentSummary = new Map<
    string,
    { totalCost: number; totalEvents: number; totalInput: number; totalOutput: number }
  >();
  summaryData?.forEach((row) => {
    const prev = agentSummary.get(row.agent_name) ?? {
      totalCost: 0,
      totalEvents: 0,
      totalInput: 0,
      totalOutput: 0,
    };
    agentSummary.set(row.agent_name, {
      totalCost: prev.totalCost + (row.total_cost_microdollars ?? 0),
      totalEvents: prev.totalEvents + (row.total_events ?? 0),
      totalInput: prev.totalInput + Number(row.total_input_tokens ?? 0),
      totalOutput: prev.totalOutput + Number(row.total_output_tokens ?? 0),
    });
  });

  const recommendations: Recommendation[] = [];

  // Analyze cost_events per agent for detailed recommendations
  const agentEvents = new Map<
    string,
    Array<{
      model: string;
      input_tokens: number;
      output_tokens: number;
      cost_microdollars: number;
      context_window: number | null;
      conversation_history_tokens: number | null;
      system_prompt_tokens: number | null;
      cached_tokens: number | null;
    }>
  >();

  costEvents?.forEach((e) => {
    const list = agentEvents.get(e.agent_name) ?? [];
    list.push(e);
    agentEvents.set(e.agent_name, list);
  });

  for (const [agentName, events] of agentEvents) {
    // Rule 1: Context utilization >75% + conversation history ratio >60%
    const highContextEvents = events.filter((e) => {
      if (!e.context_window || e.context_window === 0) return false;
      const utilization = e.input_tokens / e.context_window;
      const historyRatio =
        e.conversation_history_tokens && e.input_tokens > 0
          ? e.conversation_history_tokens / e.input_tokens
          : 0;
      return utilization > 0.75 && historyRatio > 0.6;
    });

    if (highContextEvents.length > 0) {
      const currentCost = highContextEvents.reduce(
        (s, e) => s + e.cost_microdollars,
        0,
      );
      // Estimate 40% savings from compression
      const projectedCost = Math.round(currentCost * 0.6);
      const weeklySavings = currentCost - projectedCost;
      const monthlySavings = Math.round(weeklySavings * (30 / 7));

      recommendations.push({
        type: 'compress_history',
        priority: highContextEvents.length > 10 ? 'high' : 'medium',
        title: 'Compress conversation history',
        description: `${agentName} has ${highContextEvents.length} calls with >75% context utilization and >60% conversation history. Compressing history could significantly reduce token usage.`,
        agentName,
        currentCostMicrodollars: currentCost,
        projectedCostMicrodollars: projectedCost,
        monthlySavingsMicrodollars: monthlySavings,
      });
    }

    // Rule 2: Simple tasks using expensive models
    const expensiveSimpleEvents = events.filter((e) => {
      const isExpensiveModel =
        e.model?.includes('gpt-4') ||
        e.model?.includes('claude-3-opus') ||
        e.model?.includes('claude-3.5-sonnet');
      return isExpensiveModel && e.output_tokens < 1000;
    });

    if (expensiveSimpleEvents.length > 0) {
      const currentCost = expensiveSimpleEvents.reduce(
        (s, e) => s + e.cost_microdollars,
        0,
      );
      // Estimate 70% savings from model downgrade
      const projectedCost = Math.round(currentCost * 0.3);
      const weeklySavings = currentCost - projectedCost;
      const monthlySavings = Math.round(weeklySavings * (30 / 7));

      recommendations.push({
        type: 'model_downgrade',
        priority: expensiveSimpleEvents.length > 20 ? 'high' : 'medium',
        title: 'Downgrade model for simple tasks',
        description: `${agentName} has ${expensiveSimpleEvents.length} calls using expensive models with <1,000 output tokens. Consider using a lighter model for these simple tasks.`,
        agentName,
        currentCostMicrodollars: currentCost,
        projectedCostMicrodollars: projectedCost,
        monthlySavingsMicrodollars: monthlySavings,
      });
    }

    // Rule 3: System prompt >1000 tokens + no cached tokens
    const uncachedPromptEvents = events.filter((e) => {
      return (
        (e.system_prompt_tokens ?? 0) > 1000 && (e.cached_tokens ?? 0) === 0
      );
    });

    if (uncachedPromptEvents.length > 0) {
      const currentCost = uncachedPromptEvents.reduce(
        (s, e) => s + e.cost_microdollars,
        0,
      );
      // Estimate 25% savings from prompt caching
      const projectedCost = Math.round(currentCost * 0.75);
      const weeklySavings = currentCost - projectedCost;
      const monthlySavings = Math.round(weeklySavings * (30 / 7));

      recommendations.push({
        type: 'prompt_caching',
        priority: uncachedPromptEvents.length > 50 ? 'high' : 'low',
        title: 'Enable prompt caching',
        description: `${agentName} has ${uncachedPromptEvents.length} calls with system prompts >1,000 tokens and no caching. Enabling prompt caching would reduce redundant token processing.`,
        agentName,
        currentCostMicrodollars: currentCost,
        projectedCostMicrodollars: projectedCost,
        monthlySavingsMicrodollars: monthlySavings,
      });
    }
  }

  // Rule 4: High avg cost per call for an agent (from summaries)
  for (const [agentName, summary] of agentSummary) {
    if (summary.totalEvents === 0) continue;
    const avgCostPerCall = summary.totalCost / summary.totalEvents;
    // Flag agents with avg cost per call > $0.10 (100,000 microdollars)
    if (avgCostPerCall > 100_000) {
      const projectedCost = Math.round(summary.totalCost * 0.7);
      const weeklySavings = summary.totalCost - projectedCost;
      const monthlySavings = Math.round(weeklySavings * (30 / 7));

      // Only add if not already recommended for this agent via other rules
      const hasExisting = recommendations.some(
        (r) => r.agentName === agentName,
      );
      if (!hasExisting) {
        recommendations.push({
          type: 'review_efficiency',
          priority: avgCostPerCall > 500_000 ? 'high' : 'medium',
          title: 'Review agent efficiency',
          description: `${agentName} averages ${formatCost(Math.round(avgCostPerCall))} per call across ${formatNumber(summary.totalEvents)} calls. Review prompts and model selection for optimization opportunities.`,
          agentName,
          currentCostMicrodollars: summary.totalCost,
          projectedCostMicrodollars: projectedCost,
          monthlySavingsMicrodollars: monthlySavings,
        });
      }
    }
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
  );

  // KPI calculations
  const totalRecommendations = recommendations.length;
  const totalMonthlySavings = recommendations.reduce(
    (s, r) => s + r.monthlySavingsMicrodollars,
    0,
  );
  const highPriorityCount = recommendations.filter(
    (r) => r.priority === 'high',
  ).length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Optimization Recommendations</h1>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {formatNumber(totalRecommendations)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Potential Monthly Savings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">
              {formatCost(totalMonthlySavings)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              High Priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive">
              {formatNumber(highPriorityCount)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recommendation Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {recommendations.map((rec, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {priorityBadge(rec.priority)}
                  {typeBadge(rec.type)}
                </div>
                <span className="text-xs text-muted-foreground">
                  {rec.agentName}
                </span>
              </div>
              <CardTitle className="text-base">{rec.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {rec.description}
              </p>
              <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-3">
                <div>
                  <p className="text-xs text-muted-foreground">Current Cost</p>
                  <p className="text-sm font-medium">
                    {formatCost(rec.currentCostMicrodollars)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Projected Cost
                  </p>
                  <p className="text-sm font-medium text-green-600">
                    {formatCost(rec.projectedCostMicrodollars)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Monthly Savings
                  </p>
                  <p className="text-sm font-bold text-green-600">
                    {formatCost(rec.monthlySavingsMicrodollars)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {recommendations.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No optimization recommendations at this time. Your agents are
            running efficiently.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
