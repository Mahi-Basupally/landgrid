'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type Project = { id:string; slug:string; name:string; address:string; role:'admin'|'sales' };

export default function Projects(){
 const [projects,setProjects]=useState<Project[]>([]),[loading,setLoading]=useState(true),[creating,setCreating]=useState(false),[error,setError]=useState('');
 const [form,setForm]=useState({name:'',address:'',googleLocationUrl:'',description:'',sitePlanUrl:'',droneUrl:''});
 async function load(){setLoading(true);try{const r=await fetch('/api/projects',{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error);setProjects(d.projects||[]);}catch(e){setError(e instanceof Error?e.message:'Unable to load projects');}finally{setLoading(false)}}
 useEffect(()=>{load()},[]);
 async function create(e:React.FormEvent){e.preventDefault();setCreating(true);setError('');try{const r=await fetch('/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});const d=await r.json();if(!r.ok)throw new Error(d.error);window.location.href=`/projects/${d.project.slug}`;}catch(e){setError(e instanceof Error?e.message:'Unable to create project');setCreating(false)}}
 async function signOut(){try{await fetch('/api/auth/signout',{method:'POST',credentials:'same-origin'});}finally{window.location.href='/login'}}
 return <main className="shell"><header className="header"><Link href="/" className="brand"><span>LG</span><b>LANDGRID</b></Link><button type="button" className="header-link" onClick={signOut}>Sign out</button></header>
 <section className="page-heading"><div className="eyebrow">YOUR WORKSPACE</div><h1>Projects</h1><p>Open a project you have access to, or create a new project.</p></section>
 {error&&<div className="notice">{error}</div>}
 <section className="project-card" style={{marginBottom:24}}><div><div className="eyebrow">NEW PROJECT</div><h2>Create a project</h2><p>Add the location now. You can add your site plan, sections and drone view from the project settings.</p></div>
 <form onSubmit={create} style={{display:'grid',gap:10,width:'min(100%,620px)'}}><input className="input" required placeholder="Project name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><input className="input" required placeholder="Project address" value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/><input className="input" placeholder="Google Maps location link" value={form.googleLocationUrl} onChange={e=>setForm({...form,googleLocationUrl:e.target.value})}/><textarea className="input" placeholder="Short project description" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/><button className="button primary" disabled={creating}>{creating?'Creating…':'Create project'}</button></form></section>
 <div className="eyebrow">PROJECTS YOU CAN ACCESS</div>{loading?<div className="project-card"><p>Loading projects…</p></div>:projects.length===0?<div className="project-card"><h2>No projects yet</h2><p>Create your first project above. You will automatically become its admin.</p></div>:<div style={{display:'grid',gap:14,marginTop:12}}>{projects.map(p=><article className="project-card" key={p.id}><div><div className="eyebrow">{p.role.toUpperCase()}</div><h2>{p.name}</h2><p>{p.address}</p></div><div className="actions"><Link className="button secondary" href={`/projects/${p.slug}`}>View project</Link>{p.role==='admin'&&<Link className="button primary" href={`/projects/${p.slug}/manage`}>Map &amp; Manage</Link>}</div></article>)}</div>}
 </main>
}
