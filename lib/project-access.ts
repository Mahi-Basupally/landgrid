import {cookies} from 'next/headers'; import {readMemberships,readUsers,Role} from './auth';
export async function currentProjectRole(slug:string):Promise<Role|null>{const c=await cookies(); const id=c.get('landgrid_user')?.value; if(!id)return null; const user=readUsers().find(u=>u.id===id); if(!user)return null; return readMemberships().find(m=>m.projectSlug===slug&&m.userId===user.id)?.role||null;}
export function canUpdatePlots(role:Role|null){return role==='admin'||role==='sales';}
