"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useHeader } from "@/lib/header-context";
import { Check, Copy, Globe2, Shield, Users, X } from "lucide-react";

type Project = { id: string; slug: string; name: string; address: string; description?: string | null; google_location_url?: string | null; is_public?: boolean };
type Member = { userId: string; email: string; name?: string | null; role: "admin" | "sales" };

const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #dbe2ea", borderRadius: 8, padding: "10px 11px", fontSize: 13, color: "#172033", background: "#fff" };
const button: React.CSSProperties = { border: "1px solid #dbe2ea", borderRadius: 8, background: "#fff", color: "#243047", padding: "9px 12px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, fontSize: 12, fontWeight: 800, cursor: "pointer", textDecoration: "none" };
const primary: React.CSSProperties = { ...button, background: "#172554", borderColor: "#172554", color: "#fff" };
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 18, boxShadow: "0 1px 2px rgba(15,23,42,.04)" };

export default function SettingsClient({ project: initialProject, members: initialMembers }: { project: Project; members: Member[] }) {
  const { setState: setHeaderState } = useHeader();
  const [project, setProject] = useState(initialProject);
  useEffect(() => { setHeaderState({ projectName: initialProject.name }); }, [initialProject.name]);
  const [members, setMembers] = useState(initialMembers);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "sales">("sales");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const shareUrl = useMemo(() => typeof window === "undefined" ? `/projects/${project.slug}` : `${window.location.origin}/projects/${project.slug}`, [project.slug]);

  async function saveProject(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    const r = await fetch(`/api/projects/${project.slug}/settings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(project) });
    const d = await r.json().catch(() => ({}));
    setBusy(false); setMessage(r.ok ? "Project settings saved" : d.error || "Unable to save settings");
  }

  async function togglePublic() {
    const next = !project.is_public; setProject(p => ({ ...p, is_public: next })); setBusy(true); setMessage("");
    const r = await fetch(`/api/projects/${project.slug}/settings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...project, is_public: next }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) setProject(p => ({ ...p, is_public: !next }));
    setBusy(false); setMessage(r.ok ? (next ? "Project is now public" : "Project is private") : d.error || "Unable to update sharing");
  }

  async function copyLink() { await navigator.clipboard?.writeText(shareUrl); setMessage("Public link copied"); }

  async function addMember(e: React.FormEvent) {
    e.preventDefault(); if (!email.trim()) return; setBusy(true); setMessage("");
    const r = await fetch(`/api/projects/${project.slug}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { setEmail(""); setMessage("Member added"); await refreshMembers(); } else setMessage(d.error || "Unable to add member");
    setBusy(false);
  }

  async function refreshMembers() { const r = await fetch(`/api/projects/${project.slug}/members`, { cache: "no-store" }); if (r.ok) { const d = await r.json(); setMembers(d.members || []); } }
  async function changeRole(userId: string, nextRole: "admin" | "sales") { setBusy(true); await fetch(`/api/projects/${project.slug}/members`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, role: nextRole }) }); await refreshMembers(); setBusy(false); }
  async function removeMember(userId: string) { if (!confirm("Remove this member from the project?")) return; setBusy(true); await fetch(`/api/projects/${project.slug}/members`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) }); await refreshMembers(); setBusy(false); }

  return <div style={{ background: "#f3f5f8", color: "#172033", fontFamily: "Inter,system-ui,sans-serif" }}>
    <div style={{ display: "grid", gridTemplateColumns: "250px minmax(0,1fr) 300px", minHeight: 0 }}>
      <aside style={{ background: "#fff", borderRight: "1px solid #e2e8f0", padding: 12, overflow: "auto" }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", margin: "8px 4px" }}>PROJECT SETTINGS</div>
        {[['#project','Project'],['#sharing','Public sharing'],['#members','Project members']].map(([href,label]) => <a key={href} href={href} style={{ ...button, width: "100%", boxSizing: "border-box", justifyContent: "flex-start", marginBottom: 6 }}>{label}</a>)}
        <div style={{ marginTop: 18, padding: 12, borderRadius: 10, background: "#f8fafc", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>Use this page for project-level information, access and sharing. Plot owners stay on individual plots in Map &amp; Manage.</div>
      </aside>
      <main style={{ minWidth: 0, overflow: "auto", padding: 18 }}>
        <div style={{ maxWidth: 820, margin: "0 auto", display: "grid", gap: 14 }}>
          <section id="project" style={card}><div style={{ fontSize: 11, fontWeight: 900, color: "#64748b" }}>PROJECT INFORMATION</div><h2 style={{ margin: "4px 0 16px", fontSize: 18 }}>Project details</h2><form onSubmit={saveProject} style={{ display: "grid", gap: 13 }}><label style={{ fontSize: 11, fontWeight: 800 }}>Project name<input style={{ ...input, marginTop: 5 }} value={project.name} onChange={e=>setProject(p=>({...p,name:e.target.value}))} /></label><label style={{ fontSize: 11, fontWeight: 800 }}>Address<input style={{ ...input, marginTop: 5 }} value={project.address || ""} onChange={e=>setProject(p=>({...p,address:e.target.value}))} /></label><label style={{ fontSize: 11, fontWeight: 800 }}>Description<textarea style={{ ...input, marginTop: 5, resize: "vertical" }} rows={5} value={project.description || ""} onChange={e=>setProject(p=>({...p,description:e.target.value}))} /></label><label style={{ fontSize: 11, fontWeight: 800 }}>Google Maps location<input style={{ ...input, marginTop: 5 }} value={project.google_location_url || ""} onChange={e=>setProject(p=>({...p,google_location_url:e.target.value}))} placeholder="Optional map link" /></label><div><button type="submit" style={primary} disabled={busy}><Check size={14}/> Save project</button></div></form></section>
          <section id="sharing" style={card}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", background: "#ecfdf5", color: "#15803d" }}><Globe2 size={17}/></div><div><div style={{ fontSize: 11, fontWeight: 900, color: "#64748b" }}>PUBLIC SHARING</div><h2 style={{ margin: "2px 0", fontSize: 18 }}>Share your project</h2></div></div><div style={{ marginTop: 16, padding: 13, borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}><div><div style={{ fontSize: 13, fontWeight: 800 }}>{project.is_public ? "Project is public" : "Project is private"}</div><div style={{ marginTop: 3, fontSize: 11, color: "#64748b" }}>{project.is_public ? "Anyone with the link can view the project." : "Only authorized users can access the project."}</div></div><button type="button" onClick={togglePublic} style={project.is_public ? primary : button}>{project.is_public ? "Public" : "Make public"}</button></div></div><div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr auto", gap: 7 }}><input readOnly value={shareUrl} style={{ ...input, background: "#f8fafc" }}/><button type="button" onClick={copyLink} style={button}><Copy size={14}/> Copy link</button></div></section>
          <section id="members" style={card}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", background: "#eef2ff", color: "#3730a3" }}><Users size={17}/></div><div><div style={{ fontSize: 11, fontWeight: 900, color: "#64748b" }}>ACCESS</div><h2 style={{ margin: "2px 0", fontSize: 18 }}>Project members</h2></div></div><form onSubmit={addMember} style={{ display: "grid", gridTemplateColumns: "1fr 120px auto", gap: 7, marginTop: 16 }}><input style={input} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@company.com"/><select style={input} value={role} onChange={e=>setRole(e.target.value as "admin"|"sales")}><option value="sales">Sales</option><option value="admin">Admin</option></select><button style={primary} type="submit" disabled={busy}>Add</button></form><div style={{ display: "grid", gap: 7, marginTop: 14 }}>{members.map(m=><div key={m.userId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 11px", border: "1px solid #e8edf3", borderRadius: 9 }}><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 800 }}>{m.name || m.email}</div>{m.name && <div style={{ fontSize: 11, color: "#64748b" }}>{m.email}</div>}</div><select aria-label={`Role for ${m.email}`} value={m.role} onChange={e=>void changeRole(m.userId,e.target.value as "admin"|"sales")} style={{ ...input, width: 100, padding: "7px 8px" }} disabled={busy}><option value="sales">Sales</option><option value="admin">Admin</option></select><button type="button" title="Remove member" onClick={()=>void removeMember(m.userId)} style={{ ...button, padding: 7 }} disabled={busy}><X size={14}/></button></div>)}{!members.length&&<div style={{ padding: 18, textAlign: "center", color: "#94a3b8", fontSize: 12, border: "1px dashed #dbe2ea", borderRadius: 9 }}>No members yet.</div>}</div></section>
        </div>
      </main>
      <aside style={{ background: "#fff", borderLeft: "1px solid #e2e8f0", padding: 14, overflow: "auto" }}><div style={card}><div style={{ fontSize: 11, fontWeight: 900, color: "#64748b" }}>PROJECT ACCESS</div><div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 13 }}><Shield size={17} color="#475569"/><div><div style={{ fontSize: 13, fontWeight: 800 }}>Members</div><div style={{ fontSize: 11, color: "#64748b" }}>{members.length} project user{members.length === 1 ? "" : "s"}</div></div></div><div style={{ height: 1, background: "#edf1f5", margin: "14px 0" }}/><div style={{ display: "flex", alignItems: "center", gap: 10 }}><Globe2 size={17} color={project.is_public ? "#15803d" : "#64748b"}/><div><div style={{ fontSize: 13, fontWeight: 800 }}>{project.is_public ? "Public" : "Private"}</div><div style={{ fontSize: 11, color: "#64748b" }}>{project.is_public ? "Shareable by link" : "Not publicly visible"}</div></div></div></div><div style={{ ...card, marginTop: 12, background: "#172554", borderColor: "#172554", color: "#fff" }}><div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1, opacity: .65 }}>LANDGRID</div><h3 style={{ margin: "7px 0 5px", fontSize: 16 }}>Project-level settings</h3><p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, opacity: .78 }}>Project name, description, team access and public sharing live here. Individual plot owners remain in Map &amp; Manage.</p></div></aside>
    </div>
  </div>;
}
