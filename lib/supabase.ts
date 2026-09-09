import { createBrowserClient } from '@supabase/ssr';

// The publishable key is safe to use in browser code. Keep the fallback only
// as a deployment safety net for previews where NEXT_PUBLIC_* variables may
// not have been attached to the deployment yet.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://gjruvyoykroerdlgxjcm.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_7s6wxgyKEy_cxHIm4R8MXQ_4PannqRs';

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}
