import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Task, MasterStatus } from '@/types/database';

export function useTasks(departmentId: string | undefined) {
  return useQuery({
    queryKey: ['tasks', departmentId],
    queryFn: async () => {
      if (!departmentId) return [];
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('department_id', departmentId)
        .is('parent_id', null)
        .order('position');
      if (error) throw error;
      return data as Task[];
    },
    enabled: !!departmentId,
  });
}

export function useSubtasks(parentId: string | undefined) {
  return useQuery({
    queryKey: ['subtasks', parentId],
    queryFn: async () => {
      if (!parentId) return [];
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('parent_id', parentId)
        .order('position');
      if (error) throw error;
      return data as Task[];
    },
    enabled: !!parentId,
  });
}

export function useStatuses() {
  return useQuery({
    queryKey: ['master_statuses'],
    queryFn: async () => {
      const { data } = await supabase.from('master_statuses').select('*').eq('is_active', true).order('position');
      return (data as MasterStatus[]) || [];
    },
  });
}

export function useMasterData() {
  const taskTypes = useQuery({
    queryKey: ['master_task_types'],
    queryFn: async () => {
      const { data } = await supabase.from('master_task_types').select('*').eq('is_active', true).order('position');
      return data || [];
    },
  });

  const categories = useQuery({
    queryKey: ['master_task_categories'],
    queryFn: async () => {
      const { data } = await supabase.from('master_task_categories').select('*').eq('is_active', true).order('position');
      return data || [];
    },
  });

  const priorities = useQuery({
    queryKey: ['master_priorities'],
    queryFn: async () => {
      const { data } = await supabase.from('master_priorities').select('*').eq('is_active', true).order('position');
      return data || [];
    },
  });

  const statuses = useStatuses();

  const users = useQuery({
    queryKey: ['master_members'],
    queryFn: async () => {
      const { data } = await supabase.from('master_members').select('*').eq('is_active', true).eq('is_live', true).order('position');
      return data || [];
    },
  });

  const liveProjects = useQuery({
    queryKey: ['projects', 'live'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('*').eq('is_live', true).eq('is_active', true).order('position');
      return data || [];
    },
  });

  const departments = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data } = await supabase.from('departments').select('*').eq('is_active', true).order('position');
      return data || [];
    },
  });

  return {
    taskTypes: taskTypes.data || [],
    categories: categories.data || [],
    priorities: priorities.data || [],
    statuses: statuses.data || [],
    users: users.data || [],
    liveProjects: liveProjects.data || [],
    departments: departments.data || [],
  };
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (task: Omit<Task, 'id' | 'task_no' | 'created_at' | 'updated_at' | 'created_by'> & { created_by?: string }) => {
      let taskNo: string | undefined;

      // If it's a subtask, generate task_no as parent_task_no-SU01, SU02, etc.
      if (task.parent_id) {
        // Get parent task_no
        const { data: parentTask } = await supabase
          .from('tasks')
          .select('task_no')
          .eq('id', task.parent_id)
          .single();

        // Count existing subtasks under this parent
        const { count } = await supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('parent_id', task.parent_id);

        const subNum = (count || 0) + 1;
        taskNo = `${parentTask?.task_no}-SU${String(subNum).padStart(2, '0')}`;
      }

      const insertData = taskNo
        ? { ...task, task_no: taskNo, created_by: user!.id }
        : { ...task, created_by: user!.id };

      const { data, error } = await supabase
        .from('tasks')
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['subtasks', data.parent_id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast({ title: 'Task created', description: `${data.task_no} created successfully` });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Error creating task', description: err.message });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Task> }) => {
      const { data: result, error } = await supabase
        .from('tasks')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['subtasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Error updating task', description: err.message });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['subtasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast({ title: 'Task deleted' });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Error deleting task', description: err.message });
    },
  });
}
