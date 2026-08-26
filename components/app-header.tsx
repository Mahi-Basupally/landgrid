"use client";

import Link from "next/link";
import { ArrowLeft, LogOut, MessageSquare, Save, Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

type Props = { projectName?: string; pageHeading?: string; showSave?: boolean; message?: string; onSave?: () => void; };
function prettySlug(slug: string) { return slug.split("-").filter(Boolean).map(v => v.charAt(0).toUpperCase() + v.slice(1)).join(" "); }
export default function AppHeader({ projectName, pageHeading, showSave = false, message = "", onSave }: Props) {
  const pathname = usePathname(); const [name] = useState(projectName || "");
  const slug = useMemo(() => { const m = pathname.match(/^\/projects\/([^/]+)/); return m ? decodeURIComponent(m[1]) : ""; }, [pathname]);
  const isProjects = pathname === "/projects" || pathname === "/projects/manage"; const isSettings = pathname.includes("/settings"); const isEditor = pathname.includes("/editor");
  const displayName = name || (!isProjects && slug ? prettySlug(slug) : ""); const heading = pageHeading || (isSettings ? "Settings" : isEditor ? "Map & Manage" : isProjects ? "Projects" : "Project");
  const backHref = isProjects ? "/" : "/projects"; const backLabel = isProjects ? "Back to home" : "Back to projects";
  function save() { if (onSave) return onSave(); const button = Array.from(document.querySelectorAll("button")).find(b => /\bSave\b/i.test(b.textContent || "")) as HTMLButtonElement | undefined; button?.click(); }
  async function logout() { try { await fetch("/api/auth/logout", { method: "POST" }); } finally { window.location.href = "/"; } }
  return <header className="app-header"><div className="app-header-left"><Link href="/" className="app-brand" aria-label="LandGrid home"><span className="app-brand-mark">LG</span><strong>LANDGRID</strong></Link><span className="app-divider" /><nav className="app-nav" aria-label="Primary">{isProjects ? <span className="app-nav-active">PROJECTS</span> : null}{slug && <Link href={`/projects/${encodeURIComponent(slug)}/settings`} className={isSettings ? "app-nav-active" : ""}>SETTINGS</Link>}</nav></div><div className="app-header-center" aria-live="polite" style={isEditor ? { justifyContent: "flex-end", paddingRight: 8 } : {}}>{displayName && <span className="app-project-name">{displayName}</span>}{displayName && !isEditor && <span className="app-heading-separator">-</span>}{!isEditor && <span className="app-page-heading">{heading}</span>}</div><div className="app-header-actions">{!isEditor && <Link href={backHref} className="app-header-button app-back"><ArrowLeft size={15} /> {backLabel}</Link>}{showSave || isEditor ? <button type="button" className="app-header-button app-save" onClick={save}><Save size={15} /> Save</button> : null}{isEditor && message ? <span className="app-message" title={message}><MessageSquare size={14} /> {message}</span> : null}{slug && <Link href={`/projects/${encodeURIComponent(slug)}/settings`} className="app-icon-button" aria-label="Settings"><Settings size={16} /></Link>}<button type="button" className="app-icon-button" onClick={() => void logout()} aria-label="Log out"><LogOut size={16} /></button></div></header>;
}
