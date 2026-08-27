import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createServerSupabase } from '@/lib/supabaseServer';
import { NextResponse } from 'next/server';

export type Role = 'admin' | 'sales';
export type User = { id: string; email: string; name?: string };

// ── Get current user from Supabase session (server components / API routes) ──
export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = await createServerSupabase();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    // Sync to users table
    await supabaseAdmin()
      .from('users')
      .upsert({ id: user.id, email: user.email!, name: user.user_metadata?.full_name || null },
               { onConflict: 'id' });
    return { id: user.id, email: user.email!, name: user.user_metadata?.full_name };
  } catch { return null; }
}

// ── Legacy: used in server page components via cookies ──
export async function getUserFromSession(_token: string | undefined): Promise<User | null> {
  return getCurrentUser();
}

// ── Used by API routes that need a Supabase session ──
export async function getCurrentUserFromRequest(_req: Request): Promise<User | null> {
  return getCurrentUser();
}

// ── Get role for a user on a project ──
export async function getMembership(userId: string, projectSlug: string): Promise<Role | null> {
  const { data } = await supabaseAdmin()
    .from('project_members')
    .select('role,projects!inner(slug)')
    .eq('user_id', userId)
    .eq('projects.slug', projectSlug)
    .maybeSingle();
  return (data?.role as Role) || null;
}

// ── requireAdmin: used in API POST/PUT/DELETE routes ──
export async function requireAdmin(slug: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) };

  const db = supabaseAdmin();
  const { data: project } = await db.from('projects').select('id,slug,name,created_by').eq('slug', slug).maybeSingle();
  if (!project) return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }) };

  const isCreator = project.created_by === user.id;
  const role = await getMembership(user.id, slug);
  if (!isCreator && role !== 'admin') {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }
  return { user, project, role: isCreator ? 'admin' : role };
}

// ── Upsert user from auth (called after OAuth) ──
export async function upsertUser(email: string, id?: string, name?: string): Promise<User> {
  const db = supabaseAdmin();
  if (id) {
    await db.from('users').upsert({ id, email, name: name || null }, { onConflict: 'id' });
    return { id, email, name };
  }
  const { data } = await db.from('users').select('id,email,name').eq('email', email).maybeSingle();
  if (data) return data;
  const { data: inserted } = await db.from('users').insert({ email }).select('id,email,name').single();
  return inserted!;
}

export type Membership = { userId: string; projectSlug: string; role: Role };

export async function readMemberships(): Promise<Membership[]> {
  const { data } = await supabaseAdmin().from('project_members').select('user_id,projects!inner(slug),role');
  return (data || []).map((m: any) => ({ userId: m.user_id, projectSlug: m.projects.slug, role: m.role }));
}

export async function writeMemberships(_value: Membership[]) {
  throw new Error('Use project member APIs to change memberships.');
}

// Legacy exports kept for compatibility
export const SESSION_COOKIE = 'sb-access-token';
export function sessionCookie(_token: string, _expiresAt: string) { return ''; }
export function loginCode() { return process.env.LANDGRID_LOGIN_CODE || '123456'; }

// Legacy exports for backward compatibility
export async function getUserById(id: string): Promise<User | null> {
  const { data } = await supabaseAdmin().from('users').select('id,email,name').eq('id', id).maybeSingle();
  return data;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const { data } = await supabaseAdmin().from('users').select('id,email,name').eq('email', email).maybeSingle();
  return data;
}

export async function createSession(_userId: string) {
  return { token: '', expiresAt: '' };
}
