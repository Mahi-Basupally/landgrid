import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserFromSession, getMembership } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const allowed = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'video/mp4',
  'video/webm',
]);

function normalizeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

type ProjectRow = { id: string; slug: string; created_by: string | null };

type PlanRow = {
  id: string;
  project_id: string;
  plan_type: string;
  map_url: string | null;
  drone_url: string | null;
};

async function findProject(requestedSlug: string): Promise<ProjectRow | null> {
  const db = supabaseAdmin();
  const { data: exactProject, error: exactError } = await db
    .from('projects')
    .select('id,slug,created_by')
    .eq('slug', requestedSlug)
    .maybeSingle();
  if (exactError) throw new Error(exactError.message);
  if (exactProject) return exactProject as ProjectRow;

  const { data: projects, error } = await db.from('projects').select('id,slug,created_by');
  if (error) throw new Error(error.message);
  return ((projects || []) as ProjectRow[]).find((p) => normalizeSlug(p.slug) === normalizeSlug(requestedSlug)) || null;
}

async function requireAdmin(project: ProjectRow) {
  const token = (await cookies()).get('landgrid_user')?.value;
  const user = await getUserFromSession(token);
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const role = await getMembership(user.id, project.slug);
  if (role !== 'admin' && project.created_by !== user.id) {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }
  return { user };
}

function storagePathFromUrl(value: string | null | undefined) {
  if (!value) return null;
  if (value.startsWith('storage://')) return value.slice('storage://'.length);
  const marker = '/storage/v1/object/public/project-assets/';
  const index = value.indexOf(marker);
  return index >= 0 ? decodeURIComponent(value.slice(index + marker.length)) : null;
}

function validPlanType(value: string) {
  return value === 'master_plan' || /^section_\d+$/.test(value);
}

async function getPlan(projectId: string, planType: string) {
  const { data, error } = await supabaseAdmin()
    .from('project_site_plans')
    .select('id,project_id,plan_type,map_url,drone_url')
    .eq('project_id', projectId)
    .eq('plan_type', planType)
    .maybeSingle();
  if (error) throw error;
  return data as PlanRow | null;
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: requestedSlug } = await params;
  const project = await findProject(requestedSlug);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const access = await requireAdmin(project);
  if (access.error) return access.error;

  const form = await req.formData();
  const file = form.get('file');
  const kind = String(form.get('kind') || 'media');
  const planType = String(form.get('planType') || 'master_plan').trim().toLowerCase();
  if (!(file instanceof File)) return NextResponse.json({ error: 'File is required' }, { status: 400 });
  if (!allowed.has(file.type)) return NextResponse.json({ error: `Unsupported file type: ${file.type || 'unknown'}` }, { status: 400 });
  if (file.size > 50 * 1024 * 1024) return NextResponse.json({ error: 'File must be 50MB or smaller' }, { status: 400 });

  if (kind === 'master-plan' || kind === 'drone') {
    if (!validPlanType(planType)) return NextResponse.json({ error: 'Invalid plan type' }, { status: 400 });

    const db = supabaseAdmin();
    const { error: planError } = await db.from('project_site_plans').upsert(
      { project_id: project.id, plan_type: planType },
      { onConflict: 'project_id,plan_type' },
    );
    if (planError) return NextResponse.json({ error: `Plan creation failed: ${planError.message}` }, { status: 500 });

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const storageKind = planType === 'master_plan'
      ? (kind === 'master-plan' ? 'master-plan' : 'drone')
      : `${planType}/${kind === 'master-plan' ? 'map' : 'drone'}`;
    const path = `projects/${project.id}/${storageKind}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await db.storage.from('project-assets').upload(path, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
      cacheControl: '31536000',
    });
    if (uploadError) {
      console.error('[asset-upload] storage upload failed', { projectId: project.id, slug: project.slug, planType, kind, path, error: uploadError });
      return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const field = kind === 'master-plan' ? 'map_url' : 'drone_url';
    const storedValue = `storage://${path}`;
    const { error: updateError } = await db.from('project_site_plans').update({ [field]: storedValue }).eq('project_id', project.id).eq('plan_type', planType);
    if (updateError) return NextResponse.json({ error: `Plan update failed: ${updateError.message}` }, { status: 500 });

    return NextResponse.json({
      ok: true,
      url: `/api/projects/${encodeURIComponent(project.slug)}/assets?kind=${encodeURIComponent(kind)}&planType=${encodeURIComponent(planType)}&v=${Date.now()}`,
      path,
      kind,
      planType,
      savedValue: storedValue,
    });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `projects/${project.id}/media/${Date.now()}-${safeName}`;
  const db = supabaseAdmin();
  const { error: uploadError } = await db.storage.from('project-assets').upload(path, file, {
    contentType: file.type || 'application/octet-stream', upsert: false, cacheControl: '31536000',
  });
  if (uploadError) return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 });

  return NextResponse.json({ ok: true, url: `/api/projects/${encodeURIComponent(project.slug)}/assets?kind=media&v=${Date.now()}`, path, kind });
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: requestedSlug } = await params;
  const url = new URL(req.url);
  const kind = url.searchParams.get('kind');
  const planType = (url.searchParams.get('planType') || 'master_plan').trim().toLowerCase();
  if (kind !== 'master-plan' && kind !== 'drone') return NextResponse.json({ error: 'Invalid asset kind' }, { status: 400 });
  if (!validPlanType(planType)) return NextResponse.json({ error: 'Invalid plan type' }, { status: 400 });

  const project = await findProject(requestedSlug);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  const plan = await getPlan(project.id, planType);
  if (!plan) return NextResponse.json({ error: 'Plan not configured' }, { status: 404 });

  const storedValue = kind === 'master-plan' ? plan.map_url : plan.drone_url;
  let storagePath = storagePathFromUrl(storedValue);
  if (!storagePath) return NextResponse.json({ error: 'Asset not configured' }, { status: 404 });

  const db = supabaseAdmin();
  const { data, error } = await db.storage.from('project-assets').download(storagePath);
  if (error || !data) return NextResponse.json({ error: `Storage download failed: ${error?.message || 'file not found'}` }, { status: 404 });

  const lower = storagePath.toLowerCase();
  const contentType = data.type || (lower.endsWith('.svg') ? 'image/svg+xml' : lower.endsWith('.png') ? 'image/png' : lower.endsWith('.jpg') || lower.endsWith('.jpeg') ? 'image/jpeg' : lower.endsWith('.webp') ? 'image/webp' : 'application/octet-stream');
  return new NextResponse(data, { status: 200, headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable', 'Content-Disposition': 'inline' } });
}
