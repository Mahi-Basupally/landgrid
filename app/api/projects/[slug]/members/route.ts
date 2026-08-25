import { NextResponse } from 'next/server';
import { getMembership, getUserById, readMemberships, upsertUser, Membership, Role } from '@/lib/auth';

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
    const { data: project, error: projectError } = await supabaseAdmin().from('projects').select('id').eq('slug', slug).single();
    if (projectError || !project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const { data, error } = await supabaseAdmin()
      .from('project_members')
      .insert({ project_id: project.id, user_id: user.id, role: role as Role })
      .select('project_id,user_id,role')
      .single();
    if (error) throw error;

    return NextResponse.json({ userId: data.user_id, projectSlug: slug, role: data.role }, { status: 201 });
  } catch (error) {
    console.error('add member failed', error);
    return NextResponse.json({ error: 'Unable to add project member.' }, { status: 500 });
  }
}
