import { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronDown, FolderOpen, Briefcase, Settings, Home, Layers } from 'lucide-react';
import type { Project, Department } from '@/types/database';

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [expandedMacros, setExpandedMacros] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const { data: macroProjects = [] } = useQuery({ queryKey: ['master_macro_projects'], queryFn: async () => { const { data } = await supabase.from('master_macro_projects').select('*').eq('is_active', true).order('position'); return (data || []) as Array<{ id: string; name: string; color: string }>; } });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: async () => { const { data } = await supabase.from('projects').select('*').eq('is_active', true).order('position'); return (data || []) as Array<Project & { macro_project_id?: string }>; } });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: async () => { const { data } = await supabase.from('departments').select('*').eq('is_active', true).order('position'); return (data || []) as Department[]; } });

  function toggle(set: Set<string>, setFn: (s: Set<string>) => void, id: string) { const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); setFn(n); }
  function isActive(path: string) { return location.pathname === path; }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => { navigate('/'); onNavigate?.(); }}>
          <div className="h-7 w-7 rounded bg-primary flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" className="h-4 w-4"><path d="M8 16l5 5 11-11" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span className="font-bold text-sm">TaskFlow</span>
        </div>
      </div>
      <div className="px-2 py-2 space-y-0.5">
        <Button variant={isActive('/') ? 'secondary' : 'ghost'} className="w-full justify-start text-xs h-8" onClick={() => { navigate('/'); onNavigate?.(); }}><Home className="h-3.5 w-3.5 mr-2" />All Tasks</Button>
        {isAdmin && <Button variant={isActive('/settings') ? 'secondary' : 'ghost'} className="w-full justify-start text-xs h-8" onClick={() => { navigate('/settings'); onNavigate?.(); }}><Settings className="h-3.5 w-3.5 mr-2" />Settings</Button>}
      </div>
      <div className="px-3 pt-2 pb-1 border-t"><span className="text-[10px] font-semibold text-muted-foreground uppercase">Projects</span></div>
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-0.5 pb-4">
          {macroProjects.map((macro) => {
            const macroProjs = projects.filter((p) => (p as any).macro_project_id === macro.id);
            if (macroProjs.length === 0) return null;
            return (
              <div key={macro.id}>
                <div className="flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer hover:bg-accent" onClick={() => toggle(expandedMacros, setExpandedMacros, macro.id)}>
                  {expandedMacros.has(macro.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  <Briefcase className="h-3 w-3" style={{ color: macro.color }} />
                  <span className="font-semibold truncate">{macro.name}</span>
                </div>
                {expandedMacros.has(macro.id) && macroProjs.map((proj) => {
                  const projDepts = departments.filter((d) => d.project_id === proj.id);
                  return (
                    <div key={proj.id} className="ml-3">
                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] cursor-pointer hover:bg-accent ${isActive(`/project/${proj.id}`) ? 'bg-accent font-medium' : ''}`} onClick={() => { if (projDepts.length > 0) toggle(expandedProjects, setExpandedProjects, proj.id); else { navigate(`/project/${proj.id}`); onNavigate?.(); } }}>
                        {projDepts.length > 0 ? (expandedProjects.has(proj.id) ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />) : <span className="w-2.5" />}
                        <FolderOpen className="h-3 w-3 text-primary/60" />
                        <span className="truncate flex-1" onClick={(e) => { e.stopPropagation(); navigate(`/project/${proj.id}`); onNavigate?.(); }}>{proj.name}</span>
                      </div>
                      {expandedProjects.has(proj.id) && projDepts.map((dept) => (
                        <div key={dept.id} className={`ml-5 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] cursor-pointer hover:bg-accent ${isActive(`/project/${proj.id}/department/${dept.id}`) ? 'bg-accent font-medium' : ''}`} onClick={() => { navigate(`/project/${proj.id}/department/${dept.id}`); onNavigate?.(); }}>
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: (dept as any).color || '#6b7280' }} />
                          <span className="truncate">{dept.name}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {/* Unassigned projects */}
          {projects.filter((p) => !(p as any).macro_project_id).map((proj) => {
            const projDepts = departments.filter((d) => d.project_id === proj.id);
            return (
              <div key={proj.id}>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] cursor-pointer hover:bg-accent ${isActive(`/project/${proj.id}`) ? 'bg-accent font-medium' : ''}`} onClick={() => { navigate(`/project/${proj.id}`); onNavigate?.(); }}>
                  <FolderOpen className="h-3 w-3 text-muted-foreground" />
                  <span className="truncate">{proj.name}</span>
                </div>
                {projDepts.map((dept) => (
                  <div key={dept.id} className={`ml-5 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] cursor-pointer hover:bg-accent ${isActive(`/project/${proj.id}/department/${dept.id}`) ? 'bg-accent font-medium' : ''}`} onClick={() => { navigate(`/project/${proj.id}/department/${dept.id}`); onNavigate?.(); }}>
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: (dept as any).color || '#6b7280' }} />
                    <span className="truncate">{dept.name}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
