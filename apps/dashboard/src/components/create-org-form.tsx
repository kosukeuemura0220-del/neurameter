'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function CreateOrgForm() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      const { error: rpcError } = await supabase.rpc('create_organization', {
        org_name: name.trim(),
        org_slug: slug,
      });

      if (rpcError) {
        setError(rpcError.message);
        return;
      }

      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleCreate} className="flex w-full max-w-sm gap-2">
      <Input
        placeholder="Organization name"
        value={name}
        onChange={(e) => { setName(e.target.value); setError(''); }}
        required
      />
      <Button type="submit" disabled={loading || !name.trim()}>
        {loading ? 'Creating...' : 'Create'}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
