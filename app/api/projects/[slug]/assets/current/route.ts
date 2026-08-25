import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

function normalizeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = supabaseAdmin();
  const { data: exact, error: exactError } = await db.from('projects').select('id,slug').eq('slug', slug).maybeSingle();
  if (exactError) return NextResponse.json({ error: exactError.message }, { status: 500 });

  let project = exact;
  if (!project) {
    const { data: projects, error } = await db.from('projects').select('id,slug');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    project = (projects || []).find((p) => normalizeSlug(p.slug) === normalizeSlug(slug)) || null;
  }
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const { data: plans, error } = await db
    .from('project_site_plans')
    .select('plan_type,map_url,drone_url')
    .eq('project_id', project.id)
    .order('plan_type');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const master = (plans || []).find((p) => p.plan_type === 'master_plan');
  const assetUrl = (kind: 'master-plan' | 'drone', value?: string | null, planType = 'master_plan') =>
    value ? `/api/projects/${encodeURIComponent(project!.slug)}/assets?kind=${kind}&planType=${encodeURIComponent(planType)}` : null;

  return NextResponse.json({
    sitePlanUrl: assetUrl('master-plan', master?.map_url, 'master_plan'),
    droneUrl: assetUrl('drone', master?.drone_url, 'master_plan'),
    plans: (plans || []).map((plan) => ({
      planType: plan.plan_type,
      mapUrl: assetUrl('master-plan', plan.map_url, plan.plan_type),
      droneUrl: assetUrl('drone', plan.drone_url, plan.plan_type),
    })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
