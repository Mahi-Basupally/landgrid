import Link from "next/link";
import { Settings } from "lucide-react";
import LotEditor from "../../../../components/lot-editor";

export default function CapeTownEditorAliasPage() {
  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <LotEditor projectSlug="cape-town" />
      <Link
        href="/projects/capetown/settings"
        aria-label="Project settings"
        title="Project settings"
        style={{
          position: "fixed",
          top: 14,
          right: 18,
          zIndex: 100,
          width: 36,
          height: 36,
          display: "grid",
          placeItems: "center",
          border: "1px solid #dbe2ea",
          borderRadius: 9,
          background: "rgba(255,255,255,.97)",
          color: "#334155",
          boxShadow: "0 4px 14px rgba(15,23,42,.10)",
          textDecoration: "none",
        }}
      >
        <Settings size={17} />
      </Link>
    </div>
  );
}
