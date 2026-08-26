"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, LogOut, Plus, X } from "lucide-react";

type Project = { id: string; slug: string; name: string; address: string; description?: string | null; role: "admin" | "sales" };

const btn: React.CSSProperties = { border: "1px solid #dce3df", background: "white", color: "#17211b", padding: "10px 14px", borderRadius: 9, fontWeight: 750, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 };

function textLogo(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words.slice(0, 2).map(w => w[0]) : name.trim().slice(0, 2)).toUpperCase() || "LG";
}

export default function ManageProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", address: "", googleLocationUrl: "", description: "" });

  async function load() {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/projects", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Unable to load projects");
      setProjects(d.projects || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load projects"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setCreating(true); setError("");
    try {
      const r = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Unable to create project");
      window.location.href = `/projects/${d.project.slug}/editor`;
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create project"); setCreating(false); }
  }

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST", credentials: "same-origin" });
    window.location.href = "/";
  }

  return <div style={{ minHeight: "100vh", background: "#f3f5f8", color: "#172033", fontFamily: "Inter,system-ui,sans-serif" }}>
    <header style={{ height: 68, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px", background: "white", borderBottom: "1px solid #e2e8f0" }}>
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit" }}><span style={{ width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", background: "#172033", color: "white", fontSize: 11, fontWeight: 900 }}>LG</span><span style={{ fontWeight: 900, letterSpacing: ".08em" }}>LANDGRID</span></Link>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>MANAGE PROJECTS</span><button type="button" onClick={() => void signOut()} style={{ ...btn, padding: "8px 11px" }} title="Sign out"><LogOut size={14} /></button></div>
    </header>

    <main style={{ maxWidth: 1320, margin: "0 auto", padding: "36px 22px 64px" }}>
      <section style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20, flexWrap: "wrap", marginBottom: 26 }}>
        <div><div style={{ fontSize: 11, letterSpacing: ".16em", fontWeight: 900, color: "#728078" }}>YOUR WORKSPACE</div><h1 style={{ margin: "7px 0", fontSize: 36, letterSpacing: "-.04em" }}>Projects</h1><p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>Manage all your projects from one place.</p></div>
        <button type="button" onClick={() => { setError(""); setShowCreate(true); }} style={{ ...btn, background: "#172033", color: "white", borderColor: "#172033", padding: "11px 16px" }}><Plus size={16} /> New project</button>
      </section>

      {error && <div style={{ marginBottom: 18, padding: "11px 13px", borderRadius: 9, background: "#fff1f2", border: "1px solid #fecdd3", color: "#be123c", fontSize: 13 }}>{error}</div>}

      {loading ? <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>Loading projects…</div> : projects.length === 0 ? <div style={{ background: "white", border: "1px solid #e1e7e3", borderRadius: 14, padding: "64px 24px", textAlign: "center" }}><div style={{ fontSize: 11, letterSpacing: ".14em", fontWeight: 900, color: "#728078" }}>EMPTY WORKSPACE</div><h2 style={{ margin: "9px 0 7px", fontSize: 24 }}>Create your first project</h2><p style={{ margin: "0 auto 20px", maxWidth: 430, color: "#64748b", fontSize: 14 }}>Start with a project and build its master plan, sections and plots in the editor.</p><button type="button" onClick={() => setShowCreate(true)} style={{ ...btn, background: "#172033", color: "white", borderColor: "#172033" }}><Plus size={15} /> New project</button></div> : <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(270px,1fr))", gap: 18 }}>
        {projects.map(p => <Link key={p.id} href={`/projects/${p.slug}/editor`} style={{ textDecoration: "none", color: "inherit", background: "white", border: "1px solid #e1e7e3", borderRadius: 14, padding: 20, minHeight: 190, display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 2px 10px rgba(15,23,42,.04)", transition: "transform .15s ease, box-shadow .15s ease" }}>
          <div><div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}><div style={{ width: 58, height: 58, borderRadius: 12, background: "#172033", color: "white", display: "grid", placeItems: "center", fontSize: 17, fontWeight: 900, letterSpacing: ".04em" }}>{textLogo(p.name)}</div><span style={{ padding: "4px 8px", borderRadius: 999, background: p.role === "admin" ? "#eef2ff" : "#f1f5f9", color: p.role === "admin" ? "#4338ca" : "#475569", fontSize: 10, fontWeight: 900 }}>{p.role.toUpperCase()}</span></div><h2 style={{ margin: "17px 0 5px", fontSize: 20, letterSpacing: "-.025em" }}>{p.name}</h2><div style={{ color: "#64748b", fontSize: 13, lineHeight: 1.45 }}>{p.address || "No address provided"}</div></div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20, paddingTop: 14, borderTop: "1px solid #edf0ee", color: "#64748b" }}><span style={{ fontSize: 12, fontWeight: 750 }}>Open editor</span><ArrowRight size={16} /></div>
        </Link>)}
      </section>}
    </main>

    {showCreate && <div role="dialog" aria-modal="true" aria-labelledby="create-project-title" onMouseDown={e => e.target === e.currentTarget && setShowCreate(false)} style={{ position: "fixed", inset: 0, zIndex: 50, display: "grid", placeItems: "center", padding: 20, background: "rgba(15,23,42,.48)" }}><div style={{ width: "min(100%,600px)", background: "white", borderRadius: 14, border: "1px solid #e2e8f0", boxShadow: "0 24px 70px rgba(0,0,0,.25)", padding: 25 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}><div><div style={{ fontSize: 11, letterSpacing: ".14em", fontWeight: 900, color: "#728078" }}>NEW PROJECT</div><h2 id="create-project-title" style={{ margin: "7px 0 5px", fontSize: 24 }}>Create a project</h2><p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>You will become the project admin.</p></div><button type="button" onClick={() => setShowCreate(false)} style={{ ...btn, padding: 8 }} aria-label="Close"><X size={16} /></button></div><form onSubmit={create} style={{ display: "grid", gap: 11, marginTop: 22 }}><input required placeholder="Project name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ width: "100%", padding: "12px 13px", border: "1px solid #d8e0db", borderRadius: 8 }} /><input required placeholder="Project address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} style={{ width: "100%", padding: "12px 13px", border: "1px solid #d8e0db", borderRadius: 8 }} /><input placeholder="Google Maps location link" value={form.googleLocationUrl} onChange={e => setForm({ ...form, googleLocationUrl: e.target.value })} style={{ width: "100%", padding: "12px 13px", border: "1px solid #d8e0db", borderRadius: 8 }} /><textarea placeholder="Short project description" rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ width: "100%", padding: "12px 13px", border: "1px solid #d8e0db", borderRadius: 8, resize: "vertical" }} /><div style={{ display: "flex", justifyContent: "flex-end", gap: 9 }}><button type="button" onClick={() => setShowCreate(false)} style={btn}>Cancel</button><button type="submit" disabled={creating} style={{ ...btn, background: "#172033", color: "white", borderColor: "#172033", opacity: creating ? .65 : 1 }}>{creating ? "Creating…" : "Create project"}</button></div></form></div></div>}
  </div>;
}
