import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Check, X, Mail, Shield } from 'lucide-react';

const ROLES = ['admin', 'manager', 'team_leader', 'team_member'] as const;
const ROLE_LABELS: Record<string, string> = { admin: 'Admin', manager: 'Manager', team_leader: 'Team Leader', team_member: 'Team Member' };
const ROLE_COLORS: Record<string, string> = { admin: '#ef4444', manager: '#8b5cf6', team_leader: '#3b82f6', team_member: '#6b7280' };

const PERMISSIONS = [
  { key: 'create_task', label: 'Create Tasks' },
  { key: 'edit_task', label: 'Edit Tasks' },
  { key: 'delete_task', label: 'Delete Tasks' },
  { key: 'cancel_task', label: 'Cancel Tasks' },
  { key: 'change_status', label: 'Change Status' },
  { key: 'edit_poa', label: 'Edit Submitted POA' },
  { key: 'manage_masters', label: 'Manage Masters/Settings' },
  { key: 'manage_users', label: 'Manage Users' },
  { key: 'export_data', label: 'Export Data' },
];

export default function UserManagementPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<string>('team_member');
  const [showPermissions, setShowPermissions] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ['master_members'],
    queryFn: async () => {
      const { data } = await supabase.from('master_members').select('*').order('position');
      return (data || []) as Array<{ id: string; name: string; email?: string; color: string; role?: string; is_active: boolean; is_live?: boolean; invited_at?: string; accepted_at?: string }>;
    },
  });

  const { data: permissions = [] } = useQuery({
    queryKey: ['role_permissions'],
    queryFn: async () => {
      const { data } = await supabase.from('role_permissions').select('*');
      return (data || []) as Array<{ id: string; role: string; permission: string; allowed: boolean }>;
    },
  });

  const AUTO_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1'];

  const inviteUser = useMutation({
    mutationFn: async () => {
      // Create member entry
      const { data: member, error } = await supabase.from('master_members').insert({
        name: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        role: newRole,
        color: AUTO_COLORS[users.length % AUTO_COLORS.length],
        position: users.length + 1,
        is_live: true,
        invited_at: new Date().toISOString(),
      }).select().single();
      if (error) throw error;

      // Send invite via Supabase Auth
      const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(newEmail.trim().toLowerCase());
      // Note: This may fail on anon key - that's okay, user can still sign up manually
      if (inviteError) {
        // Fallback: just create the member, user signs up manually
        console.log('Invite email not sent (admin key required):', inviteError.message);
      }
      return member;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master_members'] });
      setAdding(false); setNewName(''); setNewEmail(''); setNewRole('team_member');
      toast({ title: 'User invited', description: 'They can sign up with the provided email.' });
    },
    onError: (err: Error) => { toast({ variant: 'destructive', title: 'Error', description: err.message }); },
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      await supabase.from('master_members').update({ role }).eq('id', id);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['master_members'] }); toast({ title: 'Role updated' }); },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await supabase.from('master_members').update({ is_live: active, is_active: active }).eq('id', id);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['master_members'] }); },
  });

  const updatePermission = useMutation({
    mutationFn: async ({ role, permission, allowed }: { role: string; permission: string; allowed: boolean }) => {
      const { error } = await supabase.from('role_permissions').upsert({ role, permission, allowed }, { onConflict: 'role,permission' });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['role_permissions'] }); },
  });

  function getPermission(role: string, perm: string): boolean {
    const p = permissions.find((x) => x.role === role && x.permission === perm);
    return p?.allowed ?? false;
  }

  return (
    <div className="space-y-6">
      {/* Users List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Users ({users.length})</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4 mr-1" /> Invite User
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {adding && (
              <div className="flex flex-wrap items-center gap-2 p-3 border rounded bg-muted/50">
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full Name *" className="h-8 text-sm w-40" autoFocus />
                <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email *" type="email" className="h-8 text-sm w-48" />
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="h-8 text-sm border rounded px-2 bg-background">
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
                <Button size="sm" className="h-8" onClick={() => inviteUser.mutate()} disabled={!newName.trim() || !newEmail.trim()}>
                  <Mail className="h-3.5 w-3.5 mr-1" /> Send Invite
                </Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => setAdding(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {users.map((user) => {
              const status = !user.is_live ? 'inactive' : user.email && !user.accepted_at ? 'invite_pending' : user.email && user.accepted_at ? 'active' : 'no_email';
              const statusLabel = { inactive: 'Inactive', invite_pending: 'Invite Sent', active: 'Active', no_email: 'No Email' }[status];
              const statusColor = { inactive: '#ef4444', invite_pending: '#f59e0b', active: '#10b981', no_email: '#6b7280' }[status];
              return (
                <div key={user.id} className="flex flex-wrap items-center gap-2 p-3 border rounded">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: user.color }}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-[120px]">
                    <div className="font-medium text-sm">{user.name}</div>
                  </div>
                  {/* Editable email */}
                  <input
                    defaultValue={user.email || ''}
                    onBlur={(e) => { const v = e.target.value.trim(); if (v !== (user.email || '')) { supabase.from('master_members').update({ email: v }).eq('id', user.id).then(() => queryClient.invalidateQueries({ queryKey: ['master_members'] })); } }}
                    placeholder="email@example.com"
                    className="h-7 text-xs border rounded px-2 bg-background w-44"
                  />
                  {/* Status badge */}
                  <Badge style={{ backgroundColor: statusColor, color: '#fff' }} className="text-[9px]">{statusLabel}</Badge>
                  {/* Role selector */}
                  <select value={user.role || 'team_member'} onChange={(e) => updateRole.mutate({ id: user.id, role: e.target.value })} className="h-7 text-xs border rounded px-2 bg-background">
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                  {/* Send invite button (only if has email and not yet accepted) */}
                  {user.email && !user.accepted_at && (
                    <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={async () => {
                      await supabase.from('master_members').update({ invited_at: new Date().toISOString() }).eq('id', user.id);
                      const { error } = await supabase.auth.admin.inviteUserByEmail(user.email!);
                      if (error) toast({ title: 'Note', description: 'User can sign up manually with this email.' });
                      else toast({ title: 'Invite sent!' });
                      queryClient.invalidateQueries({ queryKey: ['master_members'] });
                    }}>
                      <Mail className="h-3 w-3 mr-1" /> {user.invited_at ? 'Resend' : 'Send'} Invite
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => toggleActive.mutate({ id: user.id, active: !user.is_live })}>
                    {user.is_live ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Role Permissions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Role Permissions</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowPermissions(!showPermissions)}>
            {showPermissions ? 'Hide' : 'Configure'}
          </Button>
        </CardHeader>
        {showPermissions && (
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 px-2 text-left font-medium">Permission</th>
                    {ROLES.map((r) => <th key={r} className="py-2 px-2 text-center font-medium">{ROLE_LABELS[r]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSIONS.map((perm) => (
                    <tr key={perm.key} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-2">{perm.label}</td>
                      {ROLES.map((role) => (
                        <td key={role} className="py-2 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={getPermission(role, perm.key)}
                            onChange={(e) => updatePermission.mutate({ role, permission: perm.key, allowed: e.target.checked })}
                            className="h-4 w-4 rounded"
                            disabled={role === 'admin'} // Admin always has all
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-muted-foreground mt-2">Admin permissions can't be changed. Changes apply immediately.</p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
