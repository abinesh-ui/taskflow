import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook that returns the current user's member info, admin status,
 * and list of assigned project IDs (null if admin = sees all).
 */
export function useAccessControl() {
  const { user } = useAuth();

  const { data: currentMember, isLoading: memberLoading } = useQuery({
    queryKey: ['current-member', user?.id],
    queryFn: async () => {
      const { data: profile } = await supabase.from('profiles').select('email').eq('id', user!.id).single();
      if (!profile) return null;
      // Case-insensitive email match
      const email = profile.email.toLowerCase();
      const { data } = await supabase.from('master_members').select('id, role').ilike('email', email).single();
      return data as { id?: string; role?: string } | null;
    },
    enabled: !!user,
  });

  const { data: projectMembers = [], isLoading: pmLoading } = useQuery({
    queryKey: ['project_members'],
    queryFn: async () => {
      const { data } = await supabase.from('project_members').select('*');
      return (data || []) as Array<{ id: string; project_id: string; member_id: string }>;
    },
  });

  const isLoading = memberLoading || pmLoading;
  const isAdmin = currentMember?.role === 'admin';
  const memberId = currentMember?.id || null;

  // null means "see all" (admin or still loading); array means restricted to these project IDs
  const userProjectIds: string[] | null = isLoading
    ? null // Still loading, don't filter yet
    : isAdmin
      ? null // Admin sees all
      : memberId
        ? projectMembers.filter((pm) => pm.member_id === memberId).map((pm) => pm.project_id)
        : []; // No member match = see nothing (unrecognized user)

  return { currentMember, isAdmin, memberId, userProjectIds, projectMembers, isLoading };
}
