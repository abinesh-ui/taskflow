import { createClient } from '@supabase/supabase-js';

// Supabase public credentials — these are intentionally public (anon key).
// They are safe to commit: Supabase Row Level Security (RLS) protects all data.
const DIRECT_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://nyiclppnfayvbkxbaspw.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55aWNscHBuZmF5dmJreGJhc3B3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyOTM4MjcsImV4cCI6MjA5OTg2OTgyN30.CarSr0Sv8b37fk4Qq9ZdY1KSDp6T0wpMOyoNtCVD_TI';

// Some ISPs (e.g. ACT Broadband in India) block/hijack *.supabase.co domains,
// causing "cannot connect to server" login errors. To bypass this, when running
// on the deployed site we route all Supabase traffic through a Vercel proxy at
// "/sb" (see vercel.json rewrites). Vercel's servers reach Supabase fine, and the
// ISP only sees traffic to the Vercel domain (which it allows).
// Locally (dev) we use the direct URL.
const isBrowser = typeof window !== 'undefined';
const onVercel = isBrowser && window.location.hostname.endsWith('.vercel.app');
const supabaseUrl = onVercel ? `${window.location.origin}/sb` : DIRECT_SUPABASE_URL;

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
