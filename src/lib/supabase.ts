import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
