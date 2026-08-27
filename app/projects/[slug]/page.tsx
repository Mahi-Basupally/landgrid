import { notFound, redirect } from 'next/navigation';
import { getCurrentUser, getMembership } from '@/lib/auth';
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

  const user = await getCurrentUser();
  const role = user ? await getMembership(user.id, project.slug) : null;

  // Public projects are viewable by anyone, but management remains member-only.
  if (!project.is_public && !role) {
    if (!user) redirect('/login');
    notFound();
  }

  return <PlotViewerShell projectSlug={project.slug} projectName={project.name} isLoggedIn={Boolean(user)} />;
}
