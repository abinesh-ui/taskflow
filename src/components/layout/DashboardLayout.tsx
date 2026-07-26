import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import MobileBottomNav from './MobileBottomNav';
import AIChatPanel from '@/components/ai/AIChatPanel';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`fixed md:relative z-50 h-full transition-transform duration-200 border-r bg-card w-64 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <Sidebar onNavigate={() => setSidebarOpen(false)} />
      </aside>
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-auto p-3 md:p-6 pb-20 md:pb-6">
          <Outlet />
        </main>
      </div>
      <MobileBottomNav />
      <AIChatPanel />
    </div>
  );
}
