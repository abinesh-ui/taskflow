// Supabase Edge Function: keep-alive
// Pings the database daily to prevent free-tier pause
// Deploy: supabase functions deploy keep-alive
// Schedule: every 24 hours via Supabase Dashboard or GitHub Actions cron

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async () => {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Simple query to keep the database awake
  const { count } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })

  return new Response(
    JSON.stringify({
      message: 'Keep-alive ping successful',
      projects_count: count,
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
