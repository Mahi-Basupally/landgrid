import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getMembership, getUserFromSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SectionInput = {
  id?: string;
  name: string;
  sortOrder?: number;
  masterPlanUrl?: string | null;
  droneUrl?: string | null;
};

type LotInput = {
  id?: string;
  number: string;
  status?: string;
  owner?: string;
  price?: number | string | null;
  area?: number | string | null;
  direction?: string;
  model?: string;
  points?: string;
  labelX?: number;
  labelY?: number;
  geometrySource?: string;
  sectionId?: string | null;
};

async function findProject(slug: string) {
  const { data, error } = await supabaseAdmin().from('projects').select('id,slug,name,site_plan_url,drone_url').eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data;
}

async function requireAdmin(slug: string) {
  const token = (await cookies()).get('landgrid_user')?.value;
  const user = await getUserFromSession(token);
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const role = await getMembership(user.id, slug);
  if (role !== 'admin') return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  return { user };
}

function cleanNumber(value: unknown) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const project = await findProject(slug);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const db = supabaseAdmin();
    const { data: sections, error: sectionError } = await db
      .from('project_sections')
      .select('id,name,sort_order,master_plan_url,drone_url')
      .eq('project_id', project.id)
      .order('sort_order', { ascending: true });
    if (sectionError) throw sectionError;

    const { data: plots, error: plotError } = await db
      .from('plots')
      .select('id,plot_number,status,owner,price,area_sq_yards,area_sq_ft,direction,details,geometry,section,created_at,updated_at')
      .eq('project_id', project.id)
      .order('plot_number', { ascending: true });
    if (plotError) throw plotError;

    const normalizedSections = (sections || []).map((section) => ({
      id: section.id,
      name: section.name,
      sortOrder: section.sort_order,
      masterPlanUrl: section.master_plan_url,
      droneUrl: section.drone_url,
    }));

    if (!normalizedSections.length) {
      normalizedSections.push({ id: 'master', name: 'Master', sortOrder: 0, masterPlanUrl: project.site_plan_url, droneUrl: project.drone_url });
    }

    return NextResponse.json({
      project: { id: project.id, slug: project.slug, name: project.name },
      sections: normalizedSections,
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
        sectionId: plot.section || normalizedSections[0]?.id || null,
      })),
    });
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

    const project = await findProject(slug);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const body = await req.json();
    const sections = Array.isArray(body.sections) ? body.sections as SectionInput[] : [];
    const lots = Array.isArray(body.lots) ? body.lots as LotInput[] : [];
    const db = supabaseAdmin();

    const normalizedSections = sections.map((section, index) => ({
      id: section.id && section.id !== 'master' ? section.id : undefined,
      project_id: project.id,
      name: String(section.name || `Section ${index + 1}`).trim(),
      sort_order: Number.isFinite(Number(section.sortOrder)) ? Number(section.sortOrder) : index,
      master_plan_url: section.masterPlanUrl || null,
      drone_url: section.droneUrl || null,
    }));

    const persistedSections: any[] = [];
    for (const section of normalizedSections) {
      const payload = { project_id: section.project_id, name: section.name, sort_order: section.sort_order, master_plan_url: section.master_plan_url, drone_url: section.drone_url };
      const query = section.id
        ? db.from('project_sections').update(payload).eq('id', section.id).eq('project_id', project.id).select('id,name,sort_order,master_plan_url,drone_url').maybeSingle()
        : db.from('project_sections').insert(payload).select('id,name,sort_order,master_plan_url,drone_url').single();
      const { data, error } = await query;
      if (error) throw error;
      if (data) persistedSections.push(data);
    }

    const validSectionIds = new Set(persistedSections.map((section) => section.id));
    const firstSectionId = persistedSections[0]?.id || null;

    for (const lot of lots) {
      const sectionId = lot.sectionId && validSectionIds.has(lot.sectionId) ? lot.sectionId : firstSectionId;
      const geometry = {
        points: String(lot.points || ''),
        labelX: Number(lot.labelX || 0),
        labelY: Number(lot.labelY || 0),
        geometrySource: lot.geometrySource || 'manual',
      };
      const payload = {
        project_id: project.id,
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

      let existing: any = null;
      if (lot.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(lot.id)) {
        const { data } = await db.from('plots').select('id').eq('id', lot.id).eq('project_id', project.id).maybeSingle();
        existing = data;
      }
      if (!existing) {
        const { data } = await db.from('plots').select('id').eq('project_id', project.id).eq('plot_number', payload.plot_number).eq('section', sectionId).maybeSingle();
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

    return NextResponse.json({ ok: true, sections: persistedSections.length, lots: lots.length });
  } catch (error) {
    console.error('[plan-save]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save project plan' }, { status: 500 });
  }
}
