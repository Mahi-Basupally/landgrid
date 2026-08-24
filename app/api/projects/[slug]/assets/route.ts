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

async function findProject(requestedSlug: string) {
  const db = supabaseAdmin();
  const { data: exactProject, error: exactError } = await db
    .from('projects')
    .select('id,slug,site_plan_url,drone_url')
    .eq('slug', requestedSlug)
    .maybeSingle();
  if (exactError) throw new Error(exactError.message);
  if (exactProject) return exactProject;

  const { data: projects, error } = await db
    .from('projects')
    .select('id,slug,site_plan_url,drone_url');
  if (error) throw new Error(error.message);
  return (projects || []).find((p) => normalizeSlug(p.slug) === normalizeSlug(requestedSlug)) || null;
}

function storagePathFromUrl(value: string | null | undefined) {
  if (!value) return null;
  if (value.startsWith('storage://')) return value.slice('storage://'.length);

  const marker = '/storage/v1/object/public/project-assets/';
  const index = value.indexOf(marker);
  if (index >= 0) return decodeURIComponent(value.slice(index + marker.length));
  return null;
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: requestedSlug } = await params;
  const token = (await cookies()).get('landgrid_user')?.value;
  const user = await getUserFromSession(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let project;
  try {
    project = await findProject(requestedSlug);
  } catch (error) {
    console.error('[asset-upload] project lookup failed', { requestedSlug, error });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Project lookup failed' }, { status: 500 });
  }
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const role = await getMembership(user.id, project.slug);
  if (role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const form = await req.formData();
  const file = form.get('file');
  const kind = String(form.get('kind') || 'media');
  if (!(file instanceof File)) return NextResponse.json({ error: 'File is required' }, { status: 400 });
  if (!allowed.has(file.type)) return NextResponse.json({ error: `Unsupported file type: ${file.type || 'unknown'}` }, { status: 400 });
  if (file.size > 50 * 1024 * 1024) return NextResponse.json({ error: 'File must be 50MB or smaller' }, { status: 400 });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `projects/${project.id}/${kind}/${Date.now()}-${safeName}`;
  const db = supabaseAdmin();
  const { error: uploadError } = await db.storage.from('project-assets').upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
    cacheControl: '31536000',
  });
  if (uploadError) {
    console.error('[asset-upload] storage upload failed', { projectId: project.id, slug: project.slug, kind, path, error: uploadError });
    return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 });
  }

  // Persist the exact bucket-relative object path. This is the source of truth;
  // it survives Vercel deployments and avoids trying to reverse-engineer a URL later.
  if (kind === 'master-plan' || kind === 'drone') {
    const field = kind === 'master-plan' ? 'site_plan_url' : 'drone_url';
    const storedValue = `storage://${path}`;

    const { error: updateError } = await db
      .from('projects')
      .update({ [field]: storedValue })
      .eq('id', project.id);

    if (updateError) {
      console.error('[asset-upload] project asset reference update failed', {
        projectId: project.id,
        slug: project.slug,
        field,
        storedValue,
        path,
        error: updateError,
      });
      return NextResponse.json({ error: `Project update failed: ${updateError.message}` }, { status: 500 });
    }

    // Verify the database write. Never report a successful upload when the
    // project row still has a null/old asset reference.
    const { data: verifiedProject, error: verifyError } = await db
      .from('projects')
      .select(`id,slug,${field}`)
      .eq('id', project.id)
      .maybeSingle();

    if (verifyError) {
      console.error('[asset-upload] project asset reference verification failed', {
        projectId: project.id,
        slug: project.slug,
        field,
        storedValue,
        path,
        error: verifyError,
      });
      return NextResponse.json({ error: `Project verification failed: ${verifyError.message}` }, { status: 500 });
    }

    const savedValue = verifiedProject?.[field];
    if (savedValue !== storedValue) {
      console.error('[asset-upload] project asset reference was not persisted', {
        projectId: project.id,
        slug: project.slug,
        field,
        expected: storedValue,
        actual: savedValue ?? null,
        path,
      });
      return NextResponse.json({
        error: `Project asset reference was not persisted. ${field} is ${savedValue ? 'different from the uploaded file' : 'null'}.`,
        path,
        field,
      }, { status: 500 });
    }

    const assetUrl = `/api/projects/${encodeURIComponent(project.slug)}/assets?kind=${encodeURIComponent(kind)}&v=${Date.now()}`;
    console.info('[asset-upload] asset saved and database verified', {
      projectId: project.id,
      slug: project.slug,
      kind,
      storagePath: path,
      storedValue,
      assetUrl,
    });

    return NextResponse.json({
      ok: true,
      url: assetUrl,
      path,
      kind,
      projectSlug: project.slug,
      savedValue: storedValue,
    });
  }

  const assetUrl = `/api/projects/${encodeURIComponent(project.slug)}/assets?kind=${encodeURIComponent(kind)}&v=${Date.now()}`;
  console.info('[asset-upload] media asset saved', {
    projectId: project.id,
    slug: project.slug,
    kind,
    storagePath: path,
    assetUrl,
  });

  return NextResponse.json({ ok: true, url: assetUrl, path, kind, projectSlug: project.slug });
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: requestedSlug } = await params;
  const url = new URL(req.url);
  const kind = url.searchParams.get('kind');
  if (kind !== 'master-plan' && kind !== 'drone') {
    return NextResponse.json({ error: 'Invalid asset kind' }, { status: 400 });
  }

  let project;
  try {
    project = await findProject(requestedSlug);
  } catch (error) {
    console.error('[asset-get] project lookup failed', { requestedSlug, kind, error });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Project lookup failed' }, { status: 500 });
  }
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const storedValue = kind === 'master-plan' ? project.site_plan_url : project.drone_url;
  console.info('[asset-get] resolving asset', { requestedSlug, projectId: project.id, kind, storedValue });

  let storagePath = storagePathFromUrl(storedValue);

  // Backward compatibility for deployments that previously saved an API URL.
  if (!storagePath && storedValue?.includes('/api/projects/')) {
    const db = supabaseAdmin();
    const { data: objects, error } = await db.storage
      .from('project-assets')
      .list(`projects/${project.id}/${kind}`, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) return NextResponse.json({ error: `Storage lookup failed: ${error.message}` }, { status: 500 });
    const latest = objects?.find((item) => item.name && !item.name.endsWith('/'));
    if (latest) storagePath = `projects/${project.id}/${kind}/${latest.name}`;
  }

  if (!storagePath) return NextResponse.json({ error: 'Asset not configured' }, { status: 404 });

  const db = supabaseAdmin();
  const { data, error } = await db.storage.from('project-assets').download(storagePath);
  if (error || !data) {
    console.error('[asset-get] storage download failed', { projectId: project.id, slug: project.slug, kind, storagePath, error });
    return NextResponse.json({ error: `Storage download failed: ${error?.message || 'file not found'}` }, { status: 404 });
  }

  const lower = storagePath.toLowerCase();
  const contentType = data.type || (
    lower.endsWith('.svg') ? 'image/svg+xml' :
    lower.endsWith('.png') ? 'image/png' :
    lower.endsWith('.jpg') || lower.endsWith('.jpeg') ? 'image/jpeg' :
    lower.endsWith('.webp') ? 'image/webp' :
    'application/octet-stream'
  );

  return new NextResponse(data, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Disposition': 'inline',
    },
  });
}
