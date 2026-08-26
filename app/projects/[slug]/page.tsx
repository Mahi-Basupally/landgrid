import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getUserFromSession, getMembership } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import ProjectPlanViewer from '@/components/ProjectPlanViewer';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ slug: string }> };

export default async function PublicProjectPage({ params }: Props) {
  const { slug } = await params;
  const { data: project, error } = await supabaseAdmin().from('projects').select('id,slug,name,address,description,google_location_url,is_public,created_by,created_at').eq('slug', slug).maybeSingle();
  if (error || !project) notFound();

  if (!project.is_public) {
    const user = await getUserFromSession((await cookies()).get('landgrid_user')?.value);
    if (!user) redirect('/login');
    const role = await getMembership(user.id, project.slug);
    if (!role && project.created_by !== user.id) notFound();
  }

  return <main className="shell">
    <header className="header">
      <Link href={`/projects/${project.slug}`} className="brand"><span>LG</span><b>LANDGRID</b></Link>
      <Link href={`/projects/${project.slug}/manage`} className="header-link">Map &amp; Manage</Link>
    </header>
    <section className="page-heading"><div className="eyebrow">PROJECT</div><h1>{project.name}</h1>{project.address && <p>{project.address}</p>}</section>
    <section className="panel" style={{ padding: 28 }}><h2>Explore the project.</h2>{project.description && <p>{project.description}</p>}<div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20 }}><Link className="button primary" href={`/projects/${project.slug}/manage`}>Explore project</Link>{project.google_location_url && <a className="button secondary" href={project.google_location_url} target="_blank" rel="noreferrer">Open location</a>}</div></section>
    <section style={{ marginTop: 24 }}><ProjectPlanViewer projectName={project.name} projectSlug={project.slug} /></section>
  </main>;
}
