'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { formatNumber } from '@/lib/format';
import Link from 'next/link';

type GuardMode = 'notify' | 'block' | 'auto_optimize';
type Scope = 'project' | 'agent';

interface GuardConfig {
  id?: string;
  org_id: string;
  guard_mode: GuardMode;
  agent_name: string | null;
  max_input_tokens: number | null;
  max_input_tokens_hard: number | null;
  max_context_utilization: number | null;
  max_context_utilization_hard: number | null;
  max_cost_per_call: number | null;
  max_cost_per_call_hard: number | null;
  max_cost_per_hour: number | null;
  notify_slack_webhook: string | null;
}

interface AgentGuard {
  name: string;
  notify: number;
  block: number;
  optimized: number;
  total: number;
}

const MODE_OPTIONS: {
  value: GuardMode;
  label: string;
  description: string;
  recommended?: boolean;
}[] = [
  {
    value: 'notify',
    label: 'Notify',
    description: 'Threshold exceeded sends notification only',
    recommended: true,
  },
  {
    value: 'block',
    label: 'Block',
    description: 'Soft limit notifies, hard limit blocks API call',
  },
  {
    value: 'auto_optimize',
    label: 'Auto-Optimize',
    description: 'Threshold exceeded triggers onOptimize callback',
  },
];

export default function GuardsPage() {
  const supabase = createClient();

  // KPI state
  const [totalNotifies, setTotalNotifies] = useState(0);
  const [totalBlocks, setTotalBlocks] = useState(0);
  const [totalOptimized, setTotalOptimized] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);
  const [agentGuards, setAgentGuards] = useState<AgentGuard[]>([]);

  // Config form state
  const [orgId, setOrgId] = useState<string | null>(null);
  const [mode, setMode] = useState<GuardMode>('notify');
  const [scope, setScope] = useState<Scope>('project');
  const [agentName, setAgentName] = useState('');
  const [agents, setAgents] = useState<string[]>([]);
  const [inputTokensSoft, setInputTokensSoft] = useState('');
  const [inputTokensHard, setInputTokensHard] = useState('');
  const [contextUtilSoft, setContextUtilSoft] = useState('');
  const [contextUtilHard, setContextUtilHard] = useState('');
  const [costPerCallSoft, setCostPerCallSoft] = useState('');
  const [costPerCallHard, setCostPerCallHard] = useState('');
  const [costPerHour, setCostPerHour] = useState('');
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) return;
    setOrgId(membership.org_id);

    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Load KPI data
    const { data: summaryData } = await supabase
      .from('cost_summaries_hourly')
      .select(
        'total_guard_notifies, total_guard_blocks, total_guard_optimized, total_events, agent_name',
      )
      .eq('org_id', membership.org_id)
      .gte('hour_bucket', sevenDaysAgo);

    const notifies =
      summaryData?.reduce((s, r) => s + (r.total_guard_notifies ?? 0), 0) ?? 0;
    const blocks =
      summaryData?.reduce((s, r) => s + (r.total_guard_blocks ?? 0), 0) ?? 0;
    const optimized =
      summaryData?.reduce(
        (s, r) => s + (r.total_guard_optimized ?? 0),
        0,
      ) ?? 0;
    const events =
      summaryData?.reduce((s, r) => s + (r.total_events ?? 0), 0) ?? 0;

    setTotalNotifies(notifies);
    setTotalBlocks(blocks);
    setTotalOptimized(optimized);
    setTotalEvents(events);

    // Extract unique agent names for scope selector
    const agentNames = new Set<string>();
    summaryData?.forEach((r) => {
      if (r.agent_name) agentNames.add(r.agent_name);
    });
    setAgents(Array.from(agentNames).sort());

    // Load guard events for agent breakdown
    const { data: guardEvents } = await supabase
      .from('guard_events')
      .select('agent_name, decision')
      .eq('org_id', membership.org_id)
      .gte('event_timestamp', sevenDaysAgo)
      .limit(500);

    const agentGuardMap = new Map<
      string,
      { notify: number; block: number; optimized: number }
    >();
    guardEvents?.forEach((e) => {
      const prev = agentGuardMap.get(e.agent_name) ?? {
        notify: 0,
        block: 0,
        optimized: 0,
      };
      if (e.decision === 'notify') prev.notify++;
      else if (e.decision === 'block') prev.block++;
      else if (e.decision === 'optimized') prev.optimized++;
      agentGuardMap.set(e.agent_name, prev);
    });
    setAgentGuards(
      Array.from(agentGuardMap.entries())
        .map(([name, data]) => ({
          name,
          ...data,
          total: data.notify + data.block + data.optimized,
        }))
        .sort((a, b) => b.total - a.total),
    );

    // Load existing guard config
    const { data: config } = await supabase
      .from('guard_configs')
      .select('*')
      .eq('org_id', membership.org_id)
      .limit(1)
      .single();

    if (config) {
      setConfigId(config.id);
      setMode(config.guard_mode ?? 'notify');
      setScope(config.agent_name ? 'agent' : 'project');
      setAgentName(config.agent_name ?? '');
      setInputTokensSoft(
        config.max_input_tokens != null
          ? String(config.max_input_tokens)
          : '',
      );
      setInputTokensHard(
        config.max_input_tokens_hard != null
          ? String(config.max_input_tokens_hard)
          : '',
      );
      setContextUtilSoft(
        config.max_context_utilization != null
          ? String(config.max_context_utilization)
          : '',
      );
      setContextUtilHard(
        config.max_context_utilization_hard != null
          ? String(config.max_context_utilization_hard)
          : '',
      );
      setCostPerCallSoft(
        config.max_cost_per_call != null
          ? String(config.max_cost_per_call)
          : '',
      );
      setCostPerCallHard(
        config.max_cost_per_call_hard != null
          ? String(config.max_cost_per_call_hard)
          : '',
      );
      setCostPerHour(
        config.max_cost_per_hour != null ? String(config.max_cost_per_hour) : '',
      );
      setSlackWebhookUrl(config.notify_slack_webhook ?? '');
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    setSaveMessage(null);

    const payload = {
      org_id: orgId,
      guard_mode: mode,
      agent_name: scope === 'agent' ? agentName || null : null,
      max_input_tokens: inputTokensSoft ? Number(inputTokensSoft) : null,
      max_input_tokens_hard:
        mode === 'block' && inputTokensHard ? Number(inputTokensHard) : null,
      max_context_utilization: contextUtilSoft
        ? Number(contextUtilSoft)
        : null,
      max_context_utilization_hard:
        mode === 'block' && contextUtilHard ? Number(contextUtilHard) : null,
      max_cost_per_call: costPerCallSoft ? Number(costPerCallSoft) : null,
      max_cost_per_call_hard:
        mode === 'block' && costPerCallHard ? Number(costPerCallHard) : null,
      max_cost_per_hour: costPerHour ? Number(costPerHour) : null,
      notify_slack_webhook: slackWebhookUrl || null,
    };

    let error;
    if (configId) {
      ({ error } = await supabase
        .from('guard_configs')
        .update(payload)
        .eq('id', configId));
    } else {
      const result = await supabase
        .from('guard_configs')
        .insert(payload)
        .select('id')
        .single();
      error = result.error;
      if (result.data) setConfigId(result.data.id);
    }

    if (error) {
      setSaveMessage('Failed to save configuration.');
    } else {
      setSaveMessage('Configuration saved successfully.');
    }
    setSaving(false);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const totalTriggered = totalNotifies + totalBlocks + totalOptimized;
  const triggerRate =
    totalEvents > 0 ? (totalTriggered / totalEvents) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Guard Rails</h1>
        <Link href="/dashboard/guards/log">
          <Button variant="outline">View Event Log</Button>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Triggered (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {formatNumber(totalTriggered)}
            </p>
            <p className="text-sm text-muted-foreground">
              {triggerRate.toFixed(1)}% of all calls
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-600">
              {formatNumber(totalNotifies)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Blocks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive">
              {formatNumber(totalBlocks)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Auto-Optimized
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">
              {formatNumber(totalOptimized)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Agent Guard Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Guards by Agent</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2">Agent</th>
                <th className="pb-2 text-right">Notify</th>
                <th className="pb-2 text-right">Block</th>
                <th className="pb-2 text-right">Optimized</th>
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {agentGuards.map((agent) => (
                <tr key={agent.name} className="border-b">
                  <td className="py-2 font-medium">{agent.name}</td>
                  <td className="py-2 text-right">
                    {formatNumber(agent.notify)}
                  </td>
                  <td className="py-2 text-right text-destructive">
                    {formatNumber(agent.block)}
                  </td>
                  <td className="py-2 text-right text-blue-600">
                    {formatNumber(agent.optimized)}
                  </td>
                  <td className="py-2 text-right font-medium">
                    {formatNumber(agent.total)}
                  </td>
                </tr>
              ))}
              {agentGuards.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No guard events yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Guard Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Guard Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mode Selection */}
          <div className="space-y-2">
            <Label>Mode</Label>
            <div className="grid gap-3 md:grid-cols-3">
              {MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMode(opt.value)}
                  className={`relative rounded-lg border p-4 text-left transition-colors ${
                    mode === opt.value
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-input hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-4 w-4 rounded-full border-2 ${
                        mode === opt.value
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground'
                      }`}
                    >
                      {mode === opt.value && (
                        <div className="m-0.5 h-2 w-2 rounded-full bg-white" />
                      )}
                    </div>
                    <span className="text-sm font-medium">{opt.label}</span>
                    {opt.recommended && (
                      <Badge variant="secondary" className="text-xs">
                        Recommended
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 pl-6 text-xs text-muted-foreground">
                    {opt.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Scope Selector */}
          <div className="space-y-2">
            <Label>Scope</Label>
            <div className="flex gap-3">
              <select
                className="flex h-8 w-48 rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={scope}
                onChange={(e) => setScope(e.target.value as Scope)}
              >
                <option value="project">Project-wide</option>
                <option value="agent">Per-agent</option>
              </select>
              {scope === 'agent' && (
                <select
                  className="flex h-8 w-64 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                >
                  <option value="">Select agent...</option>
                  {agents.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Threshold Inputs */}
          <div className="space-y-4">
            <Label className="text-base">Thresholds</Label>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Input Tokens Soft */}
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">
                  Input tokens (soft limit)
                </Label>
                <Input
                  type="number"
                  placeholder="e.g., 50000"
                  value={inputTokensSoft}
                  onChange={(e) => setInputTokensSoft(e.target.value)}
                />
              </div>

              {/* Input Tokens Hard - only in block mode */}
              {mode === 'block' && (
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">
                    Input tokens (hard limit)
                  </Label>
                  <Input
                    type="number"
                    placeholder="e.g., 100000"
                    value={inputTokensHard}
                    onChange={(e) => setInputTokensHard(e.target.value)}
                  />
                </div>
              )}

              {/* Context Utilization Soft */}
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">
                  Context utilization % (soft limit)
                </Label>
                <Input
                  type="number"
                  placeholder="e.g., 75"
                  min={0}
                  max={100}
                  value={contextUtilSoft}
                  onChange={(e) => setContextUtilSoft(e.target.value)}
                />
              </div>

              {/* Context Utilization Hard - only in block mode */}
              {mode === 'block' && (
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">
                    Context utilization % (hard limit)
                  </Label>
                  <Input
                    type="number"
                    placeholder="e.g., 90"
                    min={0}
                    max={100}
                    value={contextUtilHard}
                    onChange={(e) => setContextUtilHard(e.target.value)}
                  />
                </div>
              )}

              {/* Cost Per Call Soft */}
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">
                  Cost per call $ (soft limit)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g., 0.50"
                  value={costPerCallSoft}
                  onChange={(e) => setCostPerCallSoft(e.target.value)}
                />
              </div>

              {/* Cost Per Call Hard - only in block mode */}
              {mode === 'block' && (
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">
                    Cost per call $ (hard limit)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="e.g., 1.00"
                    value={costPerCallHard}
                    onChange={(e) => setCostPerCallHard(e.target.value)}
                  />
                </div>
              )}

              {/* Cost Per Hour */}
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">
                  Cost per hour $
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g., 10.00"
                  value={costPerHour}
                  onChange={(e) => setCostPerHour(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Slack Webhook URL */}
          <div className="space-y-1">
            <Label>Slack Webhook URL</Label>
            <Input
              type="url"
              placeholder="https://hooks.slack.com/services/..."
              value={slackWebhookUrl}
              onChange={(e) => setSlackWebhookUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Notifications will be sent to this webhook when thresholds are
              exceeded.
            </p>
          </div>

          {/* Save Button */}
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>
            {saveMessage && (
              <span
                className={`text-sm ${
                  saveMessage.includes('Failed')
                    ? 'text-destructive'
                    : 'text-green-600'
                }`}
              >
                {saveMessage}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
