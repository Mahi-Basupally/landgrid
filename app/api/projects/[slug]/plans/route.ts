import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserFromSession, getMembership } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

function normalizeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function findProject(slug: string) {
  const db = supabaseAdmin();
  const { data: exact, error: exactError } = await db.from('projects').select('id,slug,name,created_by').eq('slug', slug).maybeSingle();
  if (exactError) throw exactError;
  if (exact) return exact;

  const { data, error } = await db.from('projects').select('id,slug,name,created_by');
  if (error) throw error;
  return (data || []).find((p) => normalizeSlug(p.slug) === normalizeSlug(slug)) || null;
}

async function requireAdmin(slug: string) {
  const token = (await cookies()).get('landgrid_user')?.value;
  const user = await getUserFromSession(token);
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const project = await findProject(slug);
  if (!project) return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }) };

  // The project creator is always an admin. This also repairs legacy projects
  // where membership was not present but created_by was correctly set.
  const role = await getMembership(user.id, project.slug);
  if (role !== 'admin' && project.created_by !== user.id) {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }
  return { user, project };
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const project = await findProject(slug);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const { data, error } = await supabaseAdmin()
      .from('project_site_plans')
      .select('id,project_id,plan_type,map_url,drone_url,created_at,updated_at')
      .eq('project_id', project.id)
      .order('plan_type', { ascending: true });
    if (error) throw error;

    return NextResponse.json({ plans: data || [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('project plans GET failed', error);
    return NextResponse.json({ error: 'Unable to load project plans.' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const access = await requireAdmin(slug);
    if (access.error) return access.error;

    const body = await req.json().catch(() => ({}));
    const requestedType = String(body.planType || '').trim().toLowerCase();
    const planType = requestedType === 'master_plan' ? 'master_plan' : /^section_\d+$/.test(requestedType) ? requestedType : '';
    if (!planType) return NextResponse.json({ error: 'planType must be master_plan or section_N.' }, { status: 400 });

    const { data, error } = await supabaseAdmin()
      .from('project_site_plans')
      .upsert({ project_id: access.project.id, plan_type: planType }, { onConflict: 'project_id,plan_type' })
      .select('id,project_id,plan_type,map_url,drone_url,created_at,updated_at')
      .single();
    if (error) throw error;

    return NextResponse.json({ plan: data }, { status: 201 });
  } catch (error) {
    console.error('project plans POST failed', error);
    return NextResponse.json({ error: 'Unable to create project plan.' }, { status: 500 });
  }
}
