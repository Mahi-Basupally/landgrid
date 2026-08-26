import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getMembership, getUserFromSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

async function projectFor(slug: string) {
  const db = supabaseAdmin();
  const { data, error } = await db.from('projects').select('id,slug,created_by').eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data;
}

async function requireAdmin(slug: string) {
  const token = (await cookies()).get('landgrid_user')?.value;
  const user = await getUserFromSession(token);
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const project = await projectFor(slug);
  if (!project) return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }) };
  const role = await getMembership(user.id, project.slug);
  if (role !== 'admin' && project.created_by !== user.id) return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  return { user, project };
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const auth = await requireAdmin(slug);
    if ('error' in auth) return auth.error;
    const { data, error } = await supabaseAdmin().from('project_owners').select('id,name,email,phone,notes,created_at,updated_at').eq('project_id', auth.project.id).order('name');
    if (error) throw error;
    return NextResponse.json({ owners: data || [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[owners-get]', error);
    return NextResponse.json({ error: 'Unable to load owners' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const auth = await requireAdmin(slug);
    if ('error' in auth) return auth.error;
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: 'Owner name is required' }, { status: 400 });
    const { data, error } = await supabaseAdmin().from('project_owners').insert({ project_id: auth.project.id, name, email: String(body.email || '').trim() || null, phone: String(body.phone || '').trim() || null, notes: String(body.notes || '').trim() || null }).select('id,name,email,phone,notes,created_at,updated_at').single();
    if (error) throw error;
    return NextResponse.json({ owner: data });
  } catch (error: any) {
    console.error('[owners-post]', error);
    const message = error?.code === '23505' ? 'An owner with this name already exists in this project' : 'Unable to create owner';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const auth = await requireAdmin(slug);
    if ('error' in auth) return auth.error;
    const body = await req.json().catch(() => ({}));
    const id = String(body.id || '');
    const name = String(body.name || '').trim();
    if (!id || !name) return NextResponse.json({ error: 'Owner id and name are required' }, { status: 400 });
    const { data, error } = await supabaseAdmin().from('project_owners').update({ name, email: String(body.email || '').trim() || null, phone: String(body.phone || '').trim() || null, notes: String(body.notes || '').trim() || null, updated_at: new Date().toISOString() }).eq('id', id).eq('project_id', auth.project.id).select('id,name,email,phone,notes,created_at,updated_at').single();
    if (error) throw error;
    return NextResponse.json({ owner: data });
  } catch (error) {
    console.error('[owners-patch]', error);
    return NextResponse.json({ error: 'Unable to update owner' }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const auth = await requireAdmin(slug);
    if ('error' in auth) return auth.error;
    const body = await req.json().catch(() => ({}));
    const id = String(body.id || '');
    if (!id) return NextResponse.json({ error: 'Owner id is required' }, { status: 400 });
    const { error } = await supabaseAdmin().from('project_owners').delete().eq('id', id).eq('project_id', auth.project.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[owners-delete]', error);
    return NextResponse.json({ error: 'Unable to delete owner' }, { status: 400 });
  }
}
