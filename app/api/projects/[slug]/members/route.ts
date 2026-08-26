import { NextResponse } from 'next/server';
import { getMembership, getUserFromSession, getUserById, readMemberships, upsertUser, Role } from '@/lib/auth';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

async function currentUser() { return getUserFromSession((await cookies()).get('landgrid_user')?.value); }
function normalizeSlug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]/g, ''); }
async function findProject(slug: string) {
  const db = supabaseAdmin();
  const { data, error } = await db.from('projects').select('id,slug,name,created_by').eq('slug', slug).maybeSingle();
  if (error) throw error;
  if (data) return data;
  const { data: projects, error: listError } = await db.from('projects').select('id,slug,name,created_by');
  if (listError) throw listError;
  return (projects || []).find(p => normalizeSlug(p.slug) === normalizeSlug(slug)) || null;
}
async function authorize(slug: string) {
  const user = await currentUser();
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  const project = await findProject(slug);
  if (!project) return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }) };
  const role = await getMembership(user.id, project.slug);
  if (role !== 'admin' && project.created_by !== user.id) return { error: NextResponse.json({ error: 'Admin access required.' }, { status: 403 }) };
  return { user, project };
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params; const auth = await authorize(slug); if ('error' in auth) return auth.error;
    const memberships = (await readMemberships()).filter(m => m.projectSlug === auth.project.slug);
    const members = await Promise.all(memberships.map(async m => { const member = await getUserById(m.userId); return { userId: m.userId, email: member?.email || '', name: member?.name || null, role: m.role }; }));
    return NextResponse.json({ members });
  } catch (error) { console.error('project members GET failed', error); return NextResponse.json({ error: 'Unable to load project members.' }, { status: 500 }); }
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params; const auth = await authorize(slug); if ('error' in auth) return auth.error;
    const { email, role = 'sales' } = await req.json(); const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    if (role !== 'admin' && role !== 'sales') return NextResponse.json({ error: 'Role must be admin or sales' }, { status: 400 });
    const user = await upsertUser(normalized); const memberships = await readMemberships();
    if (memberships.some(m => m.projectSlug === auth.project.slug && m.userId === user.id)) return NextResponse.json({ error: 'User is already a member' }, { status: 409 });
    const { data, error } = await supabaseAdmin().from('project_members').insert({ project_id: auth.project.id, user_id: user.id, role: role as Role }).select('project_id,user_id,role').single();
    if (error) throw error; return NextResponse.json({ userId: data.user_id, projectSlug: auth.project.slug, role: data.role }, { status: 201 });
  } catch (error) { console.error('add member failed', error); return NextResponse.json({ error: 'Unable to add project member.' }, { status: 500 }); }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params; const auth = await authorize(slug); if ('error' in auth) return auth.error;
    const body = await req.json(); const userId = String(body.userId || ''); const role = body.role;
    if (!userId || (role !== 'admin' && role !== 'sales')) return NextResponse.json({ error: 'Valid userId and role are required' }, { status: 400 });
    const { error } = await supabaseAdmin().from('project_members').update({ role }).eq('project_id', auth.project.id).eq('user_id', userId);
    if (error) throw error; return NextResponse.json({ ok: true });
  } catch (error) { console.error('update member failed', error); return NextResponse.json({ error: 'Unable to update project member.' }, { status: 500 }); }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params; const auth = await authorize(slug); if ('error' in auth) return auth.error;
    const body = await req.json(); const userId = String(body.userId || '');
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    if (userId === auth.project.created_by) return NextResponse.json({ error: 'The project owner cannot be removed.' }, { status: 400 });
    const { error } = await supabaseAdmin().from('project_members').delete().eq('project_id', auth.project.id).eq('user_id', userId);
    if (error) throw error; return NextResponse.json({ ok: true });
  } catch (error) { console.error('remove member failed', error); return NextResponse.json({ error: 'Unable to remove project member.' }, { status: 500 }); }
}
