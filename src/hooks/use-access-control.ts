import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Central access-control hook.
 *
 * SECURITY MODEL (fail-closed):
 *  - `ready`          : true only once we KNOW the user's role + project list.
 *  - `isAdmin`        : true only if the matched member's role === 'admin'.
 *  - `userProjectIds` :
 *        null  -> admin, see everything (ONLY when isAdmin is confirmed)
 *        []    -> see nothing (default while loading, unknown user, or non-admin with no projects)
 *        [...] -> restricted to these project ids
 *
 * The key rule: we NEVER default to "see all" while loading or on lookup failure.
 * A non-admin (or unresolved) user is restricted to their explicit project list,
 * which is empty until proven otherwise.
 */
export function useAccessControl() {
  const { user } = useAuth();

  const { data: currentMember, isLoading: memberLoading, isFetched: memberFetched } = useQuery({
    queryKey: ['current-member', user?.id],
    queryFn: async () => {
      // Resolve the auth user's email from their profile
      const { data: profile } = await supabase.from('profiles').select('email').eq('id', user!.id).single();
      const email = (profile?.email || user!.email || '').toLowerCase();
      if (!email) return null;
      // Match against master_members (case-insensitive). Use maybeSingle so a
      // missing/duplicate row does not throw — it just resolves to null.
      const { data } = await supabase
        .from('master_members')
        .select('id, role, email')
        .ilike('email', email)
        .limit(1)
        .maybeSingle();
      return (data as { id?: string; role?: string; email?: string } | null) ?? null;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const { data: projectMembers = [], isLoading: pmLoading, isFetched: pmFetched } = useQuery({
    queryKey: ['project_members'],
    queryFn: async () => {
      const { data } = await supabase.from('project_members').select('*');
      return (data || []) as Array<{ id: string; project_id: string; member_id: string }>;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const isLoading = memberLoading || pmLoading;
  // "ready" = both queries have completed at least once
  const ready = !!user && memberFetched && pmFetched;

  const isAdmin = currentMember?.role === 'admin';
  const memberId = currentMember?.id || null;

  // Fail-closed: default to [] (see nothing). Only expand access when we're sure.
  let userProjectIds: string[] | null;
  if (!ready) {
    userProjectIds = []; // still resolving -> show nothing (prevents the "see all" flash)
  } else if (isAdmin) {
    userProjectIds = null; // admin -> see everything
  } else if (memberId) {
    userProjectIds = projectMembers
      .filter((pm) => pm.member_id === memberId)
      .map((pm) => pm.project_id);
  } else {
    userProjectIds = []; // unknown/unmatched user -> see nothing
  }

  return { currentMember, isAdmin, memberId, userProjectIds, projectMembers, isLoading, ready };
}

/**
 * Role-based permission check, backed by the `role_permissions` table
 * (configured in Settings > User Management > Role Permissions).
 *
 * Admins always return true. For everyone else, `ready` stays false until
 * both the member/role lookup and the permissions table have loaded, so
 * callers can show a loading state instead of flashing "denied" or "allowed"
 * before the real answer is known.
 */
export function usePermission(permission: string) {
  const { currentMember, isAdmin, ready: accessReady } = useAccessControl();

  const { data: rolePermissions = [], isFetched: permsFetched } = useQuery({
    queryKey: ['role_permissions'],
    queryFn: async () => {
      const { data } = await supabase.from('role_permissions').select('*');
      return (data || []) as Array<{ role: string; permission: string; allowed: boolean }>;
    },
  });

  const ready = accessReady && permsFetched;
  const role = currentMember?.role || 'team_member';
  const allowed = isAdmin || (rolePermissions.find((p) => p.role === role && p.permission === permission)?.allowed ?? false);

  return { allowed: ready ? allowed : false, ready };
}

/**
 * Returns the set of currently LIVE project ids, plus the live project rows
 * themselves. This is the single source of truth every day-to-day screen
 * should use to exclude archived ("not live") projects' tasks/subtasks/
 * milestones — instead of each screen re-filtering `projects` by `is_live`
 * independently (which was previously inconsistent across the app).
 *
 * Dedicated archive screens (e.g. "Closed Projects") should query projects
 * directly instead of using this hook, since they intentionally need the
 * non-live rows.
 */
export function useLiveProjects() {
  const { data: liveProjects = [], isFetched } = useQuery({
    queryKey: ['projects-live'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('*').eq('is_active', true).eq('is_live', true).order('position');
      return (data || []) as Array<{ id: string; name: string; color?: string; macro_project_id?: string | null }>;
    },
  });
  const liveProjectIds = new Set(liveProjects.map((p) => p.id));
  return { liveProjects, liveProjectIds, isFetched };
}

/** Filters any array of rows with a `project_id` field down to only those whose project is live. */
export function filterToLiveProjects<T extends { project_id: string }>(rows: T[], liveProjectIds: Set<string>): T[] {
  return rows.filter((r) => liveProjectIds.has(r.project_id));
}
