import { createClient } from '@supabase/supabase-js';

// Supabase public credentials — these are intentionally public (anon key).
// They are safe to commit: Supabase Row Level Security (RLS) protects all data.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://nyiclppnfayvbkxbaspw.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55aWNscHBuZmF5dmJreGJhc3B3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyOTM4MjcsImV4cCI6MjA5OTg2OTgyN30.CarSr0Sv8b37fk4Qq9ZdY1KSDp6T0wpMOyoNtCVD_TI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// isSupabaseConfigured is always true now since we have fallback values
export const isSupabaseConfigured = true;

// Keep-alive ping every 4 days to prevent Supabase free tier from pausing
// Only runs in the browser (not during SSR/build)
if (typeof window !== 'undefined') {
  const PING_INTERVAL_MS = 4 * 24 * 60 * 60 * 1000; // 4 days
  const ping = async () => {
    try {
      await supabase.from('master_statuses').select('id').limit(1);
    } catch (_) { /* silent */ }
  };
  // Ping once on load, then every 4 days
  ping();
  setInterval(ping, PING_INTERVAL_MS);
}
