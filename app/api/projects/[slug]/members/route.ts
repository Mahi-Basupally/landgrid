import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getMembership, getUserFromSession, getUserById, readMemberships, upsertUser, Role } from '@/lib/auth';

async function currentUser() {
  const cookieStore = await cookies();
  return getUserFromSession(cookieStore.get('landgrid_user')?.value);
}

function normalizeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function findProject(slug: string) {
  const { supabaseAdmin } = await import('@/lib/supabaseAdmin');
  const db = supabaseAdmin();
  const { data, error } = await db.from('projects').select('id,slug,name,created_by').eq('slug', slug).maybeSingle();
  if (error) throw error;
  if (data) return data;
  const { data: projects, error: listError } = await db.from('projects').select('id,slug,name,created_by');
  if (listError) throw listError;
  return (projects || []).find(p => normalizeSlug(p.slug) === normalizeSlug(slug)) || null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const project = await findProject(slug);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const role = await getMembership(user.id, project.slug);
    if (role !== 'admin' && project.created_by !== user.id) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    const memberships = (await readMemberships()).filter(m => m.projectSlug === project.slug);
    const members = await Promise.all(memberships.map(async membership => {
      const member = await getUserById(membership.userId);
      return { userId: membership.userId, email: member?.email || '', name: member?.name || null, role: membership.role };
    }));
    return NextResponse.json({ members });
  } catch (error) {
    console.error('project members GET failed', error);
    return NextResponse.json({ error: 'Unable to load project members.' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { email, role = 'sales' } = await req.json();
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  if (role !== 'admin' && role !== 'sales') return NextResponse.json({ error: 'Role must be admin or sales' }, { status: 400 });
  try {
    const project = await findProject(slug);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const actor = await currentUser();
    if (!actor) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const actorRole = await getMembership(actor.id, project.slug);
    if (actorRole !== 'admin' && project.created_by !== actor.id) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    const user = await upsertUser(normalized);
    const memberships = await readMemberships();
    if (memberships.some(m => m.projectSlug === project.slug && m.userId === user.id)) return NextResponse.json({ error: 'User is already a member' }, { status: 409 });
    const { supabaseAdmin } = await import('@/lib/supabaseAdmin');
    const { data, error } = await supabaseAdmin().from('project_members').insert({ project_id: project.id, user_id: user.id, role: role as Role }).select('project_id,user_id,role').single();
    if (error) throw error;
    return NextResponse.json({ userId: data.user_id, projectSlug: project.slug, role: data.role }, { status: 201 });
  } catch (error) {
    console.error('add member failed', error);
    return NextResponse.json({ error: 'Unable to add project member.' }, { status: 500 });
  }
}
