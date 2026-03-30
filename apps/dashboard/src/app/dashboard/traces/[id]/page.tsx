import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCost, formatLatency } from '@/lib/format';

interface Span {
  span_id: string;
  parent_span_id: string | null;
  agent_name: string;
  task_name: string | null;
  model: string;
  provider: string;
  input_tokens: number;
  output_tokens: number;
  cost_microdollars: number;
  latency_ms: number;
  event_timestamp: string;
}

interface TreeNode extends Span {
  children: TreeNode[];
}

function buildTree(spans: Span[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const span of spans) {
    nodeMap.set(span.span_id, { ...span, children: [] });
  }

  for (const span of spans) {
    const node = nodeMap.get(span.span_id)!;
    if (span.parent_span_id && nodeMap.has(span.parent_span_id)) {
      nodeMap.get(span.parent_span_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function SpanNode({ node, depth }: { node: TreeNode; depth: number }) {
  const indent = depth * 24;

  return (
    <>
      <tr className="border-b hover:bg-muted/50">
        <td className="py-2" style={{ paddingLeft: `${indent + 8}px` }}>
          <div className="flex items-center gap-1">
            {depth > 0 && (
              <span className="text-muted-foreground">{'└── '}</span>
            )}
            <span className="font-medium">[{node.agent_name}]</span>
            {node.task_name && (
              <span className="text-muted-foreground text-xs">
                ({node.task_name})
              </span>
            )}
          </div>
        </td>
        <td className="py-2 text-xs text-muted-foreground">{node.model}</td>
        <td className="py-2 text-right">{formatCost(node.cost_microdollars)}</td>
        <td className="py-2 text-right">{formatLatency(node.latency_ms)}</td>
        <td className="py-2 text-right text-xs font-mono text-muted-foreground">
          {node.span_id.slice(0, 8)}
        </td>
      </tr>
      {node.children.map((child) => (
        <SpanNode key={child.span_id} node={child} depth={depth + 1} />
      ))}
    </>
  );
}

export default async function TraceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: traceId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (!membership) return null;

  const { data: spans } = await supabase
    .from('cost_events')
    .select(
      'span_id, parent_span_id, agent_name, task_name, model, provider, input_tokens, output_tokens, cost_microdollars, latency_ms, event_timestamp',
    )
    .eq('org_id', membership.org_id)
    .eq('trace_id', traceId)
    .order('event_timestamp', { ascending: true });

  if (!spans || spans.length === 0) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        Trace not found.
      </div>
    );
  }

  const tree = buildTree(spans as Span[]);
  const totalCost = spans.reduce((s, sp) => s + (sp.cost_microdollars ?? 0), 0);
  const totalLatency = spans.reduce((s, sp) => s + (sp.latency_ms ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Trace</h1>
        <p className="font-mono text-sm text-muted-foreground">{traceId}</p>
        <p className="text-sm text-muted-foreground">
          {spans.length} spans | {formatCost(totalCost)} | {formatLatency(totalLatency)}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Span Tree</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2">Agent</th>
                <th className="pb-2">Model</th>
                <th className="pb-2 text-right">Cost</th>
                <th className="pb-2 text-right">Latency</th>
                <th className="pb-2 text-right">Span ID</th>
              </tr>
            </thead>
            <tbody>
              {tree.map((root) => (
                <SpanNode key={root.span_id} node={root} depth={0} />
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
