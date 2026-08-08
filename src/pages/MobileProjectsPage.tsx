import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { FolderOpen, ChevronRight, Briefcase, Layers } from 'lucide-react';
import type { Project, Department } from '@/types/database';

export default function MobileProjectsPage() {
  const navigate = useNavigate();

  const { data: macroProjects = [] } = useQuery({
    queryKey: ['master_macro_projects'],
    queryFn: async () => {
      const { data } = await supabase.from('master_macro_projects').select('*').eq('is_active', true).order('position');
      return (data || []) as Array<{ id: string; name: string; color: string }>;
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('*').eq('is_active', true).eq('is_live', true).order('position');
      return (data as Array<Project & { macro_project_id?: string }>) || [];
    },
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data } = await supabase.from('departments').select('*').eq('is_active', true).order('position');
      return (data as Department[]) || [];
    },
  });

  const unassignedProjects = projects.filter((p) => !p.macro_project_id);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Projects</h2>

      {macroProjects.length === 0 && projects.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">No projects yet.</p>
      )}

      <div className="space-y-4">
        {macroProjects.map((macro) => {
          const macroProjs = projects.filter((p) => p.macro_project_id === macro.id);
          if (macroProjs.length === 0) return null;
          return (
            <div key={macro.id} className="border rounded-xl overflow-hidden bg-card shadow-sm space-y-0.5">
              <div
                className="flex items-center gap-2.5 p-3 bg-muted/50 cursor-pointer active:bg-muted transition-colors border-b"
                onClick={() => navigate(`/macro/${macro.id}`)}
              >
                <Briefcase className="h-4 w-4 flex-shrink-0" style={{ color: macro.color }} />
                <span className="font-semibold text-sm flex-1">{macro.name}</span>
                <div className="flex items-center gap-1 text-xs text-primary font-medium">
                  <Layers className="h-3.5 w-3.5" />
                  <span>All Tasks</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </div>
              {macroProjs.map((project) => {
                const depts = departments.filter((d) => d.project_id === project.id);
                return (
                  <div key={project.id} className="px-3 py-2 border-b last:border-b-0 space-y-1">
                    <div
                      className="flex items-center gap-2 text-xs font-medium cursor-pointer hover:text-primary py-1"
                      onClick={() => navigate(`/project/${project.id}`)}
                    >
                      <FolderOpen className="h-3.5 w-3.5 text-primary/70" />
                      <span className="flex-1">{project.name}</span>
                      <span className="text-[10px] text-muted-foreground">{depts.length} dept(s)</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    {depts.map((dept) => (
                      <div
                        key={dept.id}
                        className="flex items-center gap-2 ml-4 pl-2 py-1.5 border-l-2 border-primary/20 text-xs cursor-pointer hover:bg-accent rounded-r"
                        onClick={() => navigate(`/project/${project.id}/department/${dept.id}`)}
                      >
                        <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: (dept as any).color || '#6b7280' }} />
                        <span className="flex-1 text-muted-foreground hover:text-foreground">{dept.name}</span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}

        {unassignedProjects.length > 0 && (
          <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
            <div className="p-3 bg-muted/30 font-semibold text-xs text-muted-foreground uppercase border-b">
              Other Projects
            </div>
            {unassignedProjects.map((project) => {
              const depts = departments.filter((d) => d.project_id === project.id);
              return (
                <div key={project.id} className="p-3 border-b last:border-b-0 space-y-1">
                  <div
                    className="flex items-center gap-2 text-xs font-medium cursor-pointer py-1"
                    onClick={() => navigate(`/project/${project.id}`)}
                  >
                    <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="flex-1">{project.name}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  {depts.map((dept) => (
                    <div
                      key={dept.id}
                      className="flex items-center gap-2 ml-4 pl-2 py-1.5 border-l-2 border-muted text-xs cursor-pointer hover:bg-accent rounded-r"
                      onClick={() => navigate(`/project/${project.id}/department/${dept.id}`)}
                    >
                      <span className="flex-1 text-muted-foreground">{dept.name}</span>
                      <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

