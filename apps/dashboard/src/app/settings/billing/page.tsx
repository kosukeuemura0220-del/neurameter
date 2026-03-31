'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface PlanInfo {
  name: string;
  price: string;
  calls: string;
  retention: string;
  seats: string;
  features: string[];
}

const plans: PlanInfo[] = [
  {
    name: 'Free',
    price: '$0',
    calls: '10K/month',
    retention: '7 days',
    seats: '1',
    features: ['Basic dashboard', 'Agent cost tracking'],
  },
  {
    name: 'Pro',
    price: '$29/mo',
    calls: '100K/month',
    retention: '30 days',
    seats: '5',
    features: ['Alerts', 'All filters', 'Budget management', 'Guard rails'],
  },
  {
    name: 'Team',
    price: '$79/mo',
    calls: '1M/month',
    retention: '90 days',
    seats: 'Unlimited',
    features: ['Anomaly detection', 'RBAC', 'Priority support', 'Auto-optimize'],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    calls: 'Unlimited',
    retention: '1 year',
    seats: 'Unlimited',
    features: ['SSO', 'HIPAA', 'Self-hosted option', 'Dedicated support'],
  },
];

export default function BillingPage() {
  const [currentPlan, setCurrentPlan] = useState('free');
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);

  const supabase = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) return;

    const { data: org } = await supabase
      .from('organizations')
      .select('plan, stripe_customer_id')
      .eq('id', membership.org_id)
      .single();

    if (org) {
      setCurrentPlan(org.plan ?? 'free');
      setStripeCustomerId(org.stripe_customer_id);
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Billing</h1>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <p className="text-3xl font-bold capitalize">{currentPlan}</p>
            <Badge variant="secondary">Active</Badge>
          </div>
          {stripeCustomerId && (
            <p className="text-sm text-muted-foreground">
              Stripe Customer: {stripeCustomerId}
            </p>
          )}
          {currentPlan === 'free' && (
            <p className="text-sm text-muted-foreground">
              Upgrade to Pro to unlock alerts, budgets, and more.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Plan Comparison */}
      <div className="grid gap-4 md:grid-cols-4">
        {plans.map((plan) => {
          const isCurrent = plan.name.toLowerCase() === currentPlan;
          return (
            <Card key={plan.name} className={isCurrent ? 'border-primary' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  {isCurrent && <Badge>Current</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-2xl font-bold">{plan.price}</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">API Calls</span>
                    <span>{plan.calls}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Retention</span>
                    <span>{plan.retention}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Seats</span>
                    <span>{plan.seats}</span>
                  </div>
                </div>
                <ul className="space-y-1 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="text-muted-foreground">
                      + {feature}
                    </li>
                  ))}
                </ul>
                {!isCurrent && plan.name !== 'Enterprise' && (
                  <Button className="w-full" variant={plan.name === 'Pro' ? 'default' : 'outline'} disabled>
                    Upgrade
                  </Button>
                )}
                {plan.name === 'Enterprise' && !isCurrent && (
                  <Button className="w-full" variant="outline" disabled>
                    Contact Sales
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Payment History placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-muted-foreground">
            No payment history. Stripe integration coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
