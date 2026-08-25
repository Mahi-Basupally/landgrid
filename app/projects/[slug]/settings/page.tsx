import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getUserFromSession, getMembership } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import ProjectPlansManager from '@/components/ProjectPlansManager';
import ProjectAssetUpload from '@/components/ProjectAssetUpload';

export const dynamic = 'force-dynamic';

function normalizeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export default async function ProjectSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: requestedSlug } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get('landgrid_user')?.value;
  const user = await getUserFromSession(token);
  if (!user) redirect('/login');

  const db = supabaseAdmin();
  const { data: exactProject } = await db.from('projects').select('id,slug,name,address,description,google_location_url,created_by,created_at').eq('slug', requestedSlug).maybeSingle();
  let project = exactProject;
  if (!project) {
    const { data: projects, error } = await db.from('projects').select('id,slug,name,address,description,google_location_url,created_by,created_at');
    if (error) throw error;
    project = (projects || []).find((item) => normalizeSlug(item.slug) === normalizeSlug(requestedSlug)) || null;
  }
  if (!project) notFound();

  const role = await getMembership(user.id, project.slug);
  if (!role && project.created_by !== user.id) notFound();
  if (role !== 'admin' && project.created_by !== user.id) redirect(`/projects/${project.slug}`);

  const { data: owner } = await db.from('users').select('email,name').eq('id', project.created_by).maybeSingle();

  return (
    <main className="shell">
      <header className="header">
        <Link href="/projects" className="brand"><span>LG</span><b>LANDGRID</b></Link>
        <nav style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="button secondary" href={`/projects/${project.slug}`}>Project Home</Link>
          <Link className="button secondary" href={`/projects/${project.slug}/manage`}>Map &amp; Manage</Link>
          <form action="/api/auth/signout" method="post"><button className="button secondary" type="submit">Sign out</button></form>
        </nav>
      </header>
      <section className="page-heading"><div className="eyebrow">PROJECT SETTINGS</div><h1>{project.name}</h1><p>Configure project information, master plan, sections, drone views and media.</p></section>
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(0,1fr)' }}>
          <aside style={{ padding: 18, borderRight: '1px solid var(--border, #e5e7eb)' }}>
            <div className="eyebrow">SETTINGS</div>
            <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
              <a href="#project" className="button secondary">Project</a><a href="#plan" className="button secondary">Site plans</a><a href="#media" className="button secondary">Media</a><a href="#owner" className="button secondary">Owner</a><a href={`/projects/${project.slug}/members`} className="button secondary">Project users</a>
            </div>
          </aside>
          <section style={{ padding: 24, minWidth: 0 }}>
            <form id="settings-form" action={`/api/projects/${project.slug}/settings`} method="post" style={{ display: 'grid', gap: 24 }}>
              <section id="project"><div className="eyebrow">1 · PROJECT</div><h2>Project information</h2><div style={{ display: 'grid', gap: 12, marginTop: 14 }}><label>Project name<input name="name" defaultValue={project.name} required /></label><label>Address<input name="address" defaultValue={project.address || ''} required /></label><label>Google location URL<input name="googleLocationUrl" defaultValue={project.google_location_url || ''} placeholder="https://maps.google.com/..." /></label><label>Project description<textarea name="description" defaultValue={project.description || ''} rows={4} /></label></div></section>
              <section id="plan"><div className="eyebrow">2 · SITE PLANS</div><h2>Master plan &amp; sections</h2><p>Every project starts with a Master Plan. Add Section 1, Section 2 and so on; each plan keeps its own map and drone asset.</p><div style={{ marginTop: 14 }}><ProjectPlansManager slug={project.slug} /></div></section>
              <section id="media"><div className="eyebrow">3 · MEDIA</div><h2>Project media</h2><p>Upload project photos and videos to persistent project storage.</p><ProjectAssetUpload slug={project.slug} kind="media" accept="image/*,video/mp4,video/webm" /></section>
              <section id="owner"><div className="eyebrow">4 · OWNER</div><h2>Project owner</h2><p>{owner?.name || owner?.email || 'Project owner'}</p>{owner?.email && <small>{owner.email}</small>}</section>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="button primary" type="submit">Save settings</button></div>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
