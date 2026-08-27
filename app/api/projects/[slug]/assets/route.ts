import { NextResponse } from 'next/server';
import { getCurrentUser, getMembership } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import sharp from 'sharp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']);

function normalizeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function findProject(requestedSlug: string) {
  const db = supabaseAdmin();
  const { data: exact, error } = await db.from('projects').select('id,slug,created_by').eq('slug', requestedSlug).maybeSingle();
  if (error) throw error;
  if (exact) return exact;
  const { data: projects, error: listError } = await db.from('projects').select('id,slug,created_by');
  if (listError) throw listError;
  return (projects || []).find((p) => normalizeSlug(p.slug) === normalizeSlug(requestedSlug)) || null;
}

function validPlanType(value: string) {
  return value === 'master_plan' || /^section_\d+$/.test(value);
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const project = await findProject(slug);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const role = await getMembership(user.id, project.slug);
    if (role !== 'admin' && project.created_by !== user.id) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const form = await req.formData();
    const file = form.get('file');
    const kind = String(form.get('kind') || 'master-plan');
    const planType = String(form.get('planType') || (kind === 'master-plan' || kind === 'drone' ? 'master_plan' : '')).trim().toLowerCase();

    if (!(file instanceof File)) return NextResponse.json({ error: 'File is required' }, { status: 400 });
    if (!allowed.has(file.type)) return NextResponse.json({ error: `Unsupported file type: ${file.type || 'unknown'}` }, { status: 400 });
    if (file.size > 50 * 1024 * 1024) return NextResponse.json({ error: 'File must be 50MB or smaller' }, { status: 400 });
    if (!validPlanType(planType)) return NextResponse.json({ error: 'planType must be master_plan or section_N' }, { status: 400 });
    if (kind !== 'master-plan' && kind !== 'drone') return NextResponse.json({ error: 'Invalid asset kind' }, { status: 400 });

    const db = supabaseAdmin();
    const { data: plan, error: planError } = await db.from('project_site_plans')
      .upsert({ project_id: project.id, plan_type: planType }, { onConflict: 'project_id,plan_type' })
      .select('id,plan_type,map_url,drone_url')
      .single();
    if (planError) return NextResponse.json({ error: `Plan record failed: ${planError.message}` }, { status: 500 });

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = `projects/${project.id}/plans/${planType}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await db.storage.from('project-assets').upload(path, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
      cacheControl: '31536000',
    });
    if (uploadError) return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 });

    const storedValue = `storage://${path}`;
    const field = kind === 'master-plan' ? 'map_url' : 'drone_url';

    // Read native image dimensions
    let imageWidth: number | null = null;
    let imageHeight: number | null = null;
    try {
      const buf = Buffer.from(await file.arrayBuffer());
      const meta = await sharp(buf).metadata();
      imageWidth  = meta.width  ?? null;
      imageHeight = meta.height ?? null;
    } catch { /* non-fatal — dimensions just won't be saved */ }

    // Compute canvas dimensions preserving aspect ratio at width=1600
    let canvasWidth  = 1600;
    let canvasHeight = 1000;
    if (imageWidth && imageHeight) {
      canvasWidth  = 1600;
      canvasHeight = Math.round(1600 / (imageWidth / imageHeight));
    }

    const updateFields: Record<string, unknown> = {
      [field]: storedValue,
      canvas_width:  canvasWidth,
      canvas_height: canvasHeight,
      ...(imageWidth  != null ? { image_width:  imageWidth  } : {}),
      ...(imageHeight != null ? { image_height: imageHeight } : {}),
    };

    const { error: updateError } = await db.from('project_site_plans').update(updateFields).eq('id', plan.id).eq('project_id', project.id);
    if (updateError) return NextResponse.json({ error: `Plan update failed: ${updateError.message}` }, { status: 500 });

    return NextResponse.json({ ok: true, path, kind, planType, savedValue: storedValue, canvasWidth, canvasHeight, imageWidth, imageHeight });
  } catch (error) {
    console.error('[assets-post]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Upload failed' }, { status: 500 });
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const url = new URL(req.url);
    const kind = url.searchParams.get('kind');
    const planType = String(url.searchParams.get('planType') || 'master_plan');
    if (kind !== 'master-plan' && kind !== 'drone') return NextResponse.json({ error: 'Invalid asset kind' }, { status: 400 });
    if (!validPlanType(planType)) return NextResponse.json({ error: 'Invalid planType' }, { status: 400 });

    const project = await findProject(slug);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const { data: plan, error } = await supabaseAdmin().from('project_site_plans').select('map_url,drone_url').eq('project_id', project.id).eq('plan_type', planType).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const storedValue = kind === 'master-plan' ? plan?.map_url : plan?.drone_url;
    if (!storedValue) return NextResponse.json({ error: 'Asset not configured' }, { status: 404 });

    const storagePath = storedValue.startsWith('storage://') ? storedValue.slice('storage://'.length) : storedValue;
    const { data, error: downloadError } = await supabaseAdmin().storage.from('project-assets').download(storagePath);
    if (downloadError || !data) return NextResponse.json({ error: `Storage download failed: ${downloadError?.message || 'file not found'}` }, { status: 404 });

    const lower = storagePath.toLowerCase();
    const contentType = data.type || (lower.endsWith('.svg') ? 'image/svg+xml' : lower.endsWith('.png') ? 'image/png' : lower.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
    return new NextResponse(data, { status: 200, headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable', 'Content-Disposition': 'inline' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load asset' }, { status: 500 });
  }
}
