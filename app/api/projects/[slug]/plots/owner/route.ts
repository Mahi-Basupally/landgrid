import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const auth = await requireAdmin(slug);
    if ('error' in auth) return auth.error;

    const { plotId, ownerId } = await req.json().catch(() => ({})) as { plotId?: string; ownerId?: string | null };
    if (!plotId) return NextResponse.json({ error: 'plotId required' }, { status: 400 });

    const db = supabaseAdmin();

    // Verify plot belongs to this project
    const { data: plot } = await db.from('plots').select('id').eq('id', plotId).eq('project_id', auth.project.id).maybeSingle();
    if (!plot) return NextResponse.json({ error: 'Plot not found' }, { status: 404 });

    // Verify owner belongs to this project if provided
    let resolvedOwnerId: string | null = null;
    if (ownerId) {
      const { data: owner } = await db.from('project_owners').select('id').eq('id', ownerId).eq('project_id', auth.project.id).maybeSingle();
      if (!owner) return NextResponse.json({ error: 'Owner not found' }, { status: 404 });
      resolvedOwnerId = owner.id;
    }

    const { error } = await db.from('plots').update({ owner_id: resolvedOwnerId }).eq('id', plotId).eq('project_id', auth.project.id);
    if (error) throw error;

    return NextResponse.json({ ok: true, plotId, ownerId: resolvedOwnerId });
  } catch (err) {
    console.error('[plots/owner]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
