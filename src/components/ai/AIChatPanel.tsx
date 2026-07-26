import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageCircle, Send, X, Minimize2, Maximize2 } from 'lucide-react';
import type { Task, MasterStatus } from '@/types/database';

interface Message { role: 'user' | 'ai'; content: string; timestamp: Date; }

export default function AIChatPanel() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ role: 'ai', content: "Hi! I'm your TaskFlow AI assistant. Ask me about your tasks, projects, team workload, overdue items, or anything about your work. I can analyze patterns and give recommendations.", timestamp: new Date() }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: allTasks = [] } = useQuery({ queryKey: ['all-tasks'], queryFn: async () => { const { data } = await supabase.from('tasks').select('*'); return (data || []) as Task[]; } });
  const { data: statuses = [] } = useQuery({ queryKey: ['master_statuses'], queryFn: async () => { const { data } = await supabase.from('master_statuses').select('*').order('position'); return (data || []) as MasterStatus[]; } });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: async () => { const { data } = await supabase.from('projects').select('*').eq('is_active', true); return (data || []) as Array<{ id: string; name: string }>; } });
  const { data: members = [] } = useQuery({ queryKey: ['master_members'], queryFn: async () => { const { data } = await supabase.from('master_members').select('*').eq('is_active', true); return (data || []) as Array<{ id: string; name: string }>; } });

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  function buildContext() {
    const today = new Date().toISOString().split('T')[0];
    const closedIds = statuses.filter((s) => s.is_closed).map((s) => s.id);
    const topTasks = allTasks.filter((t) => !t.parent_id);
    const openTasks = topTasks.filter((t) => !closedIds.includes(t.status_id));
    const overdue = openTasks.filter((t) => t.planned_end_date && t.planned_end_date < today);

    return `You are TaskFlow AI - a project management assistant. Here is the current data context:
- Total tasks: ${topTasks.length} (${allTasks.length - topTasks.length} subtasks)
- Open tasks: ${openTasks.length}
- Overdue tasks: ${overdue.length}
- Projects: ${projects.map((p) => p.name).join(', ')}
- Team members: ${members.map((m) => m.name).join(', ')}
- Status options: ${statuses.map((s) => s.name).join(', ')}
- Today: ${today}

Top overdue tasks: ${overdue.slice(0, 5).map((t) => `"${t.title}" (due ${t.planned_end_date}, assigned to ${members.find((m) => m.id === t.assignee_id)?.name || 'unassigned'})`).join('; ')}

Task breakdown by status: ${statuses.map((s) => `${s.name}: ${topTasks.filter((t) => t.status_id === s.id).length}`).join(', ')}

Task breakdown by project: ${projects.map((p) => `${p.name}: ${topTasks.filter((t) => t.project_id === p.id).length} tasks`).join(', ')}

Team workload (open tasks): ${members.map((m) => `${m.name}: ${openTasks.filter((t) => t.assignee_id === m.id).length}`).join(', ')}

Answer the user's question based on this data. Be concise, actionable, and highlight risks. Use bullet points for lists. If asked for recommendations, prioritize by urgency and impact.`;
  }

  async function handleSend() {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: input.trim(), timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) { setMessages((prev) => [...prev, { role: 'ai', content: 'API key not configured. Add VITE_GEMINI_API_KEY in Vercel environment variables.', timestamp: new Date() }]); setLoading(false); return; }
      const context = buildContext();

      // Try the generateContent endpoint with x-goog-api-key header
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: context }] },
            { role: 'model', parts: [{ text: 'Understood. I have the TaskFlow data context. How can I help?' }] },
            ...messages.filter((m) => m.role === 'user').slice(-5).map((m) => ({ role: 'user', parts: [{ text: m.content }] })),
            { role: 'user', parts: [{ text: input.trim() }] },
          ],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // If gemini-2.0-flash fails, try gemini-1.5-flash
        const response2 = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [
              { role: 'user', parts: [{ text: context }] },
              { role: 'model', parts: [{ text: 'Understood. I have the TaskFlow data context. How can I help?' }] },
              { role: 'user', parts: [{ text: input.trim() }] },
            ],
          }),
        });
        const data2 = await response2.json();
        if (!response2.ok) {
          setMessages((prev) => [...prev, { role: 'ai', content: `API Error (${response2.status}): ${JSON.stringify(data2?.error?.message || data2?.error || 'Unknown error')}`, timestamp: new Date() }]);
          setLoading(false); return;
        }
        const aiText2 = data2?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
        setMessages((prev) => [...prev, { role: 'ai', content: aiText2, timestamp: new Date() }]);
        setLoading(false); return;
      }

      const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
      setMessages((prev) => [...prev, { role: 'ai', content: aiText, timestamp: new Date() }]);
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: 'ai', content: `Connection error: ${err?.message || 'Network issue'}. Check browser console for details.`, timestamp: new Date() }]);
    }
    setLoading(false);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="fixed bottom-4 right-4 h-12 w-12 rounded-full bg-primary text-white shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors z-50" title="AI Assistant">
        <MessageCircle className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className={`fixed right-4 bottom-4 z-50 bg-card border rounded-xl shadow-2xl flex flex-col transition-all ${minimized ? 'w-72 h-12' : 'w-96 h-[500px]'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-primary/5 rounded-t-xl">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold">TaskFlow AI</span>
          {loading && <span className="text-[9px] text-muted-foreground animate-pulse">Thinking...</span>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMinimized(!minimized)} className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted">{minimized ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}</button>
          <button onClick={() => setOpen(false)} className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted"><X className="h-3 w-3" /></button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-lg text-xs leading-relaxed ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-muted'}`}>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}
            {loading && <div className="flex justify-start"><div className="bg-muted px-3 py-2 rounded-lg text-xs animate-pulse">Analyzing your data...</div></div>}
          </div>

          {/* Input */}
          <div className="p-2 border-t flex gap-1.5">
            <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }} placeholder="Ask about tasks, team, projects..." className="h-8 text-xs" />
            <Button size="icon" className="h-8 w-8" onClick={handleSend} disabled={!input.trim() || loading}><Send className="h-3.5 w-3.5" /></Button>
          </div>
        </>
      )}
    </div>
  );
}
