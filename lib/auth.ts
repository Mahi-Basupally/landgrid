import crypto from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type Role = 'admin' | 'sales';
export type User = { id: string; email: string; name?: string };
export type Membership = { userId: string; projectSlug: string; role: Role };

const SESSION_COOKIE = 'landgrid_user';
const SESSION_DAYS = 30;

export function appConfig() {
  return { LANDGRID_LOGIN_CODE: process.env.LANDGRID_LOGIN_CODE || '123456' };
}

export function loginCode() {
  return process.env.LANDGRID_LOGIN_CODE || appConfig().LANDGRID_LOGIN_CODE;
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const { data, error } = await supabaseAdmin().from('users').select('id,email,name').eq('email', email).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getUserById(id: string): Promise<User | null> {
  const { data, error } = await supabaseAdmin().from('users').select('id,email,name').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertUser(email: string): Promise<User> {
  const existing = await findUserByEmail(email);
  if (existing) return existing;
  const { data, error } = await supabaseAdmin().from('users').insert({ email }).select('id,email,name').single();
  if (error) throw error;
  return data;
}

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabaseAdmin().from('auth_sessions').insert({ token_hash: hashToken(token), user_id: userId, expires_at: expiresAt });
  if (error) throw error;
  return { token, expiresAt };
}

export async function getUserFromSession(token: string | undefined): Promise<User | null> {
  if (!token) return null;
  const { data, error } = await supabaseAdmin().from('auth_sessions').select('user_id,expires_at,users(id,email,name)').eq('token_hash', hashToken(token)).maybeSingle();
  if (error) throw error;
  if (!data || new Date(data.expires_at).getTime() <= Date.now()) return null;
  return Array.isArray(data.users) ? data.users[0] || null : data.users;
}

export async function getCurrentUserFromRequest(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const token = cookie.split(';').map(v => v.trim()).find(v => v.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  return getUserFromSession(token);
}

export function sessionCookie(token: string, expiresAt: string) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 60 * 60}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

export async function readMemberships(): Promise<Membership[]> {
  const { data, error } = await supabaseAdmin().from('project_members').select('user_id,projects!inner(slug),role');
  if (error) throw error;
  return (data || []).map((m: any) => ({ userId: m.user_id, projectSlug: m.projects.slug, role: m.role }));
}

export async function writeMemberships(_value: Membership[]) {
  throw new Error('Use project member APIs to change memberships.');
}

export async function getMembership(userId: string, projectSlug: string): Promise<Role | null> {
  const { data, error } = await supabaseAdmin().from('project_members').select('role,projects!inner(slug)').eq('user_id', userId).eq('projects.slug', projectSlug).maybeSingle();
  if (error) throw error;
  return data?.role || null;
}

export { SESSION_COOKIE };
