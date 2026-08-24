import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

function normalizeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = supabaseAdmin();
  const { data: exact, error: exactError } = await db.from('projects').select('slug,site_plan_url,drone_url').eq('slug', slug).maybeSingle();
  if (exactError) return NextResponse.json({ error: exactError.message }, { status: 500 });
  if (exact) return NextResponse.json({ sitePlanUrl: exact.site_plan_url || null, droneUrl: exact.drone_url || null });

  const { data: projects, error } = await db.from('projects').select('slug,site_plan_url,drone_url');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const project = (projects || []).find((p) => normalizeSlug(p.slug) === normalizeSlug(slug));
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  return NextResponse.json({ sitePlanUrl: project.site_plan_url || null, droneUrl: project.drone_url || null });
}
