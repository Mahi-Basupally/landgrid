import fs from 'node:fs'; import path from 'node:path';
export type Role='admin'|'sales';
export type User={id:string;email:string;name?:string};
export type Membership={userId:string;projectSlug:string;role:Role};
const root=process.cwd();
export function appConfig(){const p=path.join(root,'config','application.properties');const out:Record<string,string>={}; if(fs.existsSync(p)){for(const line of fs.readFileSync(p,'utf8').split(/\r?\n/)){const i=line.indexOf('=');if(i>0&&!line.startsWith('#'))out[line.slice(0,i).trim()]=line.slice(i+1).trim();}} return out;}
export function loginCode(){return process.env.LANDGRID_LOGIN_CODE||appConfig().LANDGRID_LOGIN_CODE||'123456';}
export function readUsers():User[]{const p=path.join(root,'data','users.json');return fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):[];}
export function readMemberships():Membership[]{const p=path.join(root,'data','memberships.json');return fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):[];}
export function writeMemberships(v:Membership[]){const p=path.join(root,'data','memberships.json');fs.writeFileSync(p,JSON.stringify(v,null,2));}
