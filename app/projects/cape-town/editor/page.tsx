import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { getUserFromSession, getMembership } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import LotEditor from '../../../../components/lot-editor';
import ProjectPlansManager from '../../../../components/ProjectPlansManager';

export const dynamic = 'force-dynamic';

export default async function CapeTownEditorPage() {
  const token = (await cookies()).get('landgrid_user')?.value;
  const user = await getUserFromSession(token);
  if (!user) redirect('/login');

  const { data: project, error } = await supabaseAdmin().from('projects').select('id,slug,name,created_by').eq('slug', 'cape-town').maybeSingle();
  if (error || !project) notFound();

  const role = await getMembership(user.id, project.slug);
  if (role !== 'admin' && project.created_by !== user.id) redirect(`/projects/${project.slug}`);

  return (
    <main>
      <section style={{ padding: '18px 24px', borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
        <div style={{ maxWidth: 1500, margin: '0 auto' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', color: '#6b7280', marginBottom: 6 }}>EDITOR / SITE PLANS</div>
          <h2 style={{ margin: 0, fontSize: 22 }}>Map &amp; section plans</h2>
          <p style={{ margin: '6px 0 14px', color: '#6b7280' }}>Choose a plan type. Add Section 1, Section 2 and upload its map and drone image. Files are saved to the project site plan table.</p>
          <ProjectPlansManager slug={project.slug} />
        </div>
      </section>
      <LotEditor projectSlug={project.slug} />
    </main>
  );
}
