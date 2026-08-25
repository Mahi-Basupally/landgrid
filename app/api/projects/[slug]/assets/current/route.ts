import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

function normalizeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = supabaseAdmin();
  const { data: exact, error: exactError } = await db.from('projects').select('id,slug,site_plan_url,drone_url').eq('slug', slug).maybeSingle();
  if (exactError) return NextResponse.json({ error: exactError.message }, { status: 500 });

  let project = exact;
  if (!project) {
    const { data: projects, error } = await db.from('projects').select('id,slug,site_plan_url,drone_url');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    project = (projects || []).find((p) => normalizeSlug(p.slug) === normalizeSlug(slug)) || null;
  }
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const assetUrl = (kind: 'master-plan' | 'drone', value?: string | null) =>
    value ? `/api/projects/${encodeURIComponent(project!.slug)}/assets/file?kind=${kind}` : null;

  const { data: sections, error: sectionError } = await db
    .from('project_sections')
    .select('id,name,sort_order,master_plan_url,drone_url')
    .eq('project_id', project.id)
    .order('sort_order', { ascending: true });
  if (sectionError) return NextResponse.json({ error: sectionError.message }, { status: 500 });

  return NextResponse.json({
    sitePlanUrl: assetUrl('master-plan', project.site_plan_url),
    droneUrl: assetUrl('drone', project.drone_url),
    sections: (sections || []).map((section) => ({
      id: section.id,
      name: section.name,
      sortOrder: section.sort_order,
      masterPlanUrl: section.master_plan_url ? `/api/projects/${encodeURIComponent(project!.slug)}/assets/file?kind=section-master-plan&section=${section.id}` : null,
      droneUrl: section.drone_url ? `/api/projects/${encodeURIComponent(project!.slug)}/assets/file?kind=section-drone&section=${section.id}` : null,
    })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
