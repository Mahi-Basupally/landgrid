import { NextResponse } from 'next/server';
import { getMembership, getUserFromSession } from '@/lib/auth';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SectionInput = { id?: string; name: string; sortOrder?: number; masterPlanUrl?: string | null; droneUrl?: string | null };
type LotInput = { id?: string; number: string; status?: string; owner?: string; price?: number | string | null; area?: number | string | null; direction?: string; model?: string; points?: string; labelX?: number; labelY?: number; geometrySource?: string; sectionId?: string | null };
type Project = { id: string; slug: string; name: string; created_by: string };

function normalizeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function planLabel(planType: string) {
  if (planType === 'master_plan') return 'Master';
  const match = planType.match(/^section_(\d+)$/);
  return match ? `Section ${match[1]}` : planType;
}

async function findProject(slug: string): Promise<Project | null> {
  const db = supabaseAdmin();
  const { data: exact, error: exactError } = await db.from('projects').select('id,slug,name,created_by').eq('slug', slug).maybeSingle();
  if (exactError) throw exactError;
  if (exact) return exact;

  const { data, error } = await db.from('projects').select('id,slug,name,created_by');
  if (error) throw error;
  return (data || []).find((p) => normalizeSlug(p.slug) === normalizeSlug(slug)) || null;
}

async function requireAdmin(slug: string) {
  const token = (await cookies()).get('landgrid_user')?.value;
  const user = await getUserFromSession(token);
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const project = await findProject(slug);
  if (!project) return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }) };

  const role = await getMembership(user.id, project.slug);
  if (role !== 'admin' && project.created_by !== user.id) {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }
  return { user, project };
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const project = await findProject(slug);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const db = supabaseAdmin();
    const { data: plans, error: plansError } = await db
      .from('project_site_plans')
      .select('id,project_id,plan_type,map_url,drone_url,created_at,updated_at')
      .eq('project_id', project.id)
      .order('plan_type', { ascending: true });
    if (plansError) throw plansError;

    const sections = (plans || []).map((p) => ({
      id: p.plan_type,
      name: planLabel(p.plan_type),
      sortOrder: p.plan_type === 'master_plan' ? 0 : Number(p.plan_type.match(/^section_(\d+)$/)?.[1] || 999),
      masterPlanUrl: p.map_url,
      droneUrl: p.drone_url,
    }));

    const { data: plots, error: plotsError } = await db
      .from('plots')
      .select('id,plot_number,status,owner,price,area_sq_yards,area_sq_ft,direction,details,geometry,section')
      .eq('project_id', project.id)
      .order('plot_number', { ascending: true });
    if (plotsError) throw plotsError;

    return NextResponse.json({
      project: { id: project.id, slug: project.slug, name: project.name },
      sections,
      lots: (plots || []).map((plot) => ({
        id: plot.id,
        number: plot.plot_number,
        status: plot.status || 'available',
        owner: plot.owner || '',
        price: plot.price,
        area: plot.area_sq_yards ?? plot.area_sq_ft ?? null,
        direction: plot.direction || '',
        model: plot.details || '',
        points: typeof plot.geometry === 'string' ? plot.geometry : String((plot.geometry as any)?.points || ''),
        labelX: Number((plot.geometry as any)?.labelX || 0),
        labelY: Number((plot.geometry as any)?.labelY || 0),
        geometrySource: (plot.geometry as any)?.geometrySource || 'database',
        sectionId: plot.section || sections[0]?.id || null,
      })),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[plan-get]', error);
    return NextResponse.json({ error: 'Unable to load project plan' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const auth = await requireAdmin(slug);
    if ('error' in auth) return auth.error;

    const body = await req.json().catch(() => ({}));
    const sections = Array.isArray(body.sections) ? body.sections as SectionInput[] : [];
    const lots = Array.isArray(body.lots) ? body.lots as LotInput[] : [];
    if (!sections.length) return NextResponse.json({ error: 'At least one plan is required' }, { status: 400 });

    const db = supabaseAdmin();
    const persisted: Array<{ id: string; plan_type: string; map_url: string | null; drone_url: string | null }> = [];

    for (const section of sections) {
      const name = String(section.name || '').trim();
      const requested = String(section.id || '').trim().toLowerCase();
      const fromName = name.toLowerCase().match(/^section\s+(\d+)$/);
      const planType = requested === 'master_plan' || requested === 'master' ? 'master_plan' : /^section_\d+$/.test(requested) ? requested : fromName ? `section_${fromName[1]}` : '';
      if (!planType) continue;

      const { data, error } = await db.from('project_site_plans')
        .upsert({
          project_id: auth.project.id,
          plan_type: planType,
          map_url: section.masterPlanUrl ?? null,
          drone_url: section.droneUrl ?? null,
        }, { onConflict: 'project_id,plan_type' })
        .select('id,plan_type,map_url,drone_url')
        .single();
      if (error) throw error;
      persisted.push(data);
    }

    const validPlanTypes = new Set(persisted.map((p) => p.plan_type));
    const fallbackPlan = persisted.find((p) => p.plan_type === 'master_plan')?.plan_type || persisted[0]?.plan_type || null;

    function cleanNumber(value: unknown) {
      if (value === '' || value === null || value === undefined) return null;
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    }

    for (const lot of lots) {
      const requestedSection = String(lot.sectionId || '').trim();
      const sectionId = validPlanTypes.has(requestedSection) ? requestedSection : fallbackPlan;
      const geometry = {
        points: String(lot.points || ''),
        labelX: Number(lot.labelX || 0),
        labelY: Number(lot.labelY || 0),
        geometrySource: lot.geometrySource || 'manual',
      };
      const payload = {
        project_id: auth.project.id,
        plot_number: String(lot.number || ''),
        status: lot.status || 'available',
        owner: lot.owner || null,
        price: cleanNumber(lot.price),
        area_sq_yards: cleanNumber(lot.area),
        direction: lot.direction || null,
        details: lot.model || null,
        geometry,
        section: sectionId,
      };

      let existing: { id: string } | null = null;
      if (lot.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(lot.id)) {
        const { data } = await db.from('plots').select('id').eq('id', lot.id).eq('project_id', auth.project.id).maybeSingle();
        existing = data;
      }
      if (!existing) {
        const { data } = await db.from('plots').select('id').eq('project_id', auth.project.id).eq('plot_number', payload.plot_number).eq('section', sectionId).maybeSingle();
        existing = data;
      }
      if (existing) {
        const { error } = await db.from('plots').update(payload).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await db.from('plots').insert(payload);
        if (error) throw error;
      }
    }

    return NextResponse.json({ ok: true, sections: persisted.length, lots: lots.length });
  } catch (error) {
    console.error('[plan-save]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save project plan' }, { status: 500 });
  }
}
