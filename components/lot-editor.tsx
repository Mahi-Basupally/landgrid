"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Save, Trash2, Upload, X } from "lucide-react";

type Point = { x: number; y: number };
type Layer = { visible: boolean; opacity: number; x: number; y: number; width: number; height: number };
type Layers = { map: Layer; drone: Layer };
type Plan = { id: string; name: string; sortOrder?: number; masterPlanUrl?: string | null; droneUrl?: string | null; points?: string | null; layerGeometry?: any };
type Plot = { id: string; number: string; status: string; owner: string; price: number | string | null; area: number | string | null; direction: string; model: string; points: string; labelX: number; labelY: number; sectionId?: string | null };
type Drag = { kind: "pan" | "plot-move" | "plot-point" | "section-move" | "section-point"; id: string; start: Point; points?: Point[]; index?: number; panStart?: Point };

const W = 1600;
const H = 1000;
const parse = (s: string): Point[] => s.trim().split(/\s+/).filter(Boolean).map(v => v.split(",").map(Number)).filter(v => Number.isFinite(v[0]) && Number.isFinite(v[1])).map(([x, y]) => ({ x, y }));
const stringify = (p: Point[]) => p.map(v => `${Math.round(v.x)},${Math.round(v.y)}`).join(" ");
const center = (p: Point[]) => p.length ? { x: p.reduce((a, v) => a + v.x, 0) / p.length, y: p.reduce((a, v) => a + v.y, 0) / p.length } : { x: W / 2, y: H / 2 };
const bounds = (p: Point[]) => ({ minX: Math.min(...p.map(v => v.x)), minY: Math.min(...p.map(v => v.y)), maxX: Math.max(...p.map(v => v.x)), maxY: Math.max(...p.map(v => v.y)) });
const octagon = (x: number, y: number, w: number, h: number): Point[] => [{ x, y }, { x: x + w / 2, y }, { x: x + w, y }, { x: x + w, y: y + h / 2 }, { x: x + w, y: y + h }, { x: x + w / 2, y: y + h }, { x, y: y + h }, { x, y: y + h / 2 }];
const normalize8 = (p: Point[]) => {
  if (p.length === 8) return p;
  if (p.length === 4) return [p[0], { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 }, p[1], { x: (p[1].x + p[2].x) / 2, y: (p[1].y + p[2].y) / 2 }, p[2], { x: (p[2].x + p[3].x) / 2, y: (p[2].y + p[3].y) / 2 }, p[3], { x: (p[3].x + p[0].x) / 2, y: (p[3].y + p[0].y) / 2 }];
  return p.length >= 3 ? p : octagon(600, 400, 200, 120);
};
const defaultLayer = (opacity: number): Layer => ({ visible: true, opacity, x: 0, y: 0, width: W, height: H });
const defaultLayers = (): Layers => ({ map: defaultLayer(.72), drone: defaultLayer(.42) });

export default function LotEditor({ projectSlug }: { projectSlug: string }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [sections, setSections] = useState<Record<string, string>>({});
  const [planId, setPlanId] = useState("master_plan");
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [layers, setLayers] = useState<Layers>(defaultLayers());
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [drag, setDrag] = useState<Drag | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState<{ kind: "plot" | "section"; id: string; label: string } | null>(null);
  const [uploading, setUploading] = useState<"map" | "drone" | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const mapInput = useRef<HTMLInputElement | null>(null);
  const droneInput = useRef<HTMLInputElement | null>(null);
  const loaded = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const master = plans.find(p => p.id === "master_plan") || plans[0];
  const section = plans.find(p => p.id === selectedSection) || null;
  const selectedPlot = plots.find(p => p.id === selected) || null;
  const sectionList = useMemo(() => plans.filter(p => p.id !== "master_plan"), [plans]);
  const visiblePlots = useMemo(() => planId === "master_plan" ? plots : plots.filter(p => p.sectionId === planId), [plots, planId]);
  const viewW = W / zoom;
  const viewH = H / zoom;
  const viewBox = `${(W - viewW) / 2 + pan.x} ${(H - viewH) / 2 + pan.y} ${viewW} ${viewH}`;

  const point = (e: React.PointerEvent<SVGElement>): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    const v = svg.viewBox.baseVal;
    return { x: v.x + ((e.clientX - r.left) / r.width) * v.width, y: v.y + ((e.clientY - r.top) / r.height) * v.height };
  };

  const asset = (kind: "map" | "drone") => {
    const url = kind === "map" ? master?.masterPlanUrl : master?.droneUrl;
    if (!url) return null;
    return `/api/projects/${encodeURIComponent(projectSlug)}/assets/file?kind=${kind === "map" ? "master-plan" : "drone"}&planType=master_plan&v=${encodeURIComponent(url)}`;
  };

  useEffect(() => { void load(); }, [projectSlug]);

  useEffect(() => {
    if (!loaded.current || !dirty) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void save(), 700);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [plans, plots, sections, layers, zoom, pan, dirty]);

  async function load() {
    try {
      const r = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/plan`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Unable to load plan");
      const ps = (d.sections || []) as Plan[];
      setPlans(ps);
      const nextSections: Record<string, string> = {};
      ps.filter(p => p.id !== "master_plan").forEach(p => { nextSections[p.id] = stringify(normalize8(parse(p.points || ""))); });
      setSections(nextSections);
      setPlots((d.lots || []).map((p: Plot) => { const q = normalize8(parse(p.points || "")); const c = center(q); return { ...p, points: stringify(q), labelX: c.x, labelY: c.y }; }));
      const g = ps.find(p => p.id === "master_plan")?.layerGeometry;
      if (g) {
        if (g.map) setLayers(v => ({ ...v, map: { ...defaultLayer(.72), ...g.map } }));
        if (g.drone) setLayers(v => ({ ...v, drone: { ...defaultLayer(.42), ...g.drone } }));
        if (Number.isFinite(g.zoom)) setZoom(Math.max(.25, Math.min(8, Number(g.zoom))));
        setPan({ x: Number(g.panX || 0), y: Number(g.panY || 0) });
      }
      loaded.current = true;
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to load plan"); }
  }

  async function save() {
    if (!loaded.current || busy || !dirty) return;
    setBusy(true);
    try {
      const layerGeometry = { map: layers.map, drone: layers.drone, zoom, panX: pan.x, panY: pan.y };
      const payload = plans.map(p => ({ ...p, points: p.id === "master_plan" ? p.points || null : sections[p.id] || p.points || null, layerGeometry: p.id === "master_plan" ? layerGeometry : p.layerGeometry || {} }));
      const r = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/plan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sections: payload, lots: plots }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Unable to save");
      setDirty(false); setMessage("Saved to database");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to save"); }
    finally { setBusy(false); }
  }

  function deselect() { setSelected(null); setSelectedSection(null); setDrag(null); }

  async function addSection() {
    const n = Math.max(0, ...plans.map(p => Number(p.id.match(/^section_(\d+)$/)?.[1] || 0))) + 1;
    const id = `section_${n}`;
    try {
      const r = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/plans`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planType: id }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Unable to add section");
      const q = stringify(octagon(120 + ((n - 1) % 3) * 480, 120 + Math.floor((n - 1) / 3) * 300, 380, 230));
      setPlans(v => [...v, { id, name: `Section ${n}`, sortOrder: n, points: q }]);
      setSections(v => ({ ...v, [id]: q })); setPlanId(id); setSelectedSection(id); setSelected(null); setDirty(true); setMessage(`Section ${n} added`);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to add section"); }
  }

  async function deleteSection(id: string) {
    try {
      const r = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/plans`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planType: id }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Unable to delete section");
      setPlans(v => v.filter(p => p.id !== id)); setSections(v => { const n = { ...v }; delete n[id]; return n; });
      setPlots(v => v.map(p => p.sectionId === id ? { ...p, sectionId: null } : p)); setPlanId("master_plan"); deselect(); setDirty(true); setMessage("Section deleted");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to delete section"); }
    finally { setConfirm(null); }
  }

  function renamePlan(id: string, name: string) { setPlans(v => v.map(p => p.id === id ? { ...p, name } : p)); setDirty(true); }

  function addPlot() {
    const n = String(Math.max(0, ...plots.map(p => Number(p.number)).filter(Number.isFinite)) + 1);
    const q = octagon(650, 430, 180, 110); const c = center(q);
    const p: Plot = { id: crypto.randomUUID(), number: n, status: "available", owner: "", price: null, area: null, direction: "", model: "", points: stringify(q), labelX: c.x, labelY: c.y, sectionId: planId === "master_plan" ? null : planId };
    setPlots(v => [...v, p]); setSelected(p.id); setSelectedSection(null); setDirty(true); setMessage(`Plot ${n} added`);
  }

  function updatePlot(k: keyof Plot, value: string) {
    if (!selectedPlot) return;
    setPlots(v => v.map(p => p.id === selectedPlot.id ? { ...p, [k]: k === "sectionId" ? (value || null) : value } : p)); setDirty(true);
  }

  function choosePlot(id: string) {
    if (!id) { setSelected(null); return; }
    const p = plots.find(x => x.id === id); if (!p) return;
    const q = normalize8(parse(p.points)); const c = center(q); const b = bounds(q);
    const targetZoom = Math.min(8, Math.max(.75, Math.min(W / Math.max(1, b.maxX - b.minX), H / Math.max(1, b.maxY - b.minY)) * .55));
    setSelected(id); setSelectedSection(null); setPlanId("master_plan"); setZoom(targetZoom); setPan({ x: c.x - W / 2, y: c.y - H / 2 });
  }

  function selectSection(id: string) {
    setPlanId(id); setSelectedSection(id); setSelected(null);
    const q = normalize8(parse(sections[id] || "")); if (q.length) { const c = center(q); const b = bounds(q); setPan({ x: c.x - W / 2, y: c.y - H / 2 }); setZoom(Math.min(8, Math.max(.6, Math.min(W / Math.max(1, b.maxX - b.minX), H / Math.max(1, b.maxY - b.minY)) * .75))); }
  }

  function startCanvasPan(e: React.PointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return;
    setSelected(null); setSelectedSection(null);
    const p = { x: e.clientX, y: e.clientY };
    setDrag({ kind: "pan", id: "canvas", start: p, panStart: { ...pan } });
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function startShape(e: React.PointerEvent<SVGElement>, id: string, q: Point[], kind: "plot" | "section") {
    e.stopPropagation();
    if (kind === "plot") { setSelected(id); setSelectedSection(null); } else { setSelectedSection(id); setSelected(null); }
    setDrag({ kind: kind === "plot" ? "plot-move" : "section-move", id, start: point(e), points: q });
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function startPoint(e: React.PointerEvent<SVGCircleElement>, id: string, index: number, kind: "plot" | "section") {
    e.stopPropagation();
    const q = kind === "plot" ? normalize8(parse(plots.find(p => p.id === id)?.points || "")) : normalize8(parse(sections[id] || ""));
    if (kind === "plot") setSelected(id); else setSelectedSection(id);
    setDrag({ kind: kind === "plot" ? "plot-point" : "section-point", id, start: point(e), points: q, index });
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function move(e: React.PointerEvent<SVGSVGElement>) {
    if (!drag) return;
    if (drag.kind === "pan") {
      const r = svgRef.current?.getBoundingClientRect(); if (!r) return;
      setPan({ x: drag.panStart!.x - (e.clientX - drag.start.x) * viewW / r.width, y: drag.panStart!.y - (e.clientY - drag.start.y) * viewH / r.height }); setDirty(true); return;
    }
    const n = point(e), dx = n.x - drag.start.x, dy = n.y - drag.start.y;
    const q = drag.points!.map((p, i) => drag.kind.endsWith("point") ? (i === drag.index ? { x: p.x + dx, y: p.y + dy } : p) : { x: p.x + dx, y: p.y + dy });
    if (drag.kind.startsWith("plot")) { const c = center(q); setPlots(v => v.map(p => p.id === drag.id ? { ...p, points: stringify(q), labelX: c.x, labelY: c.y } : p)); }
    else { const s = stringify(q); setSections(v => ({ ...v, [drag.id]: s })); setPlans(v => v.map(p => p.id === drag.id ? { ...p, points: s } : p)); }
    setDirty(true);
  }

  async function upload(kind: "map" | "drone", file: File) {
    setUploading(kind);
    try {
      const form = new FormData(); form.append("file", file); form.append("kind", kind === "map" ? "master-plan" : "drone"); form.append("planType", "master_plan");
      const r = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/assets`, { method: "POST", body: form }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "Upload failed");
      setPlans(v => v.map(p => p.id === "master_plan" ? { ...p, ...(kind === "map" ? { masterPlanUrl: d.savedValue } : { droneUrl: d.savedValue }) } : p)); setDirty(true); setMessage(`${kind} uploaded`);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Upload failed"); } finally { setUploading(null); }
  }

  function resetView() { setZoom(1); setPan({ x: 0, y: 0 }); setDirty(true); }
  function layerChange(kind: "map" | "drone", patch: Partial<Layer>) { setLayers(v => ({ ...v, [kind]: { ...v[kind], ...patch } })); setDirty(true); }
  function handles(q: Point[]) { const b = bounds(q); return [b.minX, (b.minX + b.maxX) / 2, b.maxX, b.maxX, b.maxX, (b.minX + b.maxX) / 2, b.minX, b.minX].map((x, i) => ({ x, y: [b.minY, b.minY, b.minY, (b.minY + b.maxY) / 2, b.maxY, b.maxY, b.maxY, (b.minY + b.maxY) / 2][i] })); }

  const image = (kind: "map" | "drone") => {
    const src = asset(kind); if (!src || !layers[kind].visible) return null;
    const l = layers[kind];
    return <image key={kind} href={src} x={l.x} y={l.y} width={l.width} height={l.height} opacity={l.opacity} preserveAspectRatio="none" pointerEvents="none" />;
  };

  return <div style={{ height: "100vh", display: "grid", gridTemplateRows: "68px 1fr", background: "#f3f5f8", color: "#172033", fontFamily: "Inter,system-ui,sans-serif" }}>
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", background: "white", borderBottom: "1px solid #e2e8f0" }}>
      <div><small style={{ fontWeight: 800, color: "#64748b" }}>LANDGRID / MAP & MANAGE</small><h2 style={{ margin: 0, fontSize: 20 }}>{section?.name || master?.name || "Master Plan"}</h2></div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={{ fontSize: 12, color: busy ? "#b45309" : "#15803d" }}>{busy ? "Saving…" : message || "All changes saved"}</span><button type="button" onClick={() => void save()} disabled={Boolean(!dirty || busy)} suppressHydrationWarning><Save size={14} /> Save</button></div>
    </header>
    <div style={{ display: "grid", gridTemplateColumns: "285px minmax(0,1fr) 310px", minHeight: 0 }}>
      <aside style={{ background: "white", borderRight: "1px solid #e2e8f0", padding: 12, overflow: "auto" }}>
        <button type="button" onClick={() => { setPlanId("master_plan"); setSelected(null); setSelectedSection(null); }} style={{ width: "100%", padding: 9, background: planId === "master_plan" ? "#eef2ff" : "white" }}>Master Plan</button>
        <div style={{ margin: "16px 0 6px", fontSize: 11, fontWeight: 900, color: "#64748b" }}>PLOTS</div>
        <button type="button" onClick={addPlot} style={{ width: "100%", padding: 9 }}><Plus size={14} /> Add Plot</button>
        <select aria-label="Select a plot" value={selected || ""} onChange={e => choosePlot(e.target.value)} style={{ width: "100%", marginTop: 7, padding: 9 }}><option value="">Select a plot…</option>{plots.slice().sort((a,b) => Number(a.number)-Number(b.number)).map(p => <option key={p.id} value={p.id}>Plot {p.number}{p.sectionId ? ` — ${plans.find(s => s.id === p.sectionId)?.name || "Section"}` : ""}</option>)}</select>
        <div style={{ margin: "16px 0 6px", fontSize: 11, fontWeight: 900, color: "#64748b" }}>SECTIONS</div>
        <button type="button" onClick={() => void addSection()} style={{ width: "100%", padding: 9 }}><Plus size={14} /> Add Section</button>
        {sectionList.map(s => <div key={s.id} style={{ display: "flex", gap: 4, marginTop: 6 }}><button type="button" onClick={() => selectSection(s.id)} style={{ flex: 1, textAlign: "left", padding: 8, background: selectedSection === s.id ? "#dbeafe" : "white" }}>{s.name}</button><button type="button" title="Delete section" onClick={() => setConfirm({ kind: "section", id: s.id, label: s.name })}><Trash2 size={14} /></button></div>)}
        <div style={{ margin: "18px 0 6px", fontSize: 11, fontWeight: 900, color: "#64748b" }}>MAP / DRONE</div>
        {(["map", "drone"] as const).map(k => <div key={k} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 8, marginTop: 6 }}><b style={{ fontSize: 12 }}>{k.toUpperCase()}</b><div style={{ display: "flex", gap: 5, marginTop: 6 }}><button type="button" onClick={() => layerChange(k, { visible: !layers[k].visible })}>{layers[k].visible ? "Hide" : "Show"}</button><input aria-label={`${k} opacity`} type="range" min="0" max="1" step=".05" value={layers[k].opacity} onChange={e => layerChange(k, { opacity: Number(e.target.value) })} /></div><button type="button" style={{ width: "100%", marginTop: 5 }} onClick={() => (k === "map" ? mapInput.current?.click() : droneInput.current?.click())}><Upload size={13} /> {uploading === k ? "Uploading…" : `Upload ${k}`}</button></div>)}
        <input ref={mapInput} hidden type="file" accept="image/*,.svg" onChange={e => { const f=e.target.files?.[0]; if(f) void upload("map",f); e.currentTarget.value=""; }} /><input ref={droneInput} hidden type="file" accept="image/*,.svg" onChange={e => { const f=e.target.files?.[0]; if(f) void upload("drone",f); e.currentTarget.value=""; }} />
      </aside>
      <main style={{ position: "relative", minWidth: 0, background: "#dfe4e9" }}>
        <div style={{ position: "absolute", zIndex: 5, top: 12, left: 12, right: 12, display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", padding: 9, borderRadius: 10, background: "rgba(255,255,255,.96)", boxShadow: "0 2px 12px rgba(0,0,0,.08)" }}><b>Canvas</b><button type="button" onClick={() => setZoom(z => Math.min(8, +(z * 1.25).toFixed(2)))}><Plus size={14}/></button><span>{Math.round(zoom*100)}%</span><button type="button" onClick={() => setZoom(z => Math.max(.25, +(z / 1.25).toFixed(2)))}><Minus size={14}/></button><button type="button" onClick={resetView}>Fit</button><span style={{ marginLeft: "auto", color: "#64748b", fontSize: 12 }}>Drag anywhere to pan • blank click deselects</span></div>
        <svg ref={svgRef} viewBox={viewBox} preserveAspectRatio="none" onPointerDown={startCanvasPan} onPointerMove={move} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none", cursor: drag?.kind === "pan" ? "grabbing" : "grab" }}>
          {image("drone")}{image("map")}
          {sectionList.map(s => { const q = normalize8(parse(sections[s.id] || "")); const c=center(q); const selectedSectionNow=selectedSection===s.id; return <g key={s.id} opacity={.55}><polygon points={stringify(q)} fill={selectedSectionNow ? "rgba(124,58,237,.25)" : "rgba(124,58,237,.08)"} stroke={selectedSectionNow ? "#7c3aed" : "#64748b"} strokeWidth={selectedSectionNow ? 4 : 2} onPointerDown={e => startShape(e, s.id, q, "section")} />{selectedSectionNow && q.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={9/zoom} fill="white" stroke="#7c3aed" strokeWidth={3/zoom} onPointerDown={e => startPoint(e,s.id,i,"section")} />)}<text x={c.x} y={c.y} textAnchor="middle" fontSize={24} fontWeight={800} pointerEvents="none" fill="#172033" paintOrder="stroke" stroke="white" strokeWidth={5}>{s.name}</text></g>; })}
          {visiblePlots.map(p => { const q=normalize8(parse(p.points)); const selectedNow=selected===p.id; const c=center(q); return <g key={p.id}><polygon points={stringify(q)} fill={selectedNow ? "rgba(37,99,235,.32)" : "rgba(37,99,235,.10)"} stroke={selectedNow ? "#1d4ed8" : "#334155"} strokeWidth={selectedNow ? 4 : 2} onPointerDown={e=>startShape(e,p.id,q,"plot")} />{selectedNow && handles(q).map((h,i)=><circle key={i} cx={h.x} cy={h.y} r={9/zoom} fill="white" stroke="#1d4ed8" strokeWidth={3/zoom} onPointerDown={e=>startPoint(e,p.id,i,"plot")} />)}<text x={c.x} y={c.y} textAnchor="middle" dominantBaseline="middle" fontSize={24} fontWeight={800} pointerEvents="none" fill="#172033" paintOrder="stroke" stroke="white" strokeWidth={5}>{p.number}</text></g>; })}
        </svg>
        {!asset("map") && !asset("drone") && <div style={{ position:"absolute", inset:0, display:"grid", placeItems:"center", color:"#64748b", pointerEvents:"none" }}>Upload a map or drone image to begin.</div>}
      </main>
      <aside style={{ background:"white", borderLeft:"1px solid #e2e8f0", padding:15, overflow:"auto" }}>
        {selectedPlot ? <><div style={{ display:"flex", justifyContent:"space-between" }}><div><small style={{ color:"#64748b" }}>SELECTED PLOT</small><h3 style={{ margin:"2px 0" }}>Plot {selectedPlot.number}</h3></div><button type="button" onClick={() => setSelected(null)}><X size={15}/></button></div><label style={{display:"block",marginTop:12}}>Plot Number<input value={selectedPlot.number} onChange={e=>updatePlot("number",e.target.value)} style={{width:"100%"}}/></label><label style={{display:"block",marginTop:12}}>Section<select value={selectedPlot.sectionId || ""} onChange={e=>updatePlot("sectionId",e.target.value)} style={{width:"100%"}}><option value="">Master Plan</option>{sectionList.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label style={{display:"block",marginTop:12}}>Status<select value={selectedPlot.status} onChange={e=>updatePlot("status",e.target.value)} style={{width:"100%"}}><option>available</option><option>reserved</option><option>sold</option><option>hold</option></select></label><label style={{display:"block",marginTop:12}}>Owner<input value={selectedPlot.owner} onChange={e=>updatePlot("owner",e.target.value)} style={{width:"100%"}}/></label><label style={{display:"block",marginTop:12}}>Price<input value={selectedPlot.price ?? ""} onChange={e=>updatePlot("price",e.target.value)} style={{width:"100%"}}/></label><label style={{display:"block",marginTop:12}}>Area<input value={selectedPlot.area ?? ""} onChange={e=>updatePlot("area",e.target.value)} style={{width:"100%"}}/></label><label style={{display:"block",marginTop:12}}>Direction<input value={selectedPlot.direction} onChange={e=>updatePlot("direction",e.target.value)} style={{width:"100%"}}/></label><label style={{display:"block",marginTop:12}}>Model<input value={selectedPlot.model} onChange={e=>updatePlot("model",e.target.value)} style={{width:"100%"}}/></label><button type="button" onClick={() => setConfirm({kind:"plot",id:selectedPlot.id,label:`Plot ${selectedPlot.number}`})} style={{marginTop:18,width:"100%",padding:9,color:"#b91c1c"}}><Trash2 size={14}/> Delete plot</button></> : selectedSection ? <><div><small style={{color:"#64748b"}}>SELECTED SECTION</small><h3 style={{margin:"2px 0"}}>{selectedSection ? section?.name : "Section"}</h3></div><label style={{display:"block",marginTop:14}}>Section name<input value={section?.name || ""} onChange={e=>renamePlan(selectedSection,e.target.value)} style={{width:"100%"}}/></label><button type="button" onClick={()=>setConfirm({kind:"section",id:selectedSection,label:section?.name || selectedSection})} style={{marginTop:18,width:"100%",padding:9,color:"#b91c1c"}}><Trash2 size={14}/> Delete section</button></> : <div style={{color:"#64748b"}}>Click a plot or section to edit it. Click blank canvas to deselect.</div>}
      </aside>
    </div>
    {confirm && <div style={{position:"fixed",inset:0,zIndex:50,display:"grid",placeItems:"center",background:"rgba(15,23,42,.45)"}}><div style={{width:380,background:"white",borderRadius:12,padding:22}}><h3>Delete {confirm.kind}?</h3><p>Are you sure you want to delete <b>{confirm.label}</b>?</p><div style={{display:"flex",justifyContent:"flex-end",gap:8}}><button type="button" onClick={()=>setConfirm(null)}>Cancel</button><button type="button" onClick={()=>confirm.kind==="section"?void deleteSection(confirm.id):(setPlots(v=>v.filter(p=>p.id!==confirm.id)),selected===confirm.id&&setSelected(null),setDirty(true),setConfirm(null),setMessage("Plot deleted"))} disabled={Boolean(busy)} suppressHydrationWarning style={{background:"#b91c1c",color:"white",border:0,padding:"9px 14px",borderRadius:7}}>Delete</button></div></div></div>}
  </div>;
}