import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function storagePath(value: string) {
  const raw = value.trim();
  if (raw.startsWith('storage://')) return decodeURIComponent(raw.slice('storage://'.length).replace(/^\/+/, ''));
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) return decodeURIComponent(raw.replace(/^\/+/, ''));
  const marker = '/project-assets/';
  const index = raw.indexOf(marker);
  return index >= 0 ? decodeURIComponent(raw.slice(index + marker.length).split('?')[0]) : null;
}

async function findProject(slug: string) {
  const db = supabaseAdmin();
  const { data: exact, error: exactError } = await db.from('projects').select('id,slug').eq('slug', slug).maybeSingle();
  if (exactError) throw exactError;
  if (exact) return exact;
  const { data: projects, error } = await db.from('projects').select('id,slug');
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

    const { data: plan, error: planError } = await supabaseAdmin()
      .from('project_site_plans')
      .select('map_url,drone_url')
      .eq('project_id', project.id)
      .eq('plan_type', planType)
      .maybeSingle();
    if (planError) return NextResponse.json({ error: planError.message }, { status: 500 });

    const value = kind === 'master-plan' ? plan?.map_url : plan?.drone_url;
    if (!value) return NextResponse.json({ error: 'Asset not configured' }, { status: 404 });
    const path = storagePath(value);
    if (!path) return NextResponse.json({ error: 'Invalid stored asset path' }, { status: 500 });

    const { data, error } = await supabaseAdmin().storage.from('project-assets').download(path);
    if (error || !data) return NextResponse.json({ error: error?.message || `Asset not found: ${path}` }, { status: 404 });

    const lower = path.toLowerCase();
    const contentType = lower.endsWith('.svg') ? 'image/svg+xml' : lower.endsWith('.png') ? 'image/png' : lower.endsWith('.jpg') || lower.endsWith('.jpeg') ? 'image/jpeg' : lower.endsWith('.webp') ? 'image/webp' : data.type || 'application/octet-stream';
    return new NextResponse(data, { status: 200, headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=300, must-revalidate', 'Content-Disposition': 'inline' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load asset' }, { status: 500 });
  }
}
