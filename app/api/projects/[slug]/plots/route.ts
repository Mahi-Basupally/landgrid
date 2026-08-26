import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getMembership, getUserFromSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

async function access(slug: string) {
  const token = (await cookies()).get('landgrid_user')?.value;
  const user = await getUserFromSession(token);
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const db = supabaseAdmin();
  const { data: project, error } = await db.from('projects').select('id,slug,created_by').eq('slug', slug).maybeSingle();
  if (error) throw error;
  if (!project) return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }) };
  const role = await getMembership(user.id, project.slug);
  if (role !== 'admin' && project.created_by !== user.id) return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  return { project };
}

export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const auth = await access(slug);
    if ('error' in auth) return auth.error;
    const body = await req.json().catch(() => ({}));
    const id = String(body.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Plot id is required.' }, { status: 400 });
    const { error } = await supabaseAdmin().from('plots').delete().eq('id', id).eq('project_id', auth.project.id);
    if (error) throw error;
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error('plot DELETE failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to delete plot.' }, { status: 500 });
  }
}
