import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserFromSession, getMembership } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const allowed = new Set(['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']);

function normalizeSlug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]/g, ''); }

async function findProject(requestedSlug: string) {
  const db = supabaseAdmin();
  const { data: exact, error } = await db.from('projects').select('id,slug,site_plan_url,drone_url').eq('slug', requestedSlug).maybeSingle();
  if (error) throw error;
  if (exact) return exact;
  const { data: projects, error: listError } = await db.from('projects').select('id,slug,site_plan_url,drone_url');
  if (listError) throw listError;
  return (projects || []).find((p) => normalizeSlug(p.slug) === normalizeSlug(requestedSlug)) || null;
}

function storagePathFromUrl(value: string | null | undefined) {
  if (!value) return null;
  if (value.startsWith('storage://')) return value.slice('storage://'.length);
  const marker = '/storage/v1/object/public/project-assets/';
  const index = value.indexOf(marker);
  return index >= 0 ? decodeURIComponent(value.slice(index + marker.length)) : null;
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: requestedSlug } = await params;
  const token = (await cookies()).get('landgrid_user')?.value;
  const user = await getUserFromSession(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const project = await findProject(requestedSlug);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  const role = await getMembership(user.id, project.slug);
  if (role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const form = await req.formData();
  const file = form.get('file');
  const kind = String(form.get('kind') || 'media');
  const sectionId = String(form.get('sectionId') || '');
  if (!(file instanceof File)) return NextResponse.json({ error: 'File is required' }, { status: 400 });
  if (!allowed.has(file.type)) return NextResponse.json({ error: `Unsupported file type: ${file.type || 'unknown'}` }, { status: 400 });
  if (file.size > 50 * 1024 * 1024) return NextResponse.json({ error: 'File must be 50MB or smaller' }, { status: 400 });

  const sectionKind = kind === 'section-master-plan' || kind === 'section-drone';
  if (sectionKind && !sectionId) return NextResponse.json({ error: 'sectionId is required' }, { status: 400 });
  if (sectionKind) {
    const { data: section } = await supabaseAdmin().from('project_sections').select('id').eq('id', sectionId).eq('project_id', project.id).maybeSingle();
    if (!section) return NextResponse.json({ error: 'Section not found' }, { status: 404 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `projects/${project.id}/${sectionKind ? `sections/${sectionId}/${kind}` : kind}/${Date.now()}-${safeName}`;
  const db = supabaseAdmin();
  const { error: uploadError } = await db.storage.from('project-assets').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false, cacheControl: '31536000' });
  if (uploadError) return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 });

  const storedValue = `storage://${path}`;
  if (sectionKind) {
    const field = kind === 'section-master-plan' ? 'master_plan_url' : 'drone_url';
    const { error } = await db.from('project_sections').update({ [field]: storedValue }).eq('id', sectionId).eq('project_id', project.id);
    if (error) return NextResponse.json({ error: `Section update failed: ${error.message}` }, { status: 500 });
    return NextResponse.json({ ok: true, path, kind, sectionId, savedValue: storedValue });
  }

  if (kind === 'master-plan' || kind === 'drone') {
    const field = kind === 'master-plan' ? 'site_plan_url' : 'drone_url';
    const { error } = await db.from('projects').update({ [field]: storedValue }).eq('id', project.id);
    if (error) return NextResponse.json({ error: `Project update failed: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, path, kind, projectSlug: project.slug, savedValue: storedValue });
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: requestedSlug } = await params;
  const url = new URL(req.url);
  const kind = url.searchParams.get('kind');
  const sectionId = url.searchParams.get('section');
  const validKind = kind === 'master-plan' || kind === 'drone' || kind === 'section-master-plan' || kind === 'section-drone';
  if (!validKind) return NextResponse.json({ error: 'Invalid asset kind' }, { status: 400 });

  const project = await findProject(requestedSlug);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  let storedValue: string | null = null;
  if (kind.startsWith('section-')) {
    if (!sectionId) return NextResponse.json({ error: 'section is required' }, { status: 400 });
    const { data: section, error } = await supabaseAdmin().from('project_sections').select('master_plan_url,drone_url').eq('id', sectionId).eq('project_id', project.id).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    storedValue = kind === 'section-master-plan' ? section?.master_plan_url || null : section?.drone_url || null;
  } else {
    storedValue = kind === 'master-plan' ? project.site_plan_url : project.drone_url;
  }

  const storagePath = storagePathFromUrl(storedValue);
  if (!storagePath) return NextResponse.json({ error: 'Asset not configured' }, { status: 404 });
  const { data, error } = await supabaseAdmin().storage.from('project-assets').download(storagePath);
  if (error || !data) return NextResponse.json({ error: `Storage download failed: ${error?.message || 'file not found'}` }, { status: 404 });

  const lower = storagePath.toLowerCase();
  const contentType = data.type || (lower.endsWith('.svg') ? 'image/svg+xml' : lower.endsWith('.png') ? 'image/png' : lower.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
  return new NextResponse(data, { status: 200, headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable', 'Content-Disposition': 'inline' } });
}
