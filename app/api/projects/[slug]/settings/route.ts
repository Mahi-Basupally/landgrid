import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserFromSession, getMembership } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

async function currentUser() {
  const cookieStore = await cookies();
  return getUserFromSession(cookieStore.get('landgrid_user')?.value);
}

async function findProject(slug: string) {
  const db = supabaseAdmin();
  const { data, error } = await db.from('projects').select('id,slug,created_by').eq('slug', slug).maybeSingle();
  if (error) throw error;
  if (data) return data;
  const normalize = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');
  const { data: projects, error: listError } = await db.from('projects').select('id,slug,created_by');
  if (listError) throw listError;
  return (projects || []).find(p => normalize(p.slug) === normalize(slug)) || null;
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const project = await findProject(slug);
    if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    const role = await getMembership(user.id, project.slug);
    if (role !== 'admin' && project.created_by !== user.id) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

    const type = req.headers.get('content-type') || '';
    const body: any = type.includes('application/json') ? await req.json() : Object.fromEntries(await (await req.formData()).entries());
    const name = String(body.name || '').trim();
    const address = String(body.address || '').trim();
    if (!name || !address) return NextResponse.json({ error: 'Project name and address are required.' }, { status: 400 });

    const { error } = await supabaseAdmin().from('projects').update({
      name,
      address,
      description: String(body.description || '').trim() || null,
      google_location_url: String(body.googleLocationUrl ?? body.google_location_url ?? '').trim() || null,
      is_public: body.is_public === true || body.is_public === 'true' || body.isPublic === true || body.isPublic === 'true',
    }).eq('id', project.id);
    if (error) throw error;

    if (type.includes('application/json')) return NextResponse.json({ ok: true });
    return NextResponse.redirect(new URL(`/projects/${project.slug}/settings?saved=1`, req.url));
  } catch (error) {
    console.error('project settings update failed', error);
    return NextResponse.json({ error: 'Unable to save project settings.' }, { status: 500 });
  }
}
