import { cookies } from 'next/headers';
import { getCurrentUserFromRequest, getMembership, Role } from './auth';

export async function currentProjectRole(slug: string): Promise<Role | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('landgrid_user')?.value;
  if (!token) return null;

  const user = await getCurrentUserFromRequest(
    new Request('http://landgrid.local', {
      headers: { cookie: `landgrid_user=${token}` },
    }),
  );
  if (!user) return null;

  return getMembership(user.id, slug);
}

export function canUpdatePlots(role: Role | null) {
  return role === 'admin' || role === 'sales';
}
