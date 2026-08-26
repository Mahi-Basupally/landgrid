"use client";

import Link from "next/link";
import { ArrowLeft, LogOut, MessageSquare, Save, Settings } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Props = { projectName?: string; pageHeading?: string; showSave?: boolean; message?: string; onSave?: () => void; };

export default function AppHeader({ projectName, pageHeading, showSave = false, message = "", onSave }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [name, setName] = useState(projectName || "");
  const slug = useMemo(() => {
    const m = pathname.match(/^\/projects\/([^/]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  }, [pathname]);

  useEffect(() => {
    if (projectName || !slug || slug === "manage") return;
    fetch(`/api/projects/${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(d => d?.project?.name && setName(d.project.name))
      .catch(() => {});
  }, [projectName, slug]);

  const isProjects = pathname === "/projects" || pathname === "/projects/manage";
  const isSettings = pathname.includes("/settings");
  const isEditor = pathname.includes("/editor");
  const heading = pageHeading || (isSettings ? "Settings" : isEditor ? "Map & Manage" : isProjects ? "Projects" : "Project");
  const backHref = isProjects ? "/" : "/projects";
  const backLabel = isProjects ? "Back to home" : "Back to projects";

  function save() {
    if (onSave) return onSave();
    const button = Array.from(document.querySelectorAll("button")).find(b => /\bSave\b/i.test(b.textContent || "")) as HTMLButtonElement | undefined;
    button?.click();
  }
  async function logout() {
    try { await fetch("/api/auth/logout", { method: "POST" }); } finally { window.location.href = "/"; }
  }

  return <header className="app-header">
    <div className="app-header-left">
      <Link href="/" className="app-brand" aria-label="LandGrid home"><span className="app-brand-mark">LG</span><strong>LANDGRID</strong></Link>
      <span className="app-divider" />
      <nav className="app-nav" aria-label="Primary">
        {isProjects ? <span className="app-nav-active">PROJECTS</span> : <Link href={slug ? `/projects/${encodeURIComponent(slug)}/manage` : "/projects"} className={isEditor ? "app-nav-active" : ""}>MAP &amp; MANAGE</Link>}
        {slug && <Link href={`/projects/${encodeURIComponent(slug)}/settings`} className={isSettings ? "app-nav-active" : ""}>SETTINGS</Link>}
      </nav>
    </div>

    <div className="app-header-center" aria-live="polite">
      {name && <span className="app-project-name">{name}</span>}
      {name && <span className="app-heading-separator">-</span>}
      <span className="app-page-heading">{heading}</span>
    </div>

    <div className="app-header-actions">
      <Link href={backHref} className="app-header-button app-back"><ArrowLeft size={15} /> {backLabel}</Link>
      {isSettings && <span className="app-status">All changes saved</span>}
      {showSave || isEditor ? <button type="button" className="app-header-button app-save" onClick={save}><Save size={15} /> Save</button> : null}
      {isEditor && <span className="app-message" title={message || "Status"}><MessageSquare size={14} /> {message || "All changes saved"}</span>}
      {slug && <Link href={`/projects/${encodeURIComponent(slug)}/settings`} className="app-icon-button" aria-label="Settings"><Settings size={16} /></Link>}
      <button type="button" className="app-icon-button" onClick={() => void logout()} aria-label="Log out"><LogOut size={16} /></button>
    </div>
  </header>;
}
