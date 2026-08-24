import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import ProjectPlanViewer from '@/components/ProjectPlanViewer';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ slug: string }> };

export default async function PublicProjectPage({ params }: Props) {
  const { slug } = await params;
  const { data: project, error } = await supabaseAdmin()
    .from('projects')
    .select('id,slug,name,address,description,google_location_url,site_plan_url,drone_url,created_at')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !project) notFound();

  return (
    <main className="shell">
      <header className="header">
        <Link href={`/projects/${project.slug}`} className="brand"><span>LG</span><b>LANDGRID</b></Link>
        <Link href={`/projects/${project.slug}/manage`} className="header-link">Map &amp; Manage</Link>
      </header>
      <section className="page-heading">
        <div className="eyebrow">PROJECT</div>
        <h1>{project.name}</h1>
        {project.address && <p>{project.address}</p>}
      </section>
      <section className="panel" style={{ padding: 28 }}>
        <h2>Explore the project.</h2>
        {project.description && <p>{project.description}</p>}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20 }}>
          <Link className="button primary" href={`/projects/${project.slug}/manage`}>Explore project</Link>
          {project.google_location_url && <a className="button secondary" href={project.google_location_url} target="_blank" rel="noreferrer">Open location</a>}
        </div>
      </section>
      <section style={{ marginTop: 24 }}>
        <ProjectPlanViewer projectName={project.name} sitePlanUrl={project.site_plan_url} droneUrl={project.drone_url} />
      </section>
    </main>
  );
}
