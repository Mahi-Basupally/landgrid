"use client";

import { ChangeEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, EyeOff, FolderOpen, Grid2X2, Minus, MousePointer2, Move, Plus, Save, Upload } from "lucide-react";
import styles from "./lot-editor.module.css";

type Lot = { id: string; number: string; status: string; area: number | string | null; price: number | string | null; model: string; owner: string; direction: string; points: string; labelX: number; labelY: number; geometrySource?: string; sectionId?: string | null };
type Section = { id: string; name: string; sortOrder: number; masterPlanUrl?: string | null; droneUrl?: string | null };
type Point = { x: number; y: number };

function parsePoints(value: string): Point[] {
  return value.trim().split(/\s+/).map((p) => p.split(",").map(Number)).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])).map(([x, y]) => ({ x, y }));
}
function stringifyPoints(points: Point[]) { return points.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(" "); }
function bounds(lots: Lot[]) {
  const points = lots.flatMap((lot) => parsePoints(lot.points));
  if (!points.length) return { minX: 0, minY: 0, maxX: 1600, maxY: 1000 };
  return { minX: Math.min(...points.map((p) => p.x)), minY: Math.min(...points.map((p) => p.y)), maxX: Math.max(...points.map((p) => p.x)), maxY: Math.max(...points.map((p) => p.y)) };
}
function normalizeLots(value: unknown): Lot[] {
  if (!Array.isArray(value)) throw new Error("lots.json must contain an array");
  return value.map((r: any, i) => ({ id: String(r.id ?? `lot-${i + 1}`), number: String(r.number ?? i + 1), status: String(r.status ?? "available"), area: r.area ?? null, price: r.price ?? null, model: String(r.model ?? ""), owner: String(r.owner ?? ""), direction: String(r.direction ?? ""), points: String(r.points ?? ""), labelX: Number(r.labelX ?? 0), labelY: Number(r.labelY ?? 0), geometrySource: r.geometrySource ?? "manual", sectionId: r.sectionId ?? null }));
}

export default function LotEditor({ projectSlug }: { projectSlug: string }) {
  const [lots, setLots] = useState<Lot[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState("master_plan");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"map" | "drone">("map");
  const [assetUrl, setAssetUrl] = useState<string | null>(null);
  const [assetName, setAssetName] = useState("No plan uploaded");
  const [showImage, setShowImage] = useState(true);
  const [tool, setTool] = useState<"select" | "pan" | "draw">("select");
  const [zoom, setZoom] = useState(1);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<Point[]>([]);
  const [drag, setDrag] = useState<{ pointIndex?: number; mode: "point" | "lot"; start: Point; original: Point[] } | null>(null);
  const [ownerColors, setOwnerColors] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  const currentSection = sections.find((s) => s.id === selectedSectionId) || sections[0];
  const selected = lots.find((l) => l.id === selectedId) || null;
  const filteredLots = useMemo(() => currentSection ? lots.filter((l) => (l.sectionId || "master_plan") === currentSection.id) : [], [lots, currentSection]);
  const b = useMemo(() => bounds(filteredLots), [filteredLots]);
  const viewBox = `${b.minX - 100} ${b.minY - 100} ${Math.max(1, b.maxX - b.minX + 200)} ${Math.max(1, b.maxY - b.minY + 200)}`;

  async function load() {
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/plan`, { cache: "no-store", credentials: "same-origin" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load plan");
      const nextSections = data.sections || [];
      setSections(nextSections);
      setLots(data.lots || []);
      setSelectedSectionId((prev: string) => nextSections.some((s: Section) => s.id === prev) ? prev : nextSections[0]?.id || "master_plan");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load plan"); }
  }
  useEffect(() => { void load(); }, [projectSlug]);

  useEffect(() => {
    if (!currentSection) { setAssetUrl(null); setAssetName("No plan uploaded"); return; }
    const source = view === "map" ? currentSection.masterPlanUrl : currentSection.droneUrl;
    setAssetUrl(source ? `/api/projects/${encodeURIComponent(projectSlug)}/assets/file?kind=${view === "map" ? "master-plan" : "drone"}&planType=${encodeURIComponent(currentSection.id)}&v=${Date.now()}` : null);
    setAssetName(source ? `${currentSection.name} ${view}` : `No ${view} uploaded`);
    setSelectedId(null); setDraft([]); setZoom(1);
  }, [currentSection?.id, currentSection?.masterPlanUrl, currentSection?.droneUrl, view, projectSlug]);

  function updateLot(id: string, patch: Partial<Lot>) { setLots((items) => items.map((lot) => lot.id === id ? { ...lot, ...patch } : lot)); setDirty(true); }
  function selectLot(id: string) { setSelectedId(id); setTool("select"); setZoom(3); }

  async function save() {
    try {
      if (!sections.length) throw new Error("No plans loaded");
      const response = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/plan`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ sections, lots }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save");
      await load(); setDirty(false); setMessage("Saved"); setTimeout(() => setMessage(""), 1800);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save"); }
  }

  function addSection() {
    const used = sections.map((s) => Number(s.id.match(/^section_(\d+)$/)?.[1] || 0)).filter(Number.isFinite);
    const n = Math.max(0, ...used) + 1;
    const section: Section = { id: `section_${n}`, name: `Section ${n}`, sortOrder: n, masterPlanUrl: null, droneUrl: null };
    setSections((items) => [...items, section]); setSelectedSectionId(section.id); setView("map"); setDirty(true); setMessage(`${section.name} added — upload its map and drone image`);
  }

  async function uploadAsset(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !currentSection) return;
    if (!/image\/(svg\+xml|png|jpeg|jpg|webp)/i.test(file.type) && !/\.(svg|png|jpe?g|webp)$/i.test(file.name)) { setMessage("Use SVG, JPG, PNG or WebP"); return; }
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/assets`, { method: "POST", body: (() => { const form = new FormData(); form.append("file", file); form.append("planType", currentSection.id); form.append("kind", view === "map" ? "master-plan" : "drone"); return form; })(), credentials: "same-origin" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed");
      setSections((items) => items.map((s) => s.id === currentSection.id ? { ...s, ...(view === "map" ? { masterPlanUrl: data.savedValue } : { droneUrl: data.savedValue }) } : s));
      setAssetUrl(`/api/projects/${encodeURIComponent(projectSlug)}/assets/file?kind=${view === "map" ? "master-plan" : "drone"}&planType=${encodeURIComponent(currentSection.id)}&v=${Date.now()}`);
      setAssetName(file.name); setDirty(false); setMessage(`${view === "map" ? "Map" : "Drone image"} uploaded`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed"); }
    event.target.value = "";
  }

  function importLots(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { try { const imported = normalizeLots(JSON.parse(String(reader.result))).map((lot) => ({ ...lot, sectionId: lot.sectionId || selectedSectionId })); setLots((items) => [...items.filter((l) => (l.sectionId || "master_plan") !== selectedSectionId), ...imported]); setDirty(true); setMessage("lots.json imported"); } catch { setMessage("Invalid lots.json"); } };
    reader.readAsText(file); event.target.value = "";
  }
  function exportLots() { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(lots, null, 2)], { type: "application/json" })); a.download = "lots.json"; a.click(); }

  function svgPoint(event: PointerEvent<SVGSVGElement>) { const point = event.currentTarget.createSVGPoint(); point.x = event.clientX; point.y = event.clientY; const matrix = event.currentTarget.getScreenCTM(); if (!matrix) return { x: 0, y: 0 }; const p = point.matrixTransform(matrix.inverse()); return { x: p.x, y: p.y }; }
  function pointerDown(event: PointerEvent<SVGSVGElement>) {
    const point = svgPoint(event);
    if (tool === "draw") { setDraft((items) => [...items, point]); return; }
    if (!selected) return;
    const points = parsePoints(selected.points); const hit = points.findIndex((p) => Math.hypot(p.x - point.x, p.y - point.y) < 18 / zoom);
    if (hit >= 0) setDrag({ pointIndex: hit, mode: "point", start: point, original: points });
    else setDrag({ mode: "lot", start: point, original: points });
  }
  function pointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!drag || !selected) return;
    const point = svgPoint(event); const dx = point.x - drag.start.x; const dy = point.y - drag.start.y;
    let next = drag.original.map((p) => ({ ...p }));
    if (drag.mode === "point" && drag.pointIndex !== undefined) next[drag.pointIndex] = point; else next = next.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    updateLot(selected.id, { points: stringifyPoints(next), labelX: selected.labelX + (drag.mode === "lot" ? dx : 0), labelY: selected.labelY + (drag.mode === "lot" ? dy : 0), geometrySource: "manual" });
    setDrag({ ...drag, start: point, original: next });
  }
  function finishDraw() {
    if (draft.length < 3 || !currentSection) return;
    const nextNumber = String(Math.max(0, ...lots.map((l) => Number(l.number)).filter(Number.isFinite)) + 1);
    const center = draft.reduce((a, p) => ({ x: a.x + p.x / draft.length, y: a.y + p.y / draft.length }), { x: 0, y: 0 });
    const lot: Lot = { id: crypto.randomUUID(), number: nextNumber, status: "available", area: null, price: null, model: "", owner: "", direction: "", points: stringifyPoints(draft), labelX: center.x, labelY: center.y, geometrySource: "manual", sectionId: currentSection.id };
    setLots((items) => [...items, lot]); setSelectedId(lot.id); setDraft([]); setTool("select"); setDirty(true);
  }
  function ownerFill(lot: Lot) { if (!ownerColors || !lot.owner) return undefined; let hash = 0; for (const c of lot.owner) hash = (hash * 31 + c.charCodeAt(0)) % 360; return `hsl(${hash} 70% 55% / .45)`; }

  return <div className={styles.editor}>
    <header className={styles.header}><div><div className={styles.eyebrow}>LANDGRID / MAP AND MANAGE</div><h1>Lot Editor</h1><span>{currentSection?.name || "Master"} · {assetName}</span></div><div className={styles.actions}><button onClick={() => jsonRef.current?.click()}><FolderOpen size={16} /> Import lots</button><button onClick={exportLots}><Download size={16} /> Export lots</button><button className={styles.primary} onClick={save}><Save size={16} /> Save{dirty ? " *" : ""}</button></div></header>
    <div className={styles.toolbar}>
      <label>Plan <select value={selectedSectionId} onChange={(e) => { setSelectedSectionId(e.target.value); setSelectedId(null); }}>{sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <button onClick={addSection}><Plus size={16} /> Add section</button><span className={styles.separator} />
      <button className={tool === "select" ? styles.active : ""} onClick={() => setTool("select")}><MousePointer2 size={17} /></button><button className={tool === "pan" ? styles.active : ""} onClick={() => setTool("pan")}><Move size={17} /></button><button className={tool === "draw" ? styles.active : ""} onClick={() => setTool("draw")}><Grid2X2 size={17} /></button>
      {tool === "draw" && <button onClick={finishDraw}>Finish lot</button>}<span className={styles.separator} /><button onClick={() => setZoom((z) => Math.min(8, z + .25))}><Plus size={17} /></button><strong>{Math.round(zoom * 100)}%</strong><button onClick={() => setZoom((z) => Math.max(.25, z - .25))}><Minus size={17} /></button><button onClick={() => setZoom(1)}>Fit</button><span className={styles.separator} />
      <button className={view === "map" ? styles.active : ""} onClick={() => setView("map")}>Map</button><button className={view === "drone" ? styles.active : ""} onClick={() => setView("drone")}>Drone</button><button onClick={() => fileRef.current?.click()}><Upload size={16} /> Upload {view}</button><button onClick={() => setShowImage((v) => !v)}>{showImage ? <EyeOff size={16} /> : <Eye size={16} />} {showImage ? "Hide image" : "Show image"}</button><button className={ownerColors ? styles.active : ""} onClick={() => setOwnerColors((v) => !v)}>Owner colors</button><span className={styles.spacer} /><span className={styles.hint}>{message || "Select a lot to edit"}</span>
    </div>
    <input ref={fileRef} hidden type="file" accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp" onChange={uploadAsset} /><input ref={jsonRef} hidden type="file" accept="application/json,.json" onChange={importLots} />
    <main className={styles.body}><aside className={styles.sidebar}><div className={styles.sideTop}><div><b>Lots</b><small>{filteredLots.length} in {currentSection?.name || "Master"}</small></div></div><div className={styles.lotList}>{filteredLots.map((lot) => <button key={lot.id} className={`${styles.lotCard} ${selectedId === lot.id ? styles.selected : ""}`} onClick={() => selectLot(lot.id)}><span className={styles.lotNumber}>{lot.number}</span><span><b>Lot {lot.number}</b><small>{lot.status}{lot.owner ? ` · ${lot.owner}` : ""}</small></span></button>)}</div></aside>
      <section className={styles.stage}><div className={styles.canvasWrap}><div className={styles.canvas}>{assetUrl && showImage ? <img src={assetUrl} alt={`${currentSection?.name || "Master"} ${view}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "fill", pointerEvents: "none" }} /> : <div className={styles.empty}>Upload a {view === "map" ? "site plan" : "drone image"} for this plan.</div>}
        <svg viewBox={viewBox} preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={() => setDrag(null)}>{filteredLots.map((lot) => <g key={lot.id} onClick={() => selectLot(lot.id)}><polygon points={lot.points} fill={ownerFill(lot) || (selectedId === lot.id ? "rgba(37,99,235,.35)" : "rgba(37,99,235,.08)")} stroke={selectedId === lot.id ? "#2457d6" : "#fff"} strokeWidth={selectedId === lot.id ? 4 : 2} /><text x={lot.labelX} y={lot.labelY} textAnchor="middle" dominantBaseline="middle" fontSize="24" fontWeight="800" fill="#172033" paintOrder="stroke" stroke="#fff" strokeWidth="5">{lot.number}</text></g>)}{draft.length > 1 && <polyline points={draft.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#2457d6" strokeWidth="4" /></svg>
      </div></div></section></main>
  </div>;
}
