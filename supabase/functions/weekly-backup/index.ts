// Supabase Edge Function: weekly-backup
// Exports key tables as JSON for backup (free tier has no auto-backups)
// Deploy: supabase functions deploy weekly-backup
// Schedule: weekly via GitHub Actions cron or Supabase schedule

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async () => {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const tables = ['projects', 'departments', 'tasks', 'task_status_history', 'comments', 'profiles']
  const backup: Record<string, any[]> = {}

  for (const table of tables) {
    const { data } = await supabase.from(table).select('*')
    backup[table] = data || []
  }

  const backupJson = JSON.stringify(backup, null, 2)
  const fileName = `backup_${new Date().toISOString().split('T')[0]}.json`

  // Store in Supabase Storage
  const { error } = await supabase.storage
    .from('backups')
    .upload(fileName, new Blob([backupJson], { type: 'application/json' }), {
      upsert: true,
    })

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({
      message: `Backup saved as ${fileName}`,
      tables: Object.keys(backup).map(t => `${t}: ${backup[t].length} rows`),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
