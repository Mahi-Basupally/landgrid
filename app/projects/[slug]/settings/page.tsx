import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getUserFromSession, getMembership } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export default async function ProjectSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get('landgrid_user')?.value;
  const user = await getUserFromSession(token);
  if (!user) redirect('/login');

  const role = await getMembership(user.id, slug);
  if (!role) notFound();
  if (role !== 'admin') redirect(`/projects/${slug}`);

  const { data: project, error } = await supabaseAdmin()
    .from('projects')
    .select('id,slug,name,address,description,google_location_url,site_plan_url,drone_url,created_by,created_at')
    .eq('slug', slug)
    .maybeSingle();
  if (error || !project) notFound();

  const { data: owner } = await supabaseAdmin().from('users').select('email,name').eq('id', project.created_by).maybeSingle();

  return (
    <main className="shell">
      <header className="header">
        <Link href="/projects" className="brand"><span>LG</span><b>LANDGRID</b></Link>
        <nav style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="button secondary" href={`/projects/${slug}`}>Project Home</Link>
          <Link className="button secondary" href={`/projects/${slug}/manage`}>Map &amp; Manage</Link>
        </nav>
      </header>

      <section className="page-heading">
        <div className="eyebrow">PROJECT SETTINGS</div>
        <h1>{project.name}</h1>
        <p>Configure the project, plan, drone view and public presentation.</p>
      </section>

      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(0,1fr)' }}>
          <aside style={{ padding: 18, borderRight: '1px solid var(--border, #e5e7eb)' }}>
            <div className="eyebrow">SETTINGS</div>
            <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
              <a href="#project" className="button secondary">Project</a>
              <a href="#plan" className="button secondary">Project plan</a>
              <a href="#media" className="button secondary">Media</a>
              <a href="#owner" className="button secondary">Owner</a>
              <a href={`/projects/${slug}/members`} className="button secondary">Project users</a>
            </div>
          </aside>

          <section style={{ padding: 24, minWidth: 0 }}>
            <form id="settings-form" action={`/api/projects/${slug}/settings`} method="post" style={{ display: 'grid', gap: 24 }}>
              <section id="project">
                <div className="eyebrow">1 · PROJECT</div>
                <h2>Project information</h2>
                <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                  <label>Project name<input name="name" defaultValue={project.name} required /></label>
                  <label>Address<input name="address" defaultValue={project.address || ''} required /></label>
                  <label>Google location URL<input name="googleLocationUrl" defaultValue={project.google_location_url || ''} placeholder="https://maps.google.com/..." /></label>
                  <label>Project description<textarea name="description" defaultValue={project.description || ''} rows={4} /></label>
                </div>
              </section>

              <section id="plan">
                <div className="eyebrow">2 · PROJECT PLAN</div>
                <h2>Master plan &amp; sections</h2>
                <p>Add the master/site-plan SVG and drone map source used by Map &amp; Manage.</p>
                <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                  <label>Master/site plan SVG or image URL<input name="sitePlanUrl" defaultValue={project.site_plan_url || ''} placeholder="/uploads/master-plan.svg or https://..." /></label>
                  <label>Drone map image URL<input name="droneUrl" defaultValue={project.drone_url || ''} placeholder="/uploads/drone-map.jpg or https://..." /></label>
                </div>
              </section>

              <section id="media">
                <div className="eyebrow">3 · MEDIA</div>
                <h2>Project media</h2>
                <p>The media showcase can be expanded with additional project photos and videos. The plan and drone assets above are the primary map assets.</p>
              </section>

              <section id="owner">
                <div className="eyebrow">4 · OWNER</div>
                <h2>Project owner</h2>
                <p>{owner?.name || owner?.email || 'Project owner'}</p>
                {owner?.email && <small>{owner.email}</small>}
              </section>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="button primary" type="submit">Save settings</button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
