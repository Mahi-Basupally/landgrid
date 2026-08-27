import { NextResponse } from 'next/server';
import { getCurrentUser, getMembership } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeSlug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]/g, ''); }

function parseStorage(value: string) {
  const raw = value.trim();
  if (raw.startsWith('storage://')) {
    const stored = decodeURIComponent(raw.slice('storage://'.length).replace(/^\/+/, ''));
    // storage://bucket/path is the canonical format used by LandGrid.
    const slash = stored.indexOf('/');
    if (slash > 0) return { bucket: stored.slice(0, slash), path: stored.slice(slash + 1) };
    return { bucket: 'project-assets', path: stored };
  }
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) return { bucket: 'project-assets', path: decodeURIComponent(raw.replace(/^\/+/, '')) };
  const marker = '/storage/v1/object/';
  const markerIndex = raw.indexOf(marker);
  if (markerIndex >= 0) {
    const rest = raw.slice(markerIndex + marker.length).replace(/^\//, '');
    const parts = rest.split('/');
    if (parts[0] === 'public' || parts[0] === 'authenticated') parts.shift();
    if (parts.length >= 2) return { bucket: decodeURIComponent(parts[0]), path: decodeURIComponent(parts.slice(1).join('/').split('?')[0]) };
  }
  const fallbackMarker = '/project-assets/';
  const index = raw.indexOf(fallbackMarker);
  return index >= 0 ? { bucket: 'project-assets', path: decodeURIComponent(raw.slice(index + fallbackMarker.length).split('?')[0]) } : null;
}

async function findProject(slug: string) {
  const db = supabaseAdmin();
  const { data: exact, error: exactError } = await db.from('projects').select('id,slug,is_public').eq('slug', slug).maybeSingle();
  if (exactError) throw exactError;
  if (exact) return exact;
  const { data: projects, error } = await db.from('projects').select('id,slug,is_public');
  if (error) throw error;
  return (projects || []).find((p) => normalizeSlug(p.slug) === normalizeSlug(slug)) || null;
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const url = new URL(req.url);
    const kind = url.searchParams.get('kind');
    const planType = String(url.searchParams.get('planType') || 'master_plan').trim().toLowerCase();
    if (kind !== 'master-plan' && kind !== 'drone') return NextResponse.json({ error: 'Invalid asset kind' }, { status: 400 });
    if (planType !== 'master_plan' && !/^section_\d+$/.test(planType)) return NextResponse.json({ error: 'Invalid planType' }, { status: 400 });

    const project = await findProject(slug);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (!project.is_public) {
      const user = await getCurrentUser();
      if (!user || !(await getMembership(user.id, project.slug))) return NextResponse.json({ error: 'You do not have access to this project.' }, { status: 403 });
    }

    const db = supabaseAdmin();
    // Use v param directly if provided (viewer passes the storage URL it already has)
    const vParam = url.searchParams.get('v');
    let value: string | null | undefined = vParam || null;

    // Fall back to DB lookup if no v param
    if (!value) {
      const { data: plan, error: planError } = await db.from('project_site_plans').select('map_url,drone_url').eq('project_id', project.id).eq('plan_type', planType).maybeSingle();
      if (planError) return NextResponse.json({ error: planError.message }, { status: 500 });
      value = kind === 'master-plan' ? plan?.map_url : plan?.drone_url;
    }
    if (!value) return NextResponse.json({ error: 'Asset not configured' }, { status: 404 });

    const parsed = parseStorage(value);
    if (!parsed) return NextResponse.json({ error: 'Invalid stored asset path' }, { status: 500 });

    // Older records used project-assets/<path>, while current records use storage://projects/<path>.
    const candidates = [{ bucket: parsed.bucket, path: parsed.path }];
    if (parsed.bucket === 'projects') candidates.push({ bucket: 'project-assets', path: parsed.path });
    if (parsed.bucket === 'project-assets') candidates.push({ bucket: 'projects', path: parsed.path });

    let data: Blob | null = null;
    let resolvedPath = parsed.path;
    let lastError: any = null;
    console.log('[assets/file] trying candidates:', JSON.stringify(candidates));
    for (const candidate of candidates) {
      const result = await db.storage.from(candidate.bucket).download(candidate.path);
      console.log(`[assets/file] bucket=${candidate.bucket} path=${candidate.path} ok=${!!result.data} err=${result.error?.message}`);
      if (result.data) { data = result.data; resolvedPath = candidate.path; break; }
      lastError = result.error;
    }
    if (!data) return NextResponse.json({ error: lastError?.message || `Asset not found: ${parsed.bucket}/${parsed.path}` }, { status: 404 });

    const lower = resolvedPath.toLowerCase();
    const contentType = lower.endsWith('.svg') ? 'image/svg+xml' : lower.endsWith('.png') ? 'image/png' : lower.endsWith('.jpg') || lower.endsWith('.jpeg') ? 'image/jpeg' : lower.endsWith('.webp') ? 'image/webp' : data.type || 'application/octet-stream';
    return new NextResponse(data, { status: 200, headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=300, must-revalidate', 'Content-Disposition': 'inline' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load asset' }, { status: 500 });
  }
}
