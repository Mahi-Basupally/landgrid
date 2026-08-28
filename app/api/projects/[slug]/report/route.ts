import { NextResponse } from 'next/server';
import { getCurrentUser, getMembership } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

function normalizeSlug(v: string) { return v.toLowerCase().replace(/[^a-z0-9]/g, ''); }

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = supabaseAdmin();

  const { data: exact } = await db.from('projects')
    .select('id,slug,name,address,is_public,created_by')
    .eq('slug', slug).maybeSingle();
  let project = exact;
  if (!project) {
    const { data: all } = await db.from('projects').select('id,slug,name,address,is_public,created_by');
    project = (all || []).find((p: any) => normalizeSlug(p.slug) === normalizeSlug(slug)) || null;
  }
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Auth: public projects open, private need membership
  if (!project.is_public) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const role = await getMembership(user.id, project.slug);
    if (!role && project.created_by !== user.id)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [plotsRes, ownersRes] = await Promise.all([
    db.from('plots').select('id,plot_number,status,owner,owner_id,area_sq_yards,area_sq_ft,length_m,width_m,price,direction,section').eq('project_id', project.id).order('plot_number'),
    db.from('project_owners').select('id,name,email,phone').eq('project_id', project.id).order('name'),
  ]);

  const plots = plotsRes.data || [];
  const owners = ownersRes.data || [];

  // Build per-owner summary
  const ownerMap = Object.fromEntries(owners.map((o: any) => [o.id, o]));

  const ownerSummaries = owners.map((owner: any) => {
    const owned = plots.filter((p: any) => p.owner_id === owner.id);
    const totalArea = owned.reduce((s: number, p: any) => s + (p.area_sq_yards || 0), 0);
    const totalAreaSqFt = owned.reduce((s: number, p: any) => s + (p.area_sq_ft || 0), 0);
    const statusCounts = owned.reduce((m: any, p: any) => { m[p.status] = (m[p.status] || 0) + 1; return m; }, {});
    return {
      id: owner.id,
      name: owner.name,
      email: owner.email,
      phone: owner.phone,
      totalPlots: owned.length,
      totalAreaSqYd: Math.round(totalArea * 100) / 100,
      totalAreaSqFt: Math.round(totalAreaSqFt * 100) / 100,
      statusCounts,
      plots: owned.map((p: any) => ({
        number: p.plot_number,
        status: p.status,
        areaSqYd: p.area_sq_yards,
        areaSqFt: p.area_sq_ft,
        lengthM: p.length_m,
        widthM: p.width_m,
        price: p.price,
        direction: p.direction,
        section: p.section,
      })).sort((a: any, b: any) => Number(a.number) - Number(b.number)),
    };
  }).filter((o: any) => o.totalPlots > 0);

  // Unassigned plots
  const unassigned = plots.filter((p: any) => !p.owner_id);

  // Overall stats
  const stats = {
    total: plots.length,
    available: plots.filter((p: any) => p.status === 'available').length,
    reserved: plots.filter((p: any) => p.status === 'reserved').length,
    sold: plots.filter((p: any) => p.status === 'sold').length,
    hold: plots.filter((p: any) => p.status === 'hold').length,
    totalAreaSqYd: Math.round(plots.reduce((s: number, p: any) => s + (p.area_sq_yards || 0), 0) * 100) / 100,
    ownersCount: ownerSummaries.length,
    unassigned: unassigned.length,
  };

  return NextResponse.json({ project: { name: project.name, address: project.address }, stats, owners: ownerSummaries, unassigned: unassigned.map((p: any) => ({ number: p.plot_number, status: p.status, areaSqYd: p.area_sq_yards, areaSqFt: p.area_sq_ft, price: p.price })) }, { headers: { 'Cache-Control': 'no-store' } });
}
