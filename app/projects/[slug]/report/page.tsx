import { notFound, redirect } from 'next/navigation';
import { getCurrentUser, getMembership } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import ReportClient from './report-client';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }> };

function normalizeSlug(v: string) { return v.toLowerCase().replace(/[^a-z0-9]/g, ''); }

export default async function ReportPage({ params }: Props) {
  const { slug } = await params;
  const db = supabaseAdmin();
  const { data: exact } = await db.from('projects').select('id,slug,name,address,is_public,created_by').eq('slug', slug).maybeSingle();
  let project = exact;
  if (!project) {
    const { data: all } = await db.from('projects').select('id,slug,name,address,is_public,created_by');
    project = (all || []).find((p: any) => normalizeSlug(p.slug) === normalizeSlug(slug)) || null;
  }
  if (!project) notFound();
  const user = await getCurrentUser();
  const role = user ? await getMembership(user.id, project.slug) : null;
  if (!project.is_public && !role && project.created_by !== user?.id) {
    if (!user) redirect('/login');
    notFound();
  }
  return <ReportClient slug={project.slug} projectName={project.name} />;
}
