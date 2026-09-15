-- ============================================================
-- FIX: Security Definer View lint error on public.v_tasks_report
-- ============================================================
-- Problem: The view defaulted to SECURITY DEFINER, so it ran with the
-- creator's privileges and could bypass Row Level Security (RLS) on the
-- underlying tasks table when queried via the Supabase Data API.
--
-- Fix: Recreate the view with security_invoker = true so it enforces the
-- querying user's permissions and RLS policies. Then restrict grants so
-- only authenticated users can read it and anon cannot.
-- ============================================================

-- Recreate the view with SECURITY INVOKER (Postgres 15+ / Supabase supports this)
ALTER VIEW public.v_tasks_report SET (security_invoker = true);

-- Lock down access: only authenticated users may read the report; block anon.
REVOKE ALL ON public.v_tasks_report FROM anon;
GRANT SELECT ON public.v_tasks_report TO authenticated;

-- Verify (optional): should return the view with security_invoker enabled
-- SELECT relname, reloptions FROM pg_class WHERE relname = 'v_tasks_report';
