'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const supabase = createClient();

  const loadKeys = async () => {
    const { data } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, scopes, created_at, last_used_at, revoked_at')
      .order('created_at', { ascending: false });
    if (data) setKeys(data);
  };

  useEffect(() => {
    loadKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const generateKey = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Not authenticated'); return; }

      const { data: membership } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (!membership) { setError('No organization found'); return; }

      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .eq('org_id', membership.org_id)
        .limit(1);

      const projectId = projects?.[0]?.id;
      if (!projectId) { setError('No project found. Please contact support.'); return; }

      // Generate a random key
      const secret = Array.from(crypto.getRandomValues(new Uint8Array(24)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const rawKey = `nm_${membership.org_id.slice(0, 8)}_${secret}`;
      const prefix = rawKey.slice(0, 20) + '...';

      // SHA-256 hash
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(rawKey));
      const keyHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const { error } = await supabase.from('api_keys').insert({
        org_id: membership.org_id,
        project_id: projectId,
        name: name.trim(),
        key_hash: keyHash,
        key_prefix: prefix,
        scopes: ['ingest'],
      });

      if (error) {
        setError(error.message);
      } else {
        setNewKey(rawKey);
        setName('');
        await loadKeys();
      }
    } finally {
      setLoading(false);
    }
  };

  const revokeKey = async (id: string) => {
    await supabase
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id);
    await loadKeys();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">API Keys</h1>
        <Button onClick={() => {
          setNewKey(null);
          setName('');
          setError('');
          setOpen(true);
        }}>
          Create Key
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {newKey ? 'API Key Created' : 'Create API Key'}
              </DialogTitle>
            </DialogHeader>
            {newKey ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Copy this key now. You won't be able to see it again.
                </p>
                <code className="block break-all rounded bg-muted p-3 text-sm">
                  {newKey}
                </code>
                <Button onClick={() => setOpen(false)} className="w-full">
                  Done
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="keyName">Key Name</Label>
                  <Input
                    id="keyName"
                    placeholder="e.g., Production SDK"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
                <Button
                  onClick={generateKey}
                  disabled={loading || !name.trim()}
                  className="w-full"
                >
                  {loading ? 'Generating...' : 'Generate Key'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your API Keys</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2">Name</th>
                <th className="pb-2">Key</th>
                <th className="pb-2">Scopes</th>
                <th className="pb-2">Created</th>
                <th className="pb-2">Last Used</th>
                <th className="pb-2">Status</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className="border-b">
                  <td className="py-2 font-medium">{key.name}</td>
                  <td className="py-2 font-mono text-xs text-muted-foreground">
                    {key.key_prefix}
                  </td>
                  <td className="py-2">
                    {key.scopes.map((s) => (
                      <Badge key={s} variant="secondary" className="mr-1">
                        {s}
                      </Badge>
                    ))}
                  </td>
                  <td className="py-2 text-muted-foreground">
                    {new Date(key.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-2 text-muted-foreground">
                    {key.last_used_at
                      ? new Date(key.last_used_at).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td className="py-2">
                    {key.revoked_at ? (
                      <Badge variant="destructive">Revoked</Badge>
                    ) : (
                      <Badge variant="default">Active</Badge>
                    )}
                  </td>
                  <td className="py-2">
                    {!key.revoked_at && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => revokeKey(key.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        Revoke
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {keys.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No API keys yet. Create one to start sending events.
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
