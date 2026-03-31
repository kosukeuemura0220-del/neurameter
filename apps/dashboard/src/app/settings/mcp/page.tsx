'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export default function MCPSettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [projectId, setProjectId] = useState('');
  const [mcpEndpoint, setMcpEndpoint] = useState('mcp.meter.neuria.tech');
  const [connected, setConnected] = useState(false);

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

    const { data: projects } = await supabase
      .from('projects')
      .select('id')
      .eq('org_id', membership.org_id)
      .limit(1);

    if (projects?.[0]) {
      setProjectId(projects[0].id);
    }

    // Check for existing API keys
    const { data: keys } = await supabase
      .from('api_keys')
      .select('key_prefix')
      .eq('org_id', membership.org_id)
      .limit(1);

    if (keys && keys.length > 0) {
      setApiKey(`${keys[0].key_prefix}...`);
      setConnected(true);
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">MCP Server</h1>
        <Badge variant={connected ? 'default' : 'outline'}>
          {connected ? 'Connected' : 'Not Connected'}
        </Badge>
      </div>

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Connect your AI agents to NeuraMeter via MCP for real-time cost awareness and self-optimization.
          </p>

          <div className="space-y-2">
            <Label>1. Install the MCP server</Label>
            <pre className="rounded-md bg-muted p-3 text-sm font-mono">
              npm install -g @neurameter/mcp-server
            </pre>
          </div>

          <div className="space-y-2">
            <Label>2. Add to your MCP configuration</Label>
            <pre className="rounded-md bg-muted p-3 text-sm font-mono whitespace-pre">
{`{
  "mcpServers": {
    "neurameter": {
      "command": "npx",
      "args": [
        "@neurameter/mcp-server",
        "--api-key", "${apiKey || 'nm_your_api_key'}",
        "--project", "${projectId || 'proj_xxx'}"
      ]
    }
  }
}`}
            </pre>
          </div>

          <div className="space-y-2">
            <Label>3. Add the cost management prompt to your agent</Label>
            <p className="text-sm text-muted-foreground">
              Copy the template prompt from the docs and add it to your agent&apos;s system prompt.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* MCP Endpoint Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Endpoint Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mcpEndpoint">MCP Server Endpoint</Label>
            <div className="flex gap-2">
              <Input
                id="mcpEndpoint"
                value={mcpEndpoint}
                onChange={(e) => setMcpEndpoint(e.target.value)}
                placeholder="mcp.meter.neuria.tech"
              />
              <Button variant="outline" disabled>
                Save
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Custom MCP endpoint for self-hosted deployments.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Project ID</Label>
            <p className="font-mono text-sm text-muted-foreground">{projectId || 'Not set'}</p>
          </div>

          <div className="space-y-2">
            <Label>API Key</Label>
            <p className="font-mono text-sm text-muted-foreground">{apiKey || 'No API key found'}</p>
            <p className="text-xs text-muted-foreground">
              Manage API keys in the <a href="/settings/api-keys" className="text-primary underline">API Keys</a> settings.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Available MCP Tools */}
      <Card>
        <CardHeader>
          <CardTitle>Available MCP Tools</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { name: 'neurameter_get_cost_summary', desc: 'Get cost overview for project/agent by period' },
              { name: 'neurameter_check_context', desc: 'Analyze context window efficiency and get suggestions' },
              { name: 'neurameter_check_budget', desc: 'Verify if next operation is within budget' },
              { name: 'neurameter_get_recommendations', desc: 'Get optimization recommendations from historical data' },
              { name: 'neurameter_log_optimization', desc: 'Record optimization actions for effectiveness tracking' },
            ].map((tool) => (
              <div key={tool.name} className="flex items-start gap-3 rounded-md border p-3">
                <Badge variant="secondary" className="font-mono text-xs shrink-0">
                  {tool.name}
                </Badge>
                <p className="text-sm text-muted-foreground">{tool.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Compatible Agents */}
      <Card>
        <CardHeader>
          <CardTitle>Compatible Agents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2">
            {[
              'Claude Desktop',
              'Claude Code',
              'Cursor',
              'OpenClaw',
              'LangChain (MCP Client)',
              'CrewAI',
              'OpenAI Agents SDK',
              'Any MCP-compatible agent',
            ].map((agent) => (
              <div key={agent} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <span className="text-primary">+</span>
                {agent}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
