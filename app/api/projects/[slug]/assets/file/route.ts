import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function storagePath(value: string) {
  const raw = value.trim();

  // Our application stores bucket-relative paths, sometimes prefixed with
  // `storage://` for clarity. Supabase Storage expects the path relative to
  // the bucket, so remove that prefix before downloading.
  if (raw.startsWith('storage://')) {
    return decodeURIComponent(raw.slice('storage://'.length).replace(/^\/+/, ''));
  }

  if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
    return decodeURIComponent(raw.replace(/^\/+/, ''));
  }

  // Backward compatibility with existing public Storage URLs.
  const marker = '/project-assets/';
  const index = raw.indexOf(marker);
  if (index >= 0) {
    return decodeURIComponent(raw.slice(index + marker.length).split('?')[0]);
  }

  return null;
}

async function findProject(slug: string) {
  const db = supabaseAdmin();
  const { data: exact, error: exactError } = await db
    .from('projects')
    .select('slug,site_plan_url,drone_url')
    .eq('slug', slug)
    .maybeSingle();

  if (exactError) throw new Error(exactError.message);
  if (exact) return exact;

  const { data: projects, error } = await db
    .from('projects')
    .select('slug,site_plan_url,drone_url');
  if (error) throw new Error(error.message);

  return (projects || []).find((p) => normalizeSlug(p.slug) === normalizeSlug(slug)) || null;
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const kind = new URL(req.url).searchParams.get('kind');

  if (kind !== 'master-plan' && kind !== 'drone') {
    return NextResponse.json({ error: 'Invalid asset kind' }, { status: 400 });
  }

  try {
    const project = await findProject(slug);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const value = kind === 'master-plan' ? project.site_plan_url : project.drone_url;
    if (!value) return NextResponse.json({ error: 'Asset not configured' }, { status: 404 });

    const path = storagePath(value);
    if (!path) return NextResponse.json({ error: 'Invalid stored asset path' }, { status: 500 });

    const db = supabaseAdmin();
    const { data, error } = await db.storage.from('project-assets').download(path);

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || `Asset not found: ${path}` },
        { status: 404 },
      );
    }

    const lower = path.toLowerCase();
    const contentType = lower.endsWith('.svg')
      ? 'image/svg+xml'
      : lower.endsWith('.png')
        ? 'image/png'
        : lower.endsWith('.jpg') || lower.endsWith('.jpeg')
          ? 'image/jpeg'
          : lower.endsWith('.webp')
            ? 'image/webp'
            : data.type || 'application/octet-stream';

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=300, must-revalidate',
        'Content-Disposition': 'inline',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load asset' },
      { status: 500 },
    );
  }
}
