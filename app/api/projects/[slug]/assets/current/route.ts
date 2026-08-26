import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

function normalizeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function label(planType: string) {
  if (planType === 'master_plan') return 'Master';
  const match = planType.match(/^section_(\d+)$/);
  return match ? `Section ${match[1]}` : planType;
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

  const { data: plans, error } = await db.from('project_site_plans')
    .select('id,plan_type,map_url,drone_url,created_at,updated_at')
    .eq('project_id', project.id)
    .order('plan_type');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    plans: (plans || []).map((plan) => ({
      id: plan.id,
      planType: plan.plan_type,
      name: label(plan.plan_type),
      mapUrl: plan.map_url ? `/api/projects/${encodeURIComponent(project!.slug)}/assets/file?kind=master-plan&planType=${encodeURIComponent(plan.plan_type)}` : null,
      droneUrl: plan.drone_url ? `/api/projects/${encodeURIComponent(project!.slug)}/assets/file?kind=drone&planType=${encodeURIComponent(plan.plan_type)}` : null,
    })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
