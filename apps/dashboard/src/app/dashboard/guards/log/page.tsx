import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

function decisionBadge(decision: string) {
  switch (decision) {
    case 'block':
      return <Badge variant="destructive">Block</Badge>;
    case 'notify':
      return <Badge variant="secondary">Notify</Badge>;
    case 'optimized':
      return <Badge className="bg-blue-100 text-blue-800">Optimized</Badge>;
    default:
      return <Badge variant="outline">{decision}</Badge>;
  }
}

export default async function GuardLogPage() {
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

  const orgId = membership?.org_id;
  if (!orgId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-muted-foreground">No organization found.</p>
      </div>
    );
  }

  const { data: guardEvents } = await supabase
    .from('guard_events')
    .select('*')
    .eq('org_id', orgId)
    .order('event_timestamp', { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Guard Event Log</h1>
        <Link href="/dashboard/guards">
          <Button variant="outline">Back to Guards</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Recent Events
            {guardEvents && guardEvents.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({guardEvents.length} entries)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2">Time</th>
                  <th className="pb-2">Agent</th>
                  <th className="pb-2">Mode</th>
                  <th className="pb-2">Decision</th>
                  <th className="pb-2">Triggered Rules</th>
                  <th className="pb-2">Suggestion</th>
                </tr>
              </thead>
              <tbody>
                {guardEvents?.map((event) => {
                  const rules = Array.isArray(event.triggered_rules)
                    ? event.triggered_rules
                    : [];
                  return (
                    <tr key={event.id} className="border-b">
                      <td className="py-2 whitespace-nowrap text-muted-foreground">
                        {new Date(event.event_timestamp).toLocaleString()}
                      </td>
                      <td className="py-2 font-medium">{event.agent_name}</td>
                      <td className="py-2">
                        <Badge variant="outline">{event.guard_mode}</Badge>
                      </td>
                      <td className="py-2">{decisionBadge(event.decision)}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {rules.map(
                            (rule: Record<string, unknown>, i: number) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="text-xs"
                              >
                                {String(
                                  rule.ruleType ?? rule.rule_type ?? 'unknown',
                                )}
                              </Badge>
                            ),
                          )}
                        </div>
                      </td>
                      <td className="max-w-xs truncate py-2 text-muted-foreground">
                        {event.suggestion ?? '-'}
                      </td>
                    </tr>
                  );
                })}
                {(!guardEvents || guardEvents.length === 0) && (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No guard events found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
