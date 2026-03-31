'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  email?: string;
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [orgId, setOrgId] = useState('');

  const supabase = createClient();

  const loadMembers = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);

    const { data: membership } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) return;
    setOrgId(membership.org_id);

    const { data } = await supabase
      .from('org_members')
      .select('id, user_id, role, created_at')
      .eq('org_id', membership.org_id)
      .order('created_at', { ascending: true });

    if (data) setMembers(data);
  }, [supabase]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const inviteMember = async () => {
    if (!inviteEmail.trim() || !orgId) return;
    setLoading(true);

    try {
      // In a real app, this would send an invitation email
      // For now, we just show the concept
      alert(`Invitation would be sent to ${inviteEmail} with role: ${inviteRole}`);
      setOpen(false);
      setInviteEmail('');
      setInviteRole('member');
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (memberId: string, newRole: string) => {
    await supabase
      .from('org_members')
      .update({ role: newRole })
      .eq('id', memberId);
    await loadMembers();
  };

  const removeMember = async (memberId: string) => {
    await supabase
      .from('org_members')
      .delete()
      .eq('id', memberId);
    await loadMembers();
  };

  function roleBadge(role: string) {
    switch (role) {
      case 'owner':
        return <Badge className="bg-purple-100 text-purple-800">Owner</Badge>;
      case 'admin':
        return <Badge className="bg-blue-100 text-blue-800">Admin</Badge>;
      case 'member':
        return <Badge variant="secondary">Member</Badge>;
      case 'viewer':
        return <Badge variant="outline">Viewer</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Team</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>
            Invite Member
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <Button onClick={inviteMember} disabled={loading || !inviteEmail.trim()} className="w-full">
                {loading ? 'Sending...' : 'Send Invitation'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2">User ID</th>
                <th className="pb-2">Role</th>
                <th className="pb-2">Joined</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b">
                  <td className="py-2 font-mono text-sm">
                    {member.user_id.slice(0, 8)}...
                    {member.user_id === currentUserId && (
                      <Badge variant="outline" className="ml-2">You</Badge>
                    )}
                  </td>
                  <td className="py-2">{roleBadge(member.role)}</td>
                  <td className="py-2 text-muted-foreground">
                    {new Date(member.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-2">
                    {member.user_id !== currentUserId && member.role !== 'owner' && (
                      <div className="flex gap-2">
                        <select
                          className="h-8 rounded border bg-background px-2 text-xs"
                          value={member.role}
                          onChange={(e) => updateRole(member.id, e.target.value)}
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-destructive"
                          onClick={() => removeMember(member.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">
                    No team members found.
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
