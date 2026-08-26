"use client";

import Link from "next/link";
import { ArrowLeft, LogOut, MessageSquare, Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

type Props = { projectName?: string; message?: string; };

function prettySlug(slug: string) {
  return slug.split("-").filter(Boolean).map(v => v.charAt(0).toUpperCase() + v.slice(1)).join(" ");
}

export default function AppHeader({ projectName, message = "" }: Props) {
  const pathname = usePathname();
  const slug = useMemo(() => {
    const m = pathname.match(/^\/projects\/([^/]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  }, [pathname]);

  const isProjects = pathname === "/projects" || pathname === "/projects/manage";
  const isSettings = pathname.includes("/settings");
  const isEditor = pathname.includes("/editor");
  const isView = !isEditor && !isSettings && !isProjects && Boolean(slug);
  const displayName = projectName || (slug ? prettySlug(slug) : "");

  async function logout() {
    try { await fetch("/api/auth/logout", { method: "POST" }); } finally { window.location.href = "/"; }
  }

  return (
    <header className="app-header">
      {/* Left: brand + context */}
      <div className="app-header-left">
        <Link href="/" className="app-brand" aria-label="LandGrid home">
          <span className="app-brand-mark">LG</span>
          <strong>LANDGRID</strong>
        </Link>
        {(isEditor || isSettings || isView) && displayName && (
          <>
            <span className="app-divider" />
            <span className="app-project-name">{displayName}</span>
            <span className="app-heading-separator">-</span>
            <span className="app-page-heading">{isEditor ? "Map & Manage" : isSettings ? "Settings" : "View"}</span>
            {isEditor && message && (
              <span className="app-message" title={message}>
                <MessageSquare size={14} /> {message}
              </span>
            )}
          </>
        )}
        {isProjects && (
          <>
            <span className="app-divider" />
            <span className="app-page-heading" style={{ color: "#172554", fontWeight: 900 }}>PROJECTS</span>
          </>
        )}
      </div>

      {/* Right: actions */}
      <div className="app-header-actions">
        {isEditor && (
          <Link href="/projects" className="app-header-button app-back">
            <ArrowLeft size={15} /> Back to Projects
          </Link>
        )}
        {isSettings && slug && (
          <Link href={`/projects/${encodeURIComponent(slug)}/editor`} className="app-header-button app-back">
            <ArrowLeft size={15} /> Back to Editor
          </Link>
        )}
        {isView && (
          <Link href="/projects" className="app-header-button app-back">
            <ArrowLeft size={15} /> Back to Projects
          </Link>
        )}
        {(isEditor || isSettings || isView) && slug && (
          <Link href={`/projects/${encodeURIComponent(slug)}/settings`} className="app-icon-button" aria-label="Settings">
            <Settings size={16} />
          </Link>
        )}
        <button type="button" className="app-icon-button" onClick={() => void logout()} aria-label="Log out">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
