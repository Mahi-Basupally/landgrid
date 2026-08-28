"use client";
import { usePathname } from "next/navigation";
import { useState } from "react";
import AppHeader from "./app-header";
import { HeaderContext, HeaderState } from "@/lib/header-context";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [headerState, setHeaderState] = useState<HeaderState>({ projectName: "", message: "", isLoggedIn: true });
  const noShell = pathname === "/" || pathname === "/login" || pathname.startsWith("/embed/");
  if (noShell) return <>{children}</>;
  function setState(s: Partial<HeaderState>) { setHeaderState(prev => ({ ...prev, ...s })); }
  return <HeaderContext.Provider value={{ state: headerState, setState }}><div style={{ height: "100svh", display: "flex", flexDirection: "column" }}><AppHeader projectName={headerState.projectName} message={headerState.message} isLoggedIn={true} /><div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>{children}</div></div></HeaderContext.Provider>;
}
