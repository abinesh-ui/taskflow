import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAccessControl } from '@/hooks/use-access-control';
import { Trash2 } from 'lucide-react';
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
  { key: 'create_milestone', label: 'Create Milestones' },
  { key: 'edit_milestone', label: 'Edit Milestones' },
  { key: 'delete_milestone', label: 'Delete Milestones' },
  { key: 'close_milestone', label: 'Close Milestones' },
  { key: 'edit_poa', label: 'Edit Submitted POA' },
  { key: 'delete_poa', label: 'Delete Submitted POA' },
  { key: 'manage_masters', label: 'Manage Masters/Settings' },
  { key: 'manage_users', label: 'Manage Users' },
  { key: 'delete_user', label: 'Delete Users' },
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
  const [newCredentials, setNewCredentials] = useState<{ email: string; password: string } | null>(null);
  const { currentMember } = useAccessControl();

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
      const email = newEmail.trim().toLowerCase();
      // Generate a temporary password (admin shares it with the user - no email needed)
      const tempPassword = 'Task@' + Math.random().toString(36).slice(-6) + Math.floor(10 + Math.random() * 89);

      // Create the auth user directly WITH a password via signUp.
      // This avoids the magic-link/reset-email flow entirely (which fails when the
      // ISP blocks the Supabase email link domain). The user can log in immediately.
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password: tempPassword,
        options: { data: { full_name: newName.trim() } },
      });
      const alreadyExists = signUpError && signUpError.message.toLowerCase().includes('already');
      if (signUpError && !alreadyExists) throw signUpError;

      // Create/ensure member entry
      const { data: member, error } = await supabase.from('master_members').insert({
        name: newName.trim(),
        email,
        role: newRole,
        color: AUTO_COLORS[users.length % AUTO_COLORS.length],
        position: users.length + 1,
        is_live: true,
        invited_at: new Date().toISOString(),
      }).select().single();
      if (error) throw error;

      return { member, tempPassword: alreadyExists ? null : tempPassword, email, alreadyExists };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['master_members'] });
      setAdding(false); setNewName(''); setNewEmail(''); setNewRole('team_member');
      if (result.tempPassword) {
        setNewCredentials({ email: result.email, password: result.tempPassword });
        toast({ title: 'User created!', description: 'Share the login credentials shown below with the user.' });
      } else {
        toast({ title: 'User added', description: 'This email already has an account. They can log in with their existing password.' });
      }
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

  const deleteUser = useMutation({
    mutationFn: async (id: string) => {
      // Remove the member's project mappings first, then the member record
      await supabase.from('project_members').delete().eq('member_id', id);
      const { error } = await supabase.from('master_members').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['master_members'] }); queryClient.invalidateQueries({ queryKey: ['project_members'] }); toast({ title: 'User deleted' }); },
    onError: (err: Error) => { toast({ variant: 'destructive', title: 'Cannot delete', description: err.message }); },
  });

  const updatePermission = useMutation({
    mutationFn: async ({ role, permission, allowed }: { role: string; permission: string; allowed: boolean }) => {
      const { error } = await supabase.from('role_permissions').upsert({ role, permission, allowed }, { onConflict: 'role,permission' });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['role_permissions'] }); },
  });

  function getPermission(role: string, perm: string): boolean {
    if (role === 'admin') return true; // Admin always has all permissions
    const p = permissions.find((x) => x.role === role && x.permission === perm);
    return p?.allowed ?? false;
  }

  // Whether the current logged-in user may delete users (admin always; others per role_permissions)
  const myRole = currentMember?.role || 'team_member';
  const canDeleteUser = getPermission(myRole, 'delete_user');

  return (
    <div className="space-y-6">
      {/* Users List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">Users ({users.length})</CardTitle>
            <p className="text-[10px] text-muted-foreground mt-1">Creating a user sets a temporary password you share directly — no email required. If they forget it, they can use "Forgot password" on the login page.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4 mr-1" /> Invite User
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {newCredentials && (
              <div className="p-3 border-2 border-green-300 rounded-lg bg-green-50">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-green-800">✓ User created — share these login credentials:</p>
                    <p className="text-xs"><strong>Email:</strong> <span className="font-mono bg-white px-1.5 py-0.5 rounded border">{newCredentials.email}</span></p>
                    <p className="text-xs"><strong>Temp Password:</strong> <span className="font-mono bg-white px-1.5 py-0.5 rounded border">{newCredentials.password}</span></p>
                    <p className="text-[10px] text-green-700 mt-1">The user can log in immediately with these. They can change the password later from the app. No email needed.</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => { navigator.clipboard.writeText(`Email: ${newCredentials.email}\nPassword: ${newCredentials.password}\nLogin at: ${window.location.origin}/login`); toast({ title: 'Copied to clipboard' }); }}>Copy</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setNewCredentials(null)}>Dismiss</Button>
                  </div>
                </div>
              </div>
            )}
            {adding && (
              <div className="flex flex-wrap items-center gap-2 p-3 border rounded bg-muted/50">
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full Name *" className="h-8 text-sm w-40" autoFocus />
                <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email *" type="email" className="h-8 text-sm w-48" />
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="h-8 text-sm border rounded px-2 bg-background">
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
                <Button size="sm" className="h-8" onClick={() => inviteUser.mutate()} disabled={!newName.trim() || !newEmail.trim() || inviteUser.isPending}>
                  <Mail className="h-3.5 w-3.5 mr-1" /> {inviteUser.isPending ? 'Creating...' : 'Create User'}
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
                  {/* If a user forgets their temp password, they self-serve via the
                      in-app "Forgot password" OTP-code flow on the login page — no
                      admin action or email link needed, so no resend button here. */}
                  <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => toggleActive.mutate({ id: user.id, active: !user.is_live })}>
                    {user.is_live ? 'Deactivate' : 'Activate'}
                  </Button>
                  {canDeleteUser && (
                    <Button size="sm" variant="ghost" className="h-7 text-[10px] text-destructive hover:bg-red-50 hover:text-red-600" onClick={() => { if (confirm(`Permanently delete user "${user.name}"? This removes them from the app and all their project assignments. This cannot be undone.`)) deleteUser.mutate(user.id); }}>
                      <Trash2 className="h-3 w-3 mr-1" /> Delete
                    </Button>
                  )}
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
