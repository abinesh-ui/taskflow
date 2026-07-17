import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDistanceToNow } from 'date-fns';
import { Send, User } from 'lucide-react';
import type { Comment, Profile } from '@/types/database';

interface CommentsSectionProps {
  taskId: string;
}

export default function CommentsSection({ taskId }: CommentsSectionProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', taskId],
    queryFn: async () => {
      const { data } = await supabase
        .from('comments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });
      return (data as Comment[]) || [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*');
      return (data as Profile[]) || [];
    },
  });

  const addComment = useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.from('comments').insert({
        task_id: taskId,
        user_id: user!.id,
        body,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', taskId] });
      setBody('');
    },
  });

  function getUserName(userId: string) {
    return profiles.find((p) => p.id === userId)?.full_name || 'Unknown';
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (body.trim()) addComment.mutate(body.trim());
  }

  return (
    <div className="space-y-3 border-t pt-4 mt-4">
      <h4 className="text-sm font-semibold">Comments ({comments.length})</h4>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {comments.map((c) => (
          <div key={c.id} className="flex gap-2">
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <User className="h-3 w-3 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">{getUserName(c.user_id)}</span>
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{c.body}</p>
            </div>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="text-xs text-muted-foreground">No comments yet.</p>
        )}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment..."
          className="h-8 text-sm"
        />
        <Button type="submit" size="sm" className="h-8" disabled={!body.trim()}>
          <Send className="h-3 w-3" />
        </Button>
      </form>
    </div>
  );
}
