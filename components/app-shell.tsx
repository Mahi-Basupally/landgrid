"use client";

import { usePathname } from "next/navigation";
import AppHeader from "./app-header";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const publicShell = pathname === "/" || pathname === "/login" || pathname.startsWith("/embed/");
  const editor = pathname.includes("/editor");

  if (publicShell || editor) return <>{children}</>;

  return <div className="app-shell"><AppHeader />{children}</div>;
}
