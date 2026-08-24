import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUserFromRequest, getMembership } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import ProjectPlanViewer from '@/components/ProjectPlanViewer';

export const dynamic = 'force-dynamic';

export default async function ManageProject({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: project, error } = await supabaseAdmin()
    .from('projects')
    .select('id,slug,name,address,site_plan_url,drone_url')
    .eq('slug', slug)
    .maybeSingle();
  if (error || !project) notFound();

  const cookieStore = await cookies();
  const token = cookieStore.get('landgrid_user')?.value;
  const user = await getCurrentUserFromRequest(new Request('http://landgrid.local', { headers: { cookie: token ? `landgrid_user=${token}` : '' } }));
  if (!user) redirect(`/login?next=/projects/${slug}/manage`);

  const role = await getMembership(user.id, slug);
  if (!role) redirect(`/projects/${slug}`);

  return (
    <main className="shell">
      <header className="header">
        <Link href={`/projects/${slug}`} className="brand"><span>LG</span><b>LANDGRID</b></Link>
        <Link href="/projects" className="header-link">Projects</Link>
      </header>
      <section className="page-heading">
        <div className="eyebrow">MAP &amp; MANAGE · {role.toUpperCase()}</div>
        <h1>{project.name}</h1>
        <p>{project.address}</p>
      </section>
      <div className="manage-layout">
        <aside className="panel">
          <h3>Project plan</h3>
          <label>Plan<select defaultValue="master"><option value="master">Master Plan</option><option value="section-1">Section 1</option><option value="section-2">Section 2</option></select></label>
          <div style={{ marginTop: 18 }}>
            <div className="eyebrow">VIEW</div>
            <p style={{ marginTop: 8, color: 'var(--muted, #6b7280)' }}>Use Map / Drone above the plan to switch the project asset.</p>
          </div>
        </aside>
        <ProjectPlanViewer projectName={project.name} sitePlanUrl={project.site_plan_url} droneUrl={project.drone_url} />
        <aside className="details">
          <div className="eyebrow">PROJECT</div>
          <h2>Manage plots</h2>
          <p>Use this workspace to manage the project's map and plot inventory.</p>
          <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
            <Link className="button primary full" href={`/projects/${slug}`}>View public project</Link>
            {role === 'admin' && <Link className="button secondary full" href={`/projects/${slug}/settings`}>Project settings</Link>}
          </div>
        </aside>
      </div>
    </main>
  );
}
