"use client";
import { usePathname } from "next/navigation";
import { useState } from "react";
import AppHeader from "./app-header";
import { HeaderContext, HeaderState } from "@/lib/header-context";

export default function AppShell({ children, isLoggedIn = false }: { children: React.ReactNode; isLoggedIn?: boolean }) {
  const pathname = usePathname();
  const [headerState, setHeaderState] = useState<HeaderState>({ projectName: "", message: "", isLoggedIn });

  const noShell = pathname === "/" || pathname === "/login" || pathname.startsWith("/embed/");
  if (noShell) return <>{children}</>;

  function setState(s: Partial<HeaderState>) {
    setHeaderState(prev => ({ ...prev, ...s }));
  }

  return (
    <HeaderContext.Provider value={{ state: headerState, setState }}>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <AppHeader projectName={headerState.projectName} message={headerState.message} isLoggedIn={headerState.isLoggedIn} />
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>{children}</div>
      </div>
    </HeaderContext.Provider>
  );
}
