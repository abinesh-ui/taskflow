import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { FolderOpen, ChevronRight } from 'lucide-react';
import type { Project, Department } from '@/types/database';

export default function MobileProjectsPage() {
  const navigate = useNavigate();

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('*').eq('is_active', true).eq('is_live', true).order('position');
      return (data as Project[]) || [];
    },
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data } = await supabase.from('departments').select('*').eq('is_active', true).order('position');
      return (data as Department[]) || [];
    },
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Projects</h2>

      {projects.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">No projects yet.</p>
      )}

      <div className="space-y-3">
        {projects.map((project) => {
          const depts = departments.filter((d) => d.project_id === project.id);
          return (
            <div key={project.id} className="border rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 p-3 bg-muted/30">
                <FolderOpen className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm flex-1">{project.name}</span>
                <span className="text-xs text-muted-foreground">{depts.length} dept(s)</span>
              </div>
              {depts.map((dept) => (
                <div
                  key={dept.id}
                  className="flex items-center gap-2 px-4 py-3 border-t cursor-pointer hover:bg-accent active:bg-accent transition-colors"
                  onClick={() => navigate(`/project/${project.id}/department/${dept.id}`)}
                >
                  <span className="text-sm flex-1">{dept.name}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
              {depts.length === 0 && (
                <p className="px-4 py-2 text-xs text-muted-foreground border-t">No departments</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
