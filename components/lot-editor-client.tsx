"use client";

import dynamic from "next/dynamic";

const LotEditor = dynamic(() => import("./lot-editor"), {
  ssr: false,
  loading: () => <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>Loading editor…</div>,
});

export default LotEditor;
