import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCurrentUserFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
}

async function currentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('landgrid_user')?.value;
  if (!token) return null;
  return getCurrentUserFromRequest(new Request('http://landgrid.local', { headers: { cookie: `landgrid_user=${token}` } }));
}

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data, error } = await supabaseAdmin()
      .from('project_members')
      .select('role, projects!inner(id,slug,name,address,description,google_location_url,created_at)')
      .eq('user_id', user.id)
      .order('created_at', { referencedTable: 'projects', ascending: false });
    if (error) throw error;

    return NextResponse.json({ projects: (data || []).map((row: any) => ({ ...row.projects, role: row.role })) });
  } catch (error) {
    console.error('projects GET failed', error);
    return NextResponse.json({ error: 'Unable to load projects.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json();
    const name = String(body.name || '').trim();
    const address = String(body.address || '').trim();
    if (!name || !address) return NextResponse.json({ error: 'Project name and address are required.' }, { status: 400 });

    const baseSlug = slugify(name) || `project-${Date.now()}`;
    let slug = baseSlug;
    for (let i = 2; i < 100; i++) {
      const { data } = await supabaseAdmin().from('projects').select('id').eq('slug', slug).maybeSingle();
      if (!data) break;
      slug = `${baseSlug}-${i}`;
    }

    const { data: project, error: projectError } = await supabaseAdmin().from('projects').insert({
      slug,
      name,
      address,
      google_location_url: String(body.googleLocationUrl || '').trim() || null,
      description: String(body.description || '').trim() || null,
      created_by: user.id,
    }).select('*').single();
    if (projectError) throw projectError;

    const { error: memberError } = await supabaseAdmin().from('project_members').insert({ project_id: project.id, user_id: user.id, role: 'admin' });
    if (memberError) throw memberError;

    // The database trigger creates the master_plan record automatically.
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error('projects POST failed', error);
    return NextResponse.json({ error: 'Unable to create project.' }, { status: 500 });
  }
}
