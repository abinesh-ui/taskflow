import { useNavigate, useLocation } from 'react-router-dom';
import { Home, FolderOpen, ListChecks, Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('read', false);
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const tabs = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: FolderOpen, label: 'Projects', path: '/projects-mobile' },
    { icon: ListChecks, label: 'My Tasks', path: '/my-tasks' },
    { icon: Bell, label: 'Alerts', path: '/notifications', badge: unreadCount },
  ];

  function isActive(path: string) {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map((tab) => (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors relative ${
              isActive(tab.path)
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{tab.label}</span>
            {tab.badge && tab.badge > 0 && (
              <span className="absolute -top-0.5 right-1 bg-destructive text-destructive-foreground text-[9px] rounded-full h-4 w-4 flex items-center justify-center">
                {tab.badge > 9 ? '9+' : tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
