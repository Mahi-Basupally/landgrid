import { notFound, redirect } from 'next/navigation';
import { getCurrentUser, getMembership } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import PlotEditorShell from '@/components/plot-editor-shell';

export const dynamic = 'force-dynamic';

export default async function ProjectEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { data: project, error } = await supabaseAdmin().from('projects').select('id,slug,created_by').eq('slug', slug).maybeSingle();
  if (error || !project) notFound();
  const role = await getMembership(user.id, project.slug);
  if (!role) notFound();
  return <PlotEditorShell projectSlug={project.slug} />;
}
