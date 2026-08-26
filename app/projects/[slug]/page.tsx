import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getUserFromSession, getMembership } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import PlotViewerShell from '@/components/plot-viewer-shell';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ slug: string }> };

export default async function PublicProjectPage({ params }: Props) {
  const { slug } = await params;
  const { data: project, error } = await supabaseAdmin()
    .from('projects')
    .select('id,slug,name,address,description,google_location_url,is_public,created_by,created_at')
    .eq('slug', slug)
    .maybeSingle();
  if (error || !project) notFound();

  if (!project.is_public) {
    const user = await getUserFromSession((await cookies()).get('landgrid_user')?.value);
    if (!user) redirect('/login');
    const role = await getMembership(user.id, project.slug);
    if (!role && project.created_by !== user.id) notFound();
  }

  return <PlotViewerShell projectSlug={project.slug} projectName={project.name} />;
}
