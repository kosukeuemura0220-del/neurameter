'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export default function SettingsPage() {
  const [orgName, setOrgName] = useState('');
  const [orgId, setOrgId] = useState('');
  const [plan, setPlan] = useState('free');
  const [projectName, setProjectName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
    setOrgId(membership.org_id);

    const { data: org } = await supabase
      .from('organizations')
      .select('name, plan')
      .eq('id', membership.org_id)
      .single();

    if (org) {
      setOrgName(org.name);
      setPlan(org.plan ?? 'free');
    }

    const { data: projects } = await supabase
      .from('projects')
      .select('id, name')
      .eq('org_id', membership.org_id)
      .limit(1);

    if (projects?.[0]) {
      setProjectName(projects[0].name);
      setProjectId(projects[0].id);
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const saveOrgName = async () => {
    if (!orgId || !orgName.trim()) return;
    setSaving(true);
    await supabase
      .from('organizations')
      .update({ name: orgName.trim() })
      .eq('id', orgId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const saveProjectName = async () => {
    if (!projectId || !projectName.trim()) return;
    setSaving(true);
    await supabase
      .from('projects')
      .update({ name: projectName.trim() })
      .eq('id', projectId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Organization */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Organization</CardTitle>
            <Badge variant="secondary">{plan}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgName">Organization Name</Label>
            <div className="flex gap-2">
              <Input
                id="orgName"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Organization name"
              />
              <Button onClick={saveOrgName} disabled={saving}>
                {saved ? 'Saved' : 'Save'}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Organization ID</Label>
            <p className="font-mono text-sm text-muted-foreground">{orgId || '-'}</p>
          </div>
        </CardContent>
      </Card>

      {/* Project */}
      <Card>
        <CardHeader>
          <CardTitle>Project</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="projectName">Project Name</Label>
            <div className="flex gap-2">
              <Input
                id="projectName"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Project name"
              />
              <Button onClick={saveProjectName} disabled={saving}>
                Save
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Project ID</Label>
            <p className="font-mono text-sm text-muted-foreground">{projectId || '-'}</p>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Delete Organization</p>
              <p className="text-sm text-muted-foreground">
                This will permanently delete all data including events, traces, and API keys.
              </p>
            </div>
            <Button variant="destructive" disabled>
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
