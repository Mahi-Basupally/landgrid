import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeSlug(v: string) { return v.toLowerCase().replace(/[^a-z0-9]/g, ''); }

export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const db = supabaseAdmin();

    // Find project — only owner can delete
    const { data: exact } = await db.from('projects')
      .select('id,slug,name,created_by').eq('slug', slug).maybeSingle();
    let project = exact;
    if (!project) {
      const { data: all } = await db.from('projects').select('id,slug,name,created_by');
      project = (all || []).find(p => normalizeSlug(p.slug) === normalizeSlug(slug)) || null;
    }
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (project.created_by !== user.id) return NextResponse.json({ error: 'Only the project owner can delete a project' }, { status: 403 });

    // Delete storage files
    const { data: plans } = await db.from('project_site_plans').select('map_url,drone_url').eq('project_id', project.id);
    for (const plan of plans || []) {
      for (const rawUrl of [plan.map_url, plan.drone_url]) {
        if (!rawUrl) continue;
        let bucket = 'project-assets', path = '';
        if (rawUrl.startsWith('storage://')) {
          path = decodeURIComponent(rawUrl.slice('storage://'.length).replace(/^\/+/, ''));
        } else if (rawUrl.startsWith('http')) {
          const marker = '/storage/v1/object/';
          const idx = rawUrl.indexOf(marker);
          if (idx >= 0) {
            const rest = rawUrl.slice(idx + marker.length).replace(/^\//, '').split('/');
            if (rest[0] === 'public' || rest[0] === 'authenticated') rest.shift();
            bucket = decodeURIComponent(rest[0]);
            path = decodeURIComponent(rest.slice(1).join('/').split('?')[0]);
          }
        }
        if (path) await db.storage.from(bucket).remove([path]).catch(() => {});
      }
    }

    // Delete DB records (cascade order)
    await db.from('plots').delete().eq('project_id', project.id);
    await db.from('project_owners').delete().eq('project_id', project.id);
    await db.from('project_site_plans').delete().eq('project_id', project.id);
    await db.from('project_members').delete().eq('project_id', project.id);
    await db.from('project_sections').delete().eq('project_id', project.id);
    await db.from('projects').delete().eq('id', project.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Delete error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Delete failed' }, { status: 500 });
  }
}
