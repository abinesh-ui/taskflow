// Supabase Edge Function: process-alerts
// Run on a schedule (cron) to evaluate alert rules and send notifications
// Deploy: supabase functions deploy process-alerts
// Schedule via Supabase Dashboard -> Edge Functions -> Schedules

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async () => {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // 1. Get active alert rules
  const { data: rules } = await supabase
    .from('alert_rules')
    .select('*')
    .eq('is_active', true)

  if (!rules || rules.length === 0) {
    return new Response(JSON.stringify({ message: 'No active rules' }), { status: 200 })
  }

  // 2. Get all open tasks with their status info
  const { data: statuses } = await supabase
    .from('master_statuses')
    .select('id, is_closed')

  const closedStatusIds = (statuses || []).filter(s => s.is_closed).map(s => s.id)

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, task_no, title, assignee_id, status_id, planned_end_date')
    .not('status_id', 'in', `(${closedStatusIds.join(',')})`)

  if (!tasks) {
    return new Response(JSON.stringify({ message: 'No open tasks' }), { status: 200 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const notifications: Array<{ user_id: string; task_id: string; type: string; message: string }> = []

  for (const rule of rules) {
    const config = rule.config as Record<string, any>

    if (rule.rule_type === 'before_due') {
      const daysBefore = config.days_before || 1
      const targetDate = new Date(today)
      targetDate.setDate(targetDate.getDate() + daysBefore)
      const targetStr = targetDate.toISOString().split('T')[0]

      for (const task of tasks) {
        if (task.planned_end_date === targetStr && task.assignee_id) {
          notifications.push({
            user_id: task.assignee_id,
            task_id: task.id,
            type: 'reminder',
            message: `Task ${task.task_no} "${task.title}" is due in ${daysBefore} day(s).`,
          })
        }
      }
    }

    if (rule.rule_type === 'on_overdue') {
      const todayStr = today.toISOString().split('T')[0]
      for (const task of tasks) {
        if (task.planned_end_date && task.planned_end_date < todayStr && task.assignee_id) {
          notifications.push({
            user_id: task.assignee_id,
            task_id: task.id,
            type: 'overdue',
            message: `Task ${task.task_no} "${task.title}" is overdue!`,
          })
        }
      }
    }
  }

  // 3. Insert notifications (deduplicate by not inserting if same notification exists today)
  if (notifications.length > 0) {
    const todayStart = new Date(today).toISOString()
    for (const n of notifications) {
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', n.user_id)
        .eq('task_id', n.task_id)
        .eq('type', n.type)
        .gte('created_at', todayStart)
        .limit(1)

      if (!existing || existing.length === 0) {
        await supabase.from('notifications').insert(n)
      }
    }
  }

  return new Response(
    JSON.stringify({ message: `Processed ${rules.length} rules, generated ${notifications.length} notifications` }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
