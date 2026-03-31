'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Budget {
  id: string;
  scope_type: string;
  scope_id: string;
  amount_microdollars: number;
  limit_microdollars: number;
  period: string;
  alert_threshold: number;
  notify_email: boolean;
  notify_slack_webhook: string | null;
  created_at: string;
}

function formatCost(microdollars: number): string {
  const dollars = microdollars / 1_000_000;
  if (dollars >= 1) return `$${dollars.toFixed(2)}`;
  if (dollars >= 0.01) return `$${dollars.toFixed(3)}`;
  return `$${dollars.toFixed(4)}`;
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [currentSpend, setCurrentSpend] = useState<Map<string, number>>(new Map());
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    scopeType: 'org',
    scopeId: '',
    amount: '',
    period: 'monthly',
    alertThreshold: '80',
  });

  const supabase = createClient();

  const loadBudgets = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) return;

    const { data } = await supabase
      .from('budgets')
      .select('*')
      .eq('org_id', membership.org_id)
      .order('created_at', { ascending: false });

    if (data) setBudgets(data);

    // Get current month spend
    const monthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    ).toISOString();

    const { data: summaryData } = await supabase
      .from('cost_summaries_hourly')
      .select('agent_name, customer_id, total_cost_microdollars')
      .eq('org_id', membership.org_id)
      .gte('hour_bucket', monthStart);

    const spendMap = new Map<string, number>();
    let orgTotal = 0;
    summaryData?.forEach((row) => {
      const cost = row.total_cost_microdollars ?? 0;
      orgTotal += cost;
      if (row.agent_name) {
        spendMap.set(`agent:${row.agent_name}`, (spendMap.get(`agent:${row.agent_name}`) ?? 0) + cost);
      }
      if (row.customer_id) {
        spendMap.set(`customer:${row.customer_id}`, (spendMap.get(`customer:${row.customer_id}`) ?? 0) + cost);
      }
    });
    spendMap.set('org:*', orgTotal);
    setCurrentSpend(spendMap);
  }, [supabase]);

  useEffect(() => {
    loadBudgets();
  }, [loadBudgets]);

  const getSpendForBudget = (budget: Budget): number => {
    if (budget.scope_type === 'org') return currentSpend.get('org:*') ?? 0;
    return currentSpend.get(`${budget.scope_type}:${budget.scope_id}`) ?? 0;
  };

  const createBudget = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (!membership) return;

      const amountDollars = parseFloat(form.amount);
      if (isNaN(amountDollars) || amountDollars <= 0) return;

      const { error } = await supabase.from('budgets').insert({
        org_id: membership.org_id,
        scope_type: form.scopeType,
        scope_id: form.scopeType === 'org' ? membership.org_id : form.scopeId,
        limit_microdollars: Math.round(amountDollars * 1_000_000),
        amount_microdollars: Math.round(amountDollars * 1_000_000),
        period: form.period,
        alert_threshold: parseFloat(form.alertThreshold) / 100,
        notify_email: true,
      });

      if (!error) {
        setOpen(false);
        setForm({ scopeType: 'org', scopeId: '', amount: '', period: 'monthly', alertThreshold: '80' });
        await loadBudgets();
      }
    } finally {
      setLoading(false);
    }
  };

  const deleteBudget = async (id: string) => {
    await supabase.from('budgets').delete().eq('id', id);
    await loadBudgets();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Budgets</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>
            Create Budget
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Budget</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Scope</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.scopeType}
                  onChange={(e) => setForm({ ...form, scopeType: e.target.value })}
                >
                  <option value="org">Organization</option>
                  <option value="agent">Agent</option>
                  <option value="customer">Customer</option>
                </select>
              </div>

              {form.scopeType !== 'org' && (
                <div className="space-y-2">
                  <Label>{form.scopeType === 'agent' ? 'Agent Name' : 'Customer ID'}</Label>
                  <Input
                    placeholder={form.scopeType === 'agent' ? 'e.g., SupportAgent' : 'e.g., cust_123'}
                    value={form.scopeId}
                    onChange={(e) => setForm({ ...form, scopeId: e.target.value })}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Budget Amount ($)</Label>
                <Input
                  type="number"
                  placeholder="e.g., 100"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Period</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.period}
                  onChange={(e) => setForm({ ...form, period: e.target.value })}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Alert Threshold (%)</Label>
                <Input
                  type="number"
                  placeholder="80"
                  value={form.alertThreshold}
                  onChange={(e) => setForm({ ...form, alertThreshold: e.target.value })}
                />
              </div>

              <Button onClick={createBudget} disabled={loading || !form.amount} className="w-full">
                {loading ? 'Creating...' : 'Create Budget'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Budget Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {budgets.map((budget) => {
          const limitAmount = budget.limit_microdollars ?? budget.amount_microdollars;
          const spend = getSpendForBudget(budget);
          const pct = limitAmount > 0 ? Math.min((spend / limitAmount) * 100, 100) : 0;
          const thresholdPct = (budget.alert_threshold ?? 0.8) * 100;
          const isOverThreshold = pct >= thresholdPct;
          const isOverBudget = pct >= 100;

          return (
            <Card key={budget.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    {budget.scope_type === 'org' ? 'Organization' : `${budget.scope_type}: ${budget.scope_id}`}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{budget.period}</Badge>
                    {isOverBudget ? (
                      <Badge variant="destructive">Over Budget</Badge>
                    ) : isOverThreshold ? (
                      <Badge className="bg-amber-100 text-amber-800">Warning</Badge>
                    ) : (
                      <Badge variant="secondary">On Track</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-bold">{formatCost(spend)}</p>
                    <p className="text-sm text-muted-foreground">
                      of {formatCost(limitAmount)} budget
                    </p>
                  </div>
                  <p className="text-2xl font-bold">{pct.toFixed(0)}%</p>
                </div>
                <Progress value={pct} className={isOverBudget ? '[&>div]:bg-destructive' : isOverThreshold ? '[&>div]:bg-amber-500' : ''} />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Alert at {thresholdPct}%</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={() => deleteBudget(budget.id)}>
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {budgets.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No budgets configured. Create one to track spending limits.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
