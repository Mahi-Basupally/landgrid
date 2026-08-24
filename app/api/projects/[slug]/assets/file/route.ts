import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function storagePath(value: string) {
  const marker = '/project-assets/';
  const index = value.indexOf(marker);
  if (index < 0) return null;
  return decodeURIComponent(value.slice(index + marker.length).split('?')[0]);
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const kind = new URL(req.url).searchParams.get('kind');
  if (kind !== 'master-plan' && kind !== 'drone') return NextResponse.json({ error: 'Invalid asset kind' }, { status: 400 });

  const db = supabaseAdmin();
  const { data: exact, error: exactError } = await db.from('projects').select('slug,site_plan_url,drone_url').eq('slug', slug).maybeSingle();
  if (exactError) return NextResponse.json({ error: exactError.message }, { status: 500 });

  let project = exact;
  if (!project) {
    const { data: projects, error } = await db.from('projects').select('slug,site_plan_url,drone_url');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    project = (projects || []).find((p) => normalizeSlug(p.slug) === normalizeSlug(slug)) || null;
  }
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const url = kind === 'master-plan' ? project.site_plan_url : project.drone_url;
  if (!url) return NextResponse.json({ error: 'Asset not configured' }, { status: 404 });
  const path = storagePath(url);
  if (!path) return NextResponse.json({ error: 'Invalid stored asset URL' }, { status: 500 });

  const { data, error } = await db.storage.from('project-assets').download(path);
  if (error || !data) return NextResponse.json({ error: error?.message || 'Asset not found' }, { status: 404 });

  const contentType = data.type || (path.toLowerCase().endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream');
  return new NextResponse(data, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=300, must-revalidate',
      'Content-Disposition': 'inline',
    },
  });
}
