import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserFromSession, getMembership } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

async function currentUser() {
  const cookieStore = await cookies();
  return getUserFromSession(cookieStore.get('landgrid_user')?.value);
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const user = await currentUser();
    if (!user) return NextResponse.redirect(new URL('/login', req.url));

    const role = await getMembership(user.id, slug);
    if (role !== 'admin') return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

    const form = await req.formData();
    const name = String(form.get('name') || '').trim();
    const address = String(form.get('address') || '').trim();
    if (!name || !address) return NextResponse.json({ error: 'Project name and address are required.' }, { status: 400 });

    const { error } = await supabaseAdmin().from('projects').update({
      name,
      address,
      description: String(form.get('description') || '').trim() || null,
      google_location_url: String(form.get('googleLocationUrl') || '').trim() || null,
      site_plan_url: String(form.get('sitePlanUrl') || '').trim() || null,
      drone_url: String(form.get('droneUrl') || '').trim() || null,
    }).eq('slug', slug);

    if (error) throw error;
    return NextResponse.redirect(new URL(`/projects/${slug}/settings?saved=1`, req.url));
  } catch (error) {
    console.error('project settings update failed', error);
    return NextResponse.json({ error: 'Unable to save project settings.' }, { status: 500 });
  }
}
