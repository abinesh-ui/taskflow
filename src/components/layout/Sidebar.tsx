import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  FolderOpen,
  Briefcase,
  Settings,
  Home,
} from 'lucide-react';
import type { Project, Department } from '@/types/database';

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const { projectId, departmentId } = useParams();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === 'admin';
  const [expandedMacros, setExpandedMacros] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [addingProjectTo, setAddingProjectTo] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [addingDeptTo, setAddingDeptTo] = useState<string | null>(null);

  const { data: macroProjects = [] } = useQuery({
    queryKey: ['master_macro_projects'],
    queryFn: async () => {
      const { data } = await supabase
        .from('master_macro_projects')
        .select('*')
        .eq('is_active', true)
        .order('position');
      return (data || []) as Array<{ id: string; name: string; color: string; position: number }>;
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('*')
        .eq('is_active', true)
        .order('position');
      return (data || []) as Array<Project & { macro_project_id?: string }>;
    },
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data } = await supabase
        .from('departments')
        .select('*')
        .eq('is_active', true)
        .order('position');
      return (data || []) as Department[];
    },
  });

  const { data: masterDepartments = [] } = useQuery({
    queryKey: ['master_departments'],
    queryFn: async () => {
      const { data } = await supabase
        .from('master_departments')
        .select('*')
        .eq('is_active', true)
        .order('position');
      return (data || []) as Array<{ id: string; name: string; color: string; position: number }>;
    },
  });

  const addProject = useMutation({
    mutationFn: async ({ name, macroProjectId }: { name: string; macroProjectId: string }) => {
      const { error } = await supabase.from('projects').insert({
        name,
        macro_project_id: macroProjectId,
        position: projects.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setAddingProjectTo(null);
      setNewProjectName('');
    },
  });

  const addDepartment = useMutation({
    mutationFn: async ({ name, color, projectId }: { name: string; color: string; projectId: string }) => {
      const depts = departments.filter((d) => d.project_id === projectId);
      const { error } = await supabase.from('departments').insert({ name, color, project_id: projectId, position: depts.length });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setAddingDeptTo(null);
    },
  });

  function toggleMacro(id: string) {
    const next = new Set(expandedMacros);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedMacros(next);
  }

  function toggleProject(id: string) {
    const next = new Set(expandedProjects);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedProjects(next);
  }

  function getProjectsForMacro(macroId: string) {
    return projects.filter((p) => (p as any).macro_project_id === macroId);
  }

  function getDepartmentsForProject(pid: string) {
    return departments.filter((d) => d.project_id === pid);
  }

  // Projects without a macro project (legacy/unassigned)
  const unassignedProjects = projects.filter((p) => !(p as any).macro_project_id);

  return (
    <div className="flex flex-col h-full">
      {/* Sidebar header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded bg-primary flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" className="h-4 w-4">
              <path d="M8 16l5 5 11-11" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="font-bold text-sm">TaskFlow</span>
        </div>
      </div>

      {/* Nav items */}
      <div className="px-2 py-2 space-y-1">
        <Button variant="ghost" className="w-full justify-start text-sm h-8" onClick={() => { navigate('/'); onNavigate?.(); }}>
          <Home className="h-4 w-4 mr-2" /> Home
        </Button>
        {isAdmin && (
          <Button variant="ghost" className="w-full justify-start text-sm h-8" onClick={() => { navigate('/settings'); onNavigate?.(); }}>
            <Settings className="h-4 w-4 mr-2" /> Settings / Masters
          </Button>
        )}
      </div>

      {/* Macro Project → Project → Department tree */}
      <div className="px-2 py-2 border-t">
        <span className="text-xs font-semibold text-muted-foreground uppercase px-2">Macro Projects</span>
      </div>

      <ScrollArea className="flex-1 px-2">
        <div className="space-y-0.5 pb-4">
          {macroProjects.map((macro) => {
            const macroExpanded = expandedMacros.has(macro.id);
            const macroProjectsList = getProjectsForMacro(macro.id);

            return (
              <div key={macro.id}>
                {/* Macro Project row */}
                <div
                  className="flex items-center gap-1 px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-accent group"
                  onClick={() => toggleMacro(macro.id)}
                >
                  {macroExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  <Briefcase className="h-3.5 w-3.5" style={{ color: macro.color }} />
                  <span className="truncate flex-1 text-xs font-semibold">{macro.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAddingProjectTo(macro.id);
                      setExpandedMacros(new Set([...expandedMacros, macro.id]));
                    }}
                    aria-label="Add project"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                {/* Expanded: show projects under this macro */}
                {macroExpanded && (
                  <div className="ml-3 space-y-0.5">
                    {/* Add project form */}
                    {addingProjectTo === macro.id && (
                      <form
                        className="px-2 py-1"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (newProjectName.trim()) addProject.mutate({ name: newProjectName.trim(), macroProjectId: macro.id });
                        }}
                      >
                        <Input
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                          placeholder="New project name"
                          className="h-7 text-xs"
                          autoFocus
                          onBlur={() => { if (!newProjectName.trim()) setAddingProjectTo(null); }}
                        />
                      </form>
                    )}

                    {/* Projects */}
                    {macroProjectsList.map((project) => {
                      const projExpanded = expandedProjects.has(project.id);
                      const depts = getDepartmentsForProject(project.id);

                      return (
                        <div key={project.id}>
                          <div
                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer hover:bg-accent group ${
                              projectId === project.id && !departmentId ? 'bg-accent' : ''
                            }`}
                            onClick={() => toggleProject(project.id)}
                          >
                            {projExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                            <FolderOpen className="h-3 w-3 text-primary/70" />
                            <span className="truncate flex-1 font-medium">{project.name}</span>
                            {!project.is_live && <span className="text-[9px] text-muted-foreground">(archived)</span>}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 opacity-0 group-hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAddingDeptTo(project.id);
                                setExpandedProjects(new Set([...expandedProjects, project.id]));
                              }}
                              aria-label="Add department"
                            >
                              <Plus className="h-2.5 w-2.5" />
                            </Button>
                          </div>

                          {/* Departments under project */}
                          {projExpanded && (
                            <div className="ml-4 space-y-0.5">
                              {addingDeptTo === project.id && (
                                <div className="px-2 py-1 space-y-1">
                                  <Select
                                    onValueChange={(val) => {
                                      const md = masterDepartments.find((d) => d.name === val);
                                      addDepartment.mutate({ name: val, color: md?.color || '#6b7280', projectId: project.id });
                                    }}
                                  >
                                    <SelectTrigger className="h-7 text-xs">
                                      <SelectValue placeholder="Select department..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(() => {
                                        const assigned = depts.map((d) => d.name.toLowerCase());
                                        const available = masterDepartments.filter((md) => !assigned.includes(md.name.toLowerCase()));
                                        if (available.length === 0) return <SelectItem value="__none__" disabled>No depts available</SelectItem>;
                                        return available.map((md) => (
                                          <SelectItem key={md.id} value={md.name}>
                                            <div className="flex items-center gap-2">
                                              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: md.color }} />
                                              {md.name}
                                            </div>
                                          </SelectItem>
                                        ));
                                      })()}
                                    </SelectContent>
                                  </Select>
                                  <Button variant="ghost" size="sm" className="h-5 text-[10px] w-full" onClick={() => setAddingDeptTo(null)}>Cancel</Button>
                                </div>
                              )}
                              {depts.map((dept) => (
                                <div
                                  key={dept.id}
                                  className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] cursor-pointer hover:bg-accent ${
                                    departmentId === dept.id ? 'bg-accent font-medium' : ''
                                  }`}
                                  onClick={() => { navigate(`/project/${project.id}/department/${dept.id}`); onNavigate?.(); }}
                                >
                                  <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: (dept as any)?.color || '#6b7280' }} />
                                  <span className="truncate">{dept.name}</span>
                                </div>
                              ))}
                              {depts.length === 0 && !addingDeptTo && (
                                <p className="text-[9px] text-muted-foreground px-2 py-0.5">No departments</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {macroProjectsList.length === 0 && !addingProjectTo && (
                      <p className="text-[9px] text-muted-foreground px-2 py-1">No projects. Click + to add.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Unassigned projects (no macro) — shown if any exist */}
          {unassignedProjects.length > 0 && (
            <div className="pt-2 border-t mt-2">
              <span className="text-[10px] text-muted-foreground px-2">Unassigned Projects</span>
              {unassignedProjects.map((project) => {
                const projExpanded = expandedProjects.has(project.id);
                const depts = getDepartmentsForProject(project.id);
                return (
                  <div key={project.id}>
                    <div
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer hover:bg-accent"
                      onClick={() => toggleProject(project.id)}
                    >
                      {projExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      <FolderOpen className="h-3 w-3 text-muted-foreground" />
                      <span className="truncate flex-1 font-medium">{project.name}</span>
                    </div>
                    {projExpanded && depts.map((dept) => (
                      <div
                        key={dept.id}
                        className={`ml-6 flex items-center gap-1 px-2 py-1 rounded text-[11px] cursor-pointer hover:bg-accent ${departmentId === dept.id ? 'bg-accent font-medium' : ''}`}
                        onClick={() => { navigate(`/project/${project.id}/department/${dept.id}`); onNavigate?.(); }}
                      >
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: (dept as any)?.color || '#6b7280' }} />
                        <span className="truncate">{dept.name}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {macroProjects.length === 0 && projects.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-2">Add Macro Projects in Settings first.</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
