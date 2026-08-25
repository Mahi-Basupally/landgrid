"use client";

import { ChangeEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, EyeOff, FileImage, FolderOpen, Grid2X2, Minus, MousePointer2, Move, Plus, RotateCcw, Save, Trash2, Upload } from "lucide-react";
import styles from "./lot-editor.module.css";

type LotStatus = "available" | "reserved" | "sold" | "hold";

type Lot = {
  id: string;
  number: string;
  status: LotStatus | string;
  area: number | string | null;
  price: number | string | null;
  model: string;
  owner: string;
  direction: string;
  points: string;
  labelX: number;
  labelY: number;
  geometrySource?: string;
  sectionId?: string;
};

type Point = { x: number; y: number };

const DEMO_LOTS: Lot[] = [
  { id: "lot-1", number: "1", status: "available", area: null, price: null, model: "", owner: "", direction: "", points: "1196,687 1271,688 1271,744 1196,743", labelX: 1233, labelY: 716, geometrySource: "white-line-auto", sectionId: "section-1" },
  { id: "lot-2", number: "2", status: "available", area: null, price: null, model: "", owner: "", direction: "", points: "1196,743 1271,744 1271,800 1196,799", labelX: 1234, labelY: 772, geometrySource: "white-line-auto", sectionId: "section-1" },
  { id: "lot-3", number: "3", status: "available", area: null, price: null, model: "", owner: "", direction: "", points: "1196,799 1271,800 1271,856 1196,855", labelX: 1234, labelY: 828, geometrySource: "white-line-auto", sectionId: "section-1" },
];

const statusClass: Record<string, string> = {
  available: styles.available,
  reserved: styles.reserved,
  sold: styles.sold,
  hold: styles.hold,
};

function parsePoints(points: string): Point[] {
  return points.trim().split(/\s+/).map((p) => p.split(",").map(Number)).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])).map(([x, y]) => ({ x, y }));
}

function stringifyPoints(points: Point[]) {
  return points.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(" ");
}

function normalizeLots(value: unknown): Lot[] {
  const source = Array.isArray(value) && Array.isArray(value[0]) ? value[0] : value;
  if (!Array.isArray(source)) throw new Error("lots.json must contain an array of lots");
  return source.map((raw: any, index) => ({
    id: String(raw.id ?? `lot-${index + 1}`), number: String(raw.number ?? index + 1), status: String(raw.status ?? "available"),
    area: raw.area ?? null, price: raw.price ?? null, model: String(raw.model ?? ""), owner: String(raw.owner ?? ""), direction: String(raw.direction ?? ""),
    points: String(raw.points ?? ""), labelX: Number(raw.labelX ?? 0), labelY: Number(raw.labelY ?? 0), geometrySource: raw.geometrySource ?? "manual", sectionId: raw.sectionId ?? "section-1",
  }));
}

function bounds(lots: Lot[]) {
  const pts = lots.flatMap((l) => parsePoints(l.points));
  if (!pts.length) return { minX: 0, minY: 0, maxX: 1600, maxY: 1000 };
  return { minX: Math.min(...pts.map(p => p.x)), minY: Math.min(...pts.map(p => p.y)), maxX: Math.max(...pts.map(p => p.x)), maxY: Math.max(...pts.map(p => p.y)) };
}

export default function LotEditor({ projectSlug }: { projectSlug: string }) {
  const [lots, setLots] = useState<Lot[]>(DEMO_LOTS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assetUrl, setAssetUrl] = useState<string | null>(null);
  const [assetName, setAssetName] = useState("No site plan uploaded");
  const [showImage, setShowImage] = useState(true);
  const [tool, setTool] = useState<"select" | "pan" | "draw">("select");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [editPoints, setEditPoints] = useState(true);
  const [sectionFilter, setSectionFilter] = useState("all");
  const [ownerColors, setOwnerColors] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [drag, setDrag] = useState<{ lotId: string; pointIndex?: number; mode: "point" | "lot" | "label"; start: Point; original: Point[] } | null>(null);
  const [draft, setDraft] = useState<Point[]>([]);
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const selected = lots.find(l => l.id === selectedId) ?? null;
  const filteredLots = useMemo(() => sectionFilter === "all" ? lots : lots.filter(l => l.sectionId === sectionFilter), [lots, sectionFilter]);
  const sections = useMemo(() => Array.from(new Set(lots.map(l => l.sectionId).filter(Boolean))) as string[], [lots]);
  const mapBounds = useMemo(() => bounds(lots), [lots]);
  const viewBox = useMemo(() => {
    const pad = 100;
    return `${mapBounds.minX - pad} ${mapBounds.minY - pad} ${Math.max(1, mapBounds.maxX - mapBounds.minX + pad * 2)} ${Math.max(1, mapBounds.maxY - mapBounds.minY + pad * 2)}`;
  }, [mapBounds]);

  useEffect(() => {
    const saved = window.localStorage.getItem(`landgrid:${projectSlug}:lots`);
    if (saved) try { setLots(normalizeLots(JSON.parse(saved))); } catch {}
    const savedImage = window.localStorage.getItem(`landgrid:${projectSlug}:image`);
    if (savedImage) { setAssetUrl(savedImage); setAssetName("Saved site plan"); }
  }, [projectSlug]);

  function save() {
    window.localStorage.setItem(`landgrid:${projectSlug}:lots`, JSON.stringify(lots, null, 2));
    setDirty(false); setMessage("Saved locally"); setTimeout(() => setMessage(""), 1800);
  }

  function exportLots() {
    const blob = new Blob([JSON.stringify(lots, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "lots.json"; a.click(); URL.revokeObjectURL(url);
  }

  function importLots(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = () => { try { setLots(normalizeLots(JSON.parse(String(reader.result)))); setSelectedId(null); setDirty(true); setMessage("lots.json imported"); } catch { setMessage("Invalid lots.json"); } }; reader.readAsText(file); e.target.value = "";
  }

  function importImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    if (!/image\/(svg\+xml|png|jpeg|jpg)/i.test(file.type) && !/\.(svg|png|jpe?g)$/i.test(file.name)) { setMessage("Use SVG, JPG or PNG"); return; }
    const url = URL.createObjectURL(file); setAssetUrl(url); setAssetName(file.name); setShowImage(true); setPan({ x: 0, y: 0 }); setZoom(1);
    // Blob URLs are intentionally kept in-memory for the editor session. A server/Supabase Storage upload can replace this later.
    setMessage("Site plan loaded");
  }

  function svgPoint(e: PointerEvent<SVGSVGElement>): Point {
    const svg = e.currentTarget; const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const matrix = svg.getScreenCTM(); if (!matrix) return { x: 0, y: 0 }; const p = pt.matrixTransform(matrix.inverse()); return { x: p.x, y: p.y };
  }

  function selectLot(id: string) {
    setSelectedId(id); setTool("select");
    // Selecting from the left grid/list intentionally resets to the product's 300% focus behavior.
    setZoom(3); setPan({ x: 0, y: 0 });
  }

  function updateLot(id: string, patch: Partial<Lot>) { setLots(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l)); setDirty(true); }

  function onPointerDown(e: PointerEvent<SVGSVGElement>) {
    const p = svgPoint(e);
    if (tool === "draw") { setDraft(prev => [...prev, p]); return; }
    if (!selected || !editPoints) return;
    const points = parsePoints(selected.points);
    const hit = points.findIndex(q => Math.hypot(q.x - p.x, q.y - p.y) < 18 / zoom);
    if (hit >= 0) { setDrag({ lotId: selected.id, pointIndex: hit, mode: "point", start: p, original: points }); return; }
    if (p.x >= Math.min(...points.map(q => q.x)) && p.x <= Math.max(...points.map(q => q.x)) && p.y >= Math.min(...points.map(q => q.y)) && p.y <= Math.max(...points.map(q => q.y))) {
      setDrag({ lotId: selected.id, mode: "lot", start: p, original: points });
    }
  }

  function onPointerMove(e: PointerEvent<SVGSVGElement>) {
    if (!drag || !selected) return; const p = svgPoint(e); const dx = p.x - drag.start.x; const dy = p.y - drag.start.y; let next = drag.original.map(q => ({ ...q }));
    if (drag.mode === "point" && drag.pointIndex !== undefined) next[drag.pointIndex] = { x: p.x, y: p.y };
    if (drag.mode === "lot") next = next.map(q => ({ x: q.x + dx, y: q.y + dy }));
    updateLot(selected.id, { points: stringifyPoints(next), labelX: selected.labelX + (drag.mode === "lot" ? dx : 0), labelY: selected.labelY + (drag.mode === "lot" ? dy : 0), geometrySource: "manual" });
    setDrag({ ...drag, start: p, original: next });
  }

  function finishDrag() { setDrag(null); }

  function addLotFromDraft() {
    if (draft.length < 3) return;
    const nextNumber = String(Math.max(0, ...lots.map(l => Number(l.number)).filter(Number.isFinite)) + 1);
    const center = draft.reduce((a, p) => ({ x: a.x + p.x / draft.length, y: a.y + p.y / draft.length }), { x: 0, y: 0 });
    const lot: Lot = { id: `lot-${Date.now()}`, number: nextNumber, status: "available", area: null, price: null, model: "", owner: "", direction: "", points: stringifyPoints(draft), labelX: center.x, labelY: center.y, geometrySource: "manual", sectionId: sections[0] ?? "section-1" };
    setLots(prev => [...prev, lot]); setSelectedId(lot.id); setDraft([]); setTool("select"); setDirty(true);
  }

  function deleteSelected() { if (!selected) return; setLots(prev => prev.filter(l => l.id !== selected.id)); setSelectedId(null); setDirty(true); }

  function resetView() { setZoom(1); setPan({ x: 0, y: 0 }); }

  function fitSelection() { if (!selected) return; setZoom(3); setPan({ x: 0, y: 0 }); }

  function ownerFill(lot: Lot) {
    if (!ownerColors || !lot.owner) return undefined;
    let h = 0; for (const c of lot.owner) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h} 70% 55% / .45)`;
  }

  return <div className={styles.editor}>
    <header className={styles.header}>
      <div><div className={styles.eyebrow}>LANDGRID / MAP AND MANAGE</div><h1>Lot Editor</h1><span>{assetName}</span></div>
      <div className={styles.actions}>
        <button onClick={() => jsonRef.current?.click()}><FolderOpen size={16}/> Import lots</button>
        <button onClick={exportLots}><Download size={16}/> Export lots</button>
        <button className={styles.primary} onClick={save}><Save size={16}/> Save {dirty ? "*" : ""}</button>
      </div>
    </header>

    <div className={styles.toolbar}>
      <button className={tool === "select" ? styles.active : ""} onClick={() => setTool("select")} title="Select / edit"><MousePointer2 size={17}/></button>
      <button className={tool === "pan" ? styles.active : ""} onClick={() => setTool("pan")} title="Pan"><Move size={17}/></button>
      <button className={tool === "draw" ? styles.active : ""} onClick={() => setTool("draw")} title="Draw new lot"><Grid2X2 size={17}/></button>
      <span className={styles.separator}/>
      <button onClick={() => setZoom(z => Math.min(8, z + .25))}><Plus size={17}/></button><strong>{Math.round(zoom * 100)}%</strong><button onClick={() => setZoom(z => Math.max(.25, z - .25))}><Minus size={17}/></button>
      <button onClick={resetView}>Fit</button>
      <button onClick={fitSelection} disabled={!selected}>Focus lot</button>
      <span className={styles.separator}/>
      <button onClick={() => fileRef.current?.click()}><Upload size={16}/> Site plan</button>
      <button onClick={() => setShowImage(v => !v)}>{showImage ? <EyeOff size={16}/> : <Eye size={16}/>} {showImage ? "Hide image" : "Show image"}</button>
      <button className={ownerColors ? styles.active : ""} onClick={() => setOwnerColors(v => !v)}>Owner colors</button>
      <span className={styles.spacer}/><span className={styles.hint}>{message || (tool === "draw" ? "Click 3+ points, then Finish lot" : "Click a lot to edit")}</span>
    </div>

    <main className={styles.body}>
      <aside className={styles.sidebar}>
        <div className={styles.sideTop}><div><b>Lots</b><small>{filteredLots.length} of {lots.length}</small></div><select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)}><option value="all">All sections</option>{sections.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
        <div className={styles.lotList}>{filteredLots.map(lot => <button key={lot.id} className={`${styles.lotCard} ${selectedId === lot.id ? styles.selected : ""}`} onClick={() => selectLot(lot.id)}><span className={styles.lotNumber}>{lot.number}</span><span><b>{lot.owner || "Available"}</b><small className={statusClass[lot.status] || ""}>{lot.status}</small></span><span className={styles.cardArrow}>›</span></button>)}</div>
        <div className={styles.sideBottom}><button onClick={() => setEditPoints(v => !v)}>{editPoints ? "Lock geometry" : "Edit geometry"}</button><button onClick={deleteSelected} disabled={!selected}><Trash2 size={15}/> Delete lot</button></div>
      </aside>

      <section className={styles.stage} ref={canvasRef}>
        <div className={styles.canvasWrap}>
          <svg className={styles.canvas} viewBox={viewBox} preserveAspectRatio="xMidYMid meet" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={finishDrag} onPointerLeave={finishDrag} style={{ cursor: tool === "draw" ? "crosshair" : tool === "pan" ? "grab" : "default" }}>
            {showImage && assetUrl && <image href={assetUrl} x={mapBounds.minX - 100} y={mapBounds.minY - 100} width={mapBounds.maxX - mapBounds.minX + 200} height={mapBounds.maxY - mapBounds.minY + 200} preserveAspectRatio="none" opacity="1" />}
            {!showImage && <rect x={mapBounds.minX - 100} y={mapBounds.minY - 100} width={mapBounds.maxX - mapBounds.minX + 200} height={mapBounds.maxY - mapBounds.minY + 200} fill="#f5f6f8" />}
            <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
              {filteredLots.map(lot => { const points = parsePoints(lot.points); const isSelected = selectedId === lot.id; return <g key={lot.id}>
                <polygon points={lot.points} className={`${styles.lotPolygon} ${isSelected ? styles.polygonSelected : ""}`} fill={ownerFill(lot)} onClick={(e) => { e.stopPropagation(); setSelectedId(lot.id); }} />
                {isSelected && editPoints && points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={7 / zoom} className={styles.vertex} />)}
                {lot.number && <text x={lot.labelX} y={lot.labelY} className={styles.lotLabel} pointerEvents="none">{lot.number}</text>}
              </g>; })}
              {draft.length > 0 && <polyline points={stringifyPoints(draft)} className={styles.draftLine} />}
            </g>
          </svg>
          {tool === "draw" && draft.length >= 3 && <button className={styles.finish} onClick={addLotFromDraft}>Finish lot ({draft.length} points)</button>}
          {!assetUrl && <div className={styles.empty}><FileImage size={42}/><h2>Upload your site plan</h2><p>SVG, JPG or PNG are supported. Your existing lots.json can be layered over a flat image.</p><button className={styles.primary} onClick={() => fileRef.current?.click()}>Choose site plan</button></div>}
        </div>
      </section>

      <aside className={styles.inspector}>
        {selected ? <>
          <div className={styles.inspectorHead}><div><small>LOT</small><h2>{selected.number}</h2></div><button onClick={() => setSelectedId(null)}>×</button></div>
          <label>Lot number<input value={selected.number} onChange={e => updateLot(selected.id, { number: e.target.value })}/></label>
          <label>Status<select value={selected.status} onChange={e => updateLot(selected.id, { status: e.target.value })}><option value="available">Available</option><option value="reserved">Reserved</option><option value="sold">Sold</option><option value="hold">Hold</option></select></label>
          <label>Owner<input value={selected.owner} onChange={e => updateLot(selected.id, { owner: e.target.value })}/></label>
          <label>Model<input value={selected.model} onChange={e => updateLot(selected.id, { model: e.target.value })}/></label>
          <div className={styles.two}><label>Area<input value={selected.area ?? ""} onChange={e => updateLot(selected.id, { area: e.target.value })}/></label><label>Price<input value={selected.price ?? ""} onChange={e => updateLot(selected.id, { price: e.target.value })}/></label></div>
          <label>Direction<input value={selected.direction} onChange={e => updateLot(selected.id, { direction: e.target.value })}/></label>
          <label>Section<select value={selected.sectionId ?? ""} onChange={e => updateLot(selected.id, { sectionId: e.target.value })}>{sections.map(s => <option key={s}>{s}</option>)}</select></label>
          <div className={styles.geometry}><b>Geometry</b><small>{parsePoints(selected.points).length} vertices · {selected.geometrySource ?? "manual"}</small><textarea value={selected.points} onChange={e => updateLot(selected.id, { points: e.target.value, geometrySource: "manual" })}/><button onClick={() => updateLot(selected.id, { labelX: Math.round(parsePoints(selected.points).reduce((a,p)=>a+p.x,0)/Math.max(1,parsePoints(selected.points).length)), labelY: Math.round(parsePoints(selected.points).reduce((a,p)=>a+p.y,0)/Math.max(1,parsePoints(selected.points).length)) })}>Center label</button></div>
          <button className={styles.deleteButton} onClick={deleteSelected}><Trash2 size={15}/> Delete lot</button>
        </> : <div className={styles.noSelection}><MousePointer2 size={28}/><h3>Select a lot</h3><p>Click a lot on the map or choose one from the list. You can drag the whole lot or individual vertices.</p></div>}
      </aside>
    </main>

    <input ref={fileRef} type="file" accept="image/svg+xml,image/png,image/jpeg,.svg,.png,.jpg,.jpeg" hidden onChange={importImage}/>
    <input ref={jsonRef} type="file" accept="application/json,.json" hidden onChange={importLots}/>
  </div>;
}
