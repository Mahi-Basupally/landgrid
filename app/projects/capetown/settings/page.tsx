"use client";

import Link from "next/link";
import { ArrowLeft, Check, ChevronRight, Shield, Settings, Users } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

type Project = { id: string; slug: string; name: string; address: string; description?: string | null; google_location_url?: string | null; role?: string };
type Member = { userId: string; email: string; name?: string | null; role: "admin" | "sales" };

const inputStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #dbe2ea", borderRadius: 9, padding: "10px 11px", fontSize: 13, outline: "none", background: "#fff", color: "#182235" };
const buttonStyle: React.CSSProperties = { border: "1px solid #dbe2ea", background: "#fff", color: "#243047", borderRadius: 9, padding: "9px 12px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, fontSize: 12, fontWeight: 800, cursor: "pointer", textDecoration: "none" };
const cardStyle: React.CSSProperties = { background: "#fff", border: "1px solid #e4e9f0", borderRadius: 14, padding: 18, boxShadow: "0 1px 2px rgba(15,23,42,.04)" };

export default function CapeTownSettingsPage() {
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "sales">("sales");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      const [projectsResponse, membersResponse] = await Promise.all([
        fetch("/api/projects", { cache: "no-store" }),
        fetch("/api/projects/cape-town/members", { cache: "no-store" }),
      ]);
      const projectsData = await projectsResponse.json();
      const membersData = await membersResponse.json();
      if (!projectsResponse.ok) throw new Error(projectsData.error || "Unable to load project");
      setProject((projectsData.projects || []).find((p: Project) => p.slug === "cape-town") || null);
      if (membersResponse.ok) setMembers(membersData.members || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load settings");
    }
  }

  async function addMember(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/projects/cape-town/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), role }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to add user");
      setEmail("");
      setMessage("User added");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add user");
    } finally {
      setBusy(false);
    }
  }

  if (!project) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f4f6f9", color: "#64748b", fontFamily: "Inter,ui-sans-serif,system-ui,sans-serif" }}>Loading project settings…</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6f9", color: "#182235", fontFamily: "Inter,ui-sans-serif,system-ui,sans-serif" }}>
      <header style={{ height: 64, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", background: "rgba(255,255,255,.98)", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", background: "#172554", color: "#fff", fontWeight: 900 }}>LG</div>
          <div><div style={{ fontSize: 10, letterSpacing: 1.1, fontWeight: 900, color: "#64748b" }}>LANDGRID · SETTINGS</div><div style={{ fontSize: 18, fontWeight: 800 }}>{project.name}</div></div>
        </div>
        <Link href="/projects/capetown/editor" style={buttonStyle}><ArrowLeft size={14} /> Back to Map & Manage</Link>
      </header>

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 22px 50px" }}>
        <div style={{ marginBottom: 24 }}><div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1, color: "#64748b" }}>PROJECT SETTINGS</div><h1 style={{ margin: "5px 0 6px", fontSize: 28, letterSpacing: -.5 }}>Manage your project</h1><p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>Project details and access are managed here. Mapping and media stay in the editor.</p></div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: 16, alignItems: "start" }}>
          <div style={{ display: "grid", gap: 16 }}>
            <section style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}><div style={{ width: 34, height: 34, borderRadius: 9, background: "#eef2ff", color: "#3730a3", display: "grid", placeItems: "center" }}><Settings size={17} /></div><div><h2 style={{ margin: 0, fontSize: 16 }}>Project details</h2><p style={{ margin: "3px 0 0", fontSize: 11, color: "#64748b" }}>Basic information shown throughout LandGrid.</p></div></div>
              <form action={`/api/projects/${project.slug}/settings`} method="post" style={{ display: "grid", gap: 13 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: "#475569" }}>Project name<input name="name" defaultValue={project.name} style={{ ...inputStyle, marginTop: 5 }} /></label>
                <label style={{ fontSize: 11, fontWeight: 800, color: "#475569" }}>Address<input name="address" defaultValue={project.address} style={{ ...inputStyle, marginTop: 5 }} /></label>
                <label style={{ fontSize: 11, fontWeight: 800, color: "#475569" }}>Google Maps location<input name="googleLocationUrl" defaultValue={project.google_location_url || ""} placeholder="Optional map link" style={{ ...inputStyle, marginTop: 5 }} /></label>
                <label style={{ fontSize: 11, fontWeight: 800, color: "#475569" }}>Description<textarea name="description" defaultValue={project.description || ""} rows={4} style={{ ...inputStyle, marginTop: 5, resize: "vertical" }} /></label>
                <div><button type="submit" style={{ ...buttonStyle, background: "#172554", color: "#fff", borderColor: "#172554" }}><Check size={14} /> Save project details</button></div>
              </form>
            </section>

            <section style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}><div style={{ width: 34, height: 34, borderRadius: 9, background: "#f1f5f9", color: "#334155", display: "grid", placeItems: "center" }}><Users size={17} /></div><div><h2 style={{ margin: 0, fontSize: 16 }}>Project users & access</h2><p style={{ margin: "3px 0 0", fontSize: 11, color: "#64748b" }}>Invite people who can manage this project.</p></div></div>
              <form onSubmit={addMember} style={{ display: "grid", gridTemplateColumns: "1fr 130px auto", gap: 8, marginBottom: 15 }}>
                <input aria-label="User email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" type="email" style={inputStyle} />
                <select aria-label="User role" value={role} onChange={e => setRole(e.target.value as "admin" | "sales")} style={inputStyle}><option value="sales">Sales</option><option value="admin">Admin</option></select>
                <button type="submit" disabled={busy} style={{ ...buttonStyle, background: busy ? "#eef2f7" : "#172554", color: busy ? "#94a3b8" : "#fff", borderColor: busy ? "#dbe2ea" : "#172554" }}>{busy ? "Adding…" : "Add user"}</button>
              </form>
              {message && <div style={{ marginBottom: 12, fontSize: 12, color: message.includes("added") ? "#15803d" : "#b45309" }}>{message}</div>}
              <div style={{ display: "grid", gap: 7 }}>
                {members.map(member => <div key={member.userId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 12px", border: "1px solid #e8edf3", borderRadius: 10, background: "#fafbfc" }}><div><div style={{ fontSize: 13, fontWeight: 750 }}>{member.name || member.email}</div>{member.name && <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{member.email}</div>}</div><span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: .6, color: member.role === "admin" ? "#3730a3" : "#475569", background: member.role === "admin" ? "#eef2ff" : "#f1f5f9", padding: "5px 8px", borderRadius: 999 }}><Shield size={11} /> {member.role}</span></div>)}
                {!members.length && <div style={{ padding: 18, textAlign: "center", border: "1px dashed #dbe2ea", borderRadius: 10, color: "#94a3b8", fontSize: 12 }}>No project users found.</div>}
              </div>
            </section>
          </div>

          <aside style={{ display: "grid", gap: 12 }}>
            <div style={cardStyle}><div style={{ fontSize: 10, letterSpacing: 1, fontWeight: 900, color: "#64748b" }}>SETTINGS</div><div style={{ marginTop: 12, display: "grid", gap: 4 }}><div style={{ padding: "10px 0", fontSize: 12, fontWeight: 800, color: "#172554", borderBottom: "1px solid #edf1f5" }}>Project details</div><div style={{ padding: "10px 0", fontSize: 12, fontWeight: 800, color: "#172554", borderBottom: "1px solid #edf1f5" }}>Users & access</div><div style={{ padding: "10px 0", fontSize: 12, color: "#94a3b8" }}>Site plan <span style={{ float: "right" }}>Editor</span></div><div style={{ padding: "10px 0", fontSize: 12, color: "#94a3b8" }}>Media <span style={{ float: "right" }}>Editor</span></div></div></div>
            <div style={{ ...cardStyle, background: "#172554", color: "#fff", borderColor: "#172554" }}><div style={{ fontSize: 10, letterSpacing: 1, fontWeight: 900, opacity: .65 }}>OWNER / ACCESS MODEL</div><h3 style={{ margin: "7px 0 6px", fontSize: 16 }}>Keep plot ownership in Map & Manage</h3><p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, opacity: .78 }}>Project users and permissions belong in Settings. The owner field on an individual plot stays in the editor because it describes that specific plot.</p></div>
            <Link href="/projects/capetown/editor" style={{ ...buttonStyle, width: "100%", boxSizing: "border-box" }}>Open Map & Manage <ChevronRight size={14} /></Link>
          </aside>
        </div>
      </div>
    </div>
  );
}
