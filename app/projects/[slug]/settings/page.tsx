import { redirect, notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { getUserFromSession, getMembership, getUserById, readMemberships } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import SettingsClient from './settings-client';

export const dynamic = 'force-dynamic';

function normalizeSlug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]/g, ''); }

export default async function ProjectSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: requestedSlug } = await params;
  const token = (await cookies()).get('landgrid_user')?.value;
  const user = await getUserFromSession(token);
  if (!user) redirect('/login');

  const db = supabaseAdmin();
  const { data: exact } = await db.from('projects').select('id,slug,name,address,description,google_location_url,is_public,created_by,created_at').eq('slug', requestedSlug).maybeSingle();
  let project = exact;
  if (!project) {
    const { data: projects, error } = await db.from('projects').select('id,slug,name,address,description,google_location_url,is_public,created_by,created_at');
    if (error) throw error;
    project = (projects || []).find(p => normalizeSlug(p.slug) === normalizeSlug(requestedSlug)) || null;
  }
  if (!project) notFound();

  const role = await getMembership(user.id, project.slug);
  if (role !== 'admin' && project.created_by !== user.id) redirect(`/projects/${project.slug}`);

  const memberships = (await readMemberships()).filter(m => m.projectSlug === project.slug);
  const members = await Promise.all(memberships.map(async m => {
    const member = await getUserById(m.userId);
    return { userId: m.userId, email: member?.email || '', name: member?.name || null, role: m.role };
  }));

  return <SettingsClient project={project} members={members} />;
}
