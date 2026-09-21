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
