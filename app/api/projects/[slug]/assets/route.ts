import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserFromSession, getMembership } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'video/mp4', 'video/webm']);

function normalizeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: requestedSlug } = await params;
  const token = (await cookies()).get('landgrid_user')?.value;
  const user = await getUserFromSession(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = supabaseAdmin();
  const { data: exactProject, error: exactError } = await db
    .from('projects')
    .select('id,slug')
    .eq('slug', requestedSlug)
    .maybeSingle();
  if (exactError) return NextResponse.json({ error: exactError.message }, { status: 500 });

  let project = exactProject;
  if (!project) {
    const { data: projects, error } = await db.from('projects').select('id,slug');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    project = (projects || []).find((p) => normalizeSlug(p.slug) === normalizeSlug(requestedSlug)) || null;
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
  const { error: uploadError } = await db.storage.from('project-assets').upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
    cacheControl: '3600',
  });
  if (uploadError) return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 });

  const { data: publicData } = db.storage.from('project-assets').getPublicUrl(path);
  const url = publicData.publicUrl;

  if (kind === 'master-plan' || kind === 'drone') {
    const field = kind === 'master-plan' ? 'site_plan_url' : 'drone_url';
    const { error: updateError } = await db.from('projects').update({ [field]: url }).eq('id', project.id);
    if (updateError) return NextResponse.json({ error: `Project update failed: ${updateError.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url, path, kind, projectSlug: project.slug });
}
