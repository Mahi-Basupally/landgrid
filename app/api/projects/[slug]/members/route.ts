import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getMembership, getUserFromSession, getUserById, readMemberships, upsertUser, Role } from '@/lib/auth';

async function currentUser() {
  const cookieStore = await cookies();
  return getUserFromSession(cookieStore.get('landgrid_user')?.value);
}

async function projectId(slug: string) {
  const { supabaseAdmin } = await import('@/lib/supabaseAdmin');
  const { data, error } = await supabaseAdmin().from('projects').select('id,slug,created_by').eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data;
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const project = await projectId(slug);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const role = await getMembership(user.id, slug);
    if (role !== 'admin' && project.created_by !== user.id) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

    const memberships = (await readMemberships()).filter(m => m.projectSlug === slug);
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
    const user = await upsertUser(normalized);
    const memberships = await readMemberships();
    if (memberships.some((m) => m.projectSlug === slug && m.userId === user.id)) {
      return NextResponse.json({ error: 'User is already a member' }, { status: 409 });
    }

    const { supabaseAdmin } = await import('@/lib/supabaseAdmin');
    const { data: project, error: projectError } = await supabaseAdmin().from('projects').select('id').eq('slug', slug).maybeSingle();
    if (projectError || !project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const { data, error } = await supabaseAdmin().from('project_members').insert({ project_id: project.id, user_id: user.id, role: role as Role }).select('project_id,user_id,role').single();
    if (error) throw error;
    return NextResponse.json({ userId: data.user_id, projectSlug: slug, role: data.role }, { status: 201 });
  } catch (error) {
    console.error('add member failed', error);
    return NextResponse.json({ error: 'Unable to add project member.' }, { status: 500 });
  }
}
