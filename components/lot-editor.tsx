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
      const r = svgRef.current?.getBoundingClientRect(); if (!r || !drag.panStart) return;
      const dx = ((e.clientX - drag.start.x) / r.width) * viewW;
      const dy = ((e.clientY - drag.start.y) / r.height) * viewH;
      setPan({ x: drag.panStart.x - dx, y: drag.panStart.y - dy }); setDirty(true); return;
    }
    const p = point(e), dx = p.x - drag.start.x, dy = p.y - drag.start.y;
    if (drag.kind === "plot-move" || drag.kind === "section-move") {
      const q = drag.points!.map(v => ({ x: v.x + dx, y: v.y + dy }));
      if (drag.kind === "plot-move") { const c = center(q); setPlots(v => v.map(x => x.id === drag.id ? { ...x, points: stringify(q), labelX: c.x, labelY: c.y } : x)); }
      else setSections(v => ({ ...v, [drag.id]: stringify(q) })); setDirty(true); return;
    }
    const q = drag.points!.map((v, i) => i === drag.index ? { x: v.x + dx, y: v.y + dy } : v);
    if (drag.kind === "plot-point") { const c = center(q); setPlots(v => v.map(x => x.id === drag.id ? { ...x, points: stringify(q), labelX: c.x, labelY: c.y } : x)); }
    else setSections(v => ({ ...v, [drag.id]: stringify(q) })); setDirty(true);
  }

  async function upload(kind: "map" | "drone", file: File) {
    setUploading(kind);
    try {
      const form = new FormData(); form.append("file", file); form.append("planType", "master_plan"); form.append("kind", kind === "map" ? "master-plan" : "drone");
      const r = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/assets`, { method: "POST", body: form }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "Upload failed");
      setPlans(v => v.map(p => p.id === "master_plan" ? { ...p, ...(kind === "map" ? { masterPlanUrl: d.url } : { droneUrl: d.url }) } : p)); setDirty(true); setMessage(`${kind === "map" ? "Map" : "Drone"} uploaded`);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Upload failed"); } finally { setUploading(null); }
  }

  function confirmDelete() {
    if (!confirm) return;
    if (confirm.kind === "section") void deleteSection(confirm.id);
    else { setPlots(v => v.filter(p => p.id !== confirm.id)); if (selected === confirm.id) setSelected(null); setDirty(true); setConfirm(null); setMessage("Plot deleted"); }
  }

  return <div style={{ height: "100vh", display: "grid", gridTemplateRows: "72px 1fr", fontFamily: "Inter,system-ui,sans-serif", background: "#f6f7f9", color: "#172033" }}>
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", background: "white", borderBottom: "1px solid #e2e8f0" }}>
      <div><small style={{ fontWeight: 800, color: "#64748b" }}>LANDGRID / MAP & MANAGE</small><h2 style={{ margin: 0, fontSize: 20 }}>{section?.name || master?.name || "Master Plan"}</h2></div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={{ fontSize: 12, color: busy ? "#b45309" : "#15803d" }}>{busy ? "Saving…" : message || "All changes saved"}</span><button type="button" onClick={() => void save()} disabled={Boolean(!dirty || busy)}><Save size={14} /> Save</button></div>
    </header>
    <div style={{ display: "grid", gridTemplateColumns: "285px minmax(0,1fr) 310px", minHeight: 0 }}>
      <aside style={{ background: "white", borderRight: "1px solid #e2e8f0", padding: 12, overflow: "auto" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}><button type="button" onClick={() => mapInput.current?.click()} disabled={Boolean(uploading)}>Upload Map</button><button type="button" onClick={() => droneInput.current?.click()} disabled={Boolean(uploading)}>Upload Drone</button><input ref={mapInput} hidden type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) void upload("map", f); e.currentTarget.value = ""; }} /><input ref={droneInput} hidden type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) void upload("drone", f); e.currentTarget.value = ""; }} /></div>
        <button type="button" onClick={addSection} disabled={Boolean(busy)} style={{ width: "100%", padding: 10, marginBottom: 8 }}>+ Add section</button>
        <button type="button" onClick={addPlot} disabled={Boolean(busy)} style={{ width: "100%", padding: 10, marginBottom: 16 }}>+ Add plot</button>
        <b style={{ fontSize: 12, color: "#64748b" }}>SECTIONS</b>
        {sectionList.map(p => <div key={p.id} style={{ display: "flex", gap: 4, marginTop: 6 }}><button type="button" onClick={() => selectSection(p.id)} style={{ flex: 1, textAlign: "left", padding: 9, border: "1px solid #e5e7eb", background: p.id === planId ? "#eef2ff" : "white", borderRadius: 7 }}>{p.name}</button><button type="button" title="Delete section" onClick={() => setConfirm({ kind: "section", id: p.id, label: p.name })}><Trash2 size={15} /></button></div>)}
        <b style={{ display: "block", fontSize: 12, color: "#64748b", marginTop: 18 }}>PLOTS</b>
        <select value={selected || ""} onChange={e => choosePlot(e.target.value)} style={{ width: "100%", marginTop: 6, padding: 8 }}><option value="">Select a plot…</option>{plots.slice().sort((a,b) => Number(a.number)-Number(b.number)).map(p => <option key={p.id} value={p.id}>Plot {p.number}</option>)}</select>
      </aside>
      <main style={{ position: "relative", minWidth: 0, background: "#e5e7eb" }}>
        <div style={{ position: "absolute", zIndex: 5, top: 12, left: 12, right: 12, display: "flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,.96)", padding: 9, borderRadius: 10, boxShadow: "0 2px 12px rgba(0,0,0,.08)" }}><b>Zoom</b><button type="button" onClick={() => setZoom(v => Math.min(8, +(v + .1).toFixed(2)))}><Plus size={14}/></button><span>{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom(v => Math.max(.25, +(v - .1).toFixed(2)))}><Minus size={14}/></button><button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); setDirty(true); }}>Fit</button><span style={{ marginLeft: "auto", color: "#64748b", fontSize: 12 }}>Drag empty map to pan</span></div>
        <svg ref={svgRef} viewBox={viewBox} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none", background: "#dfe3e8", cursor: drag?.kind === "pan" ? "grabbing" : "grab" }} onPointerDown={startCanvasPan} onPointerMove={move} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
          {(["drone", "map"] as const).map(kind => { const u = asset(kind); return u ? <image key={kind} href={u} x={layers[kind].x} y={layers[kind].y} width={layers[kind].width} height={layers[kind].height} opacity={layers[kind].opacity} preserveAspectRatio="none" pointerEvents="none" /> : null; })}
          {sectionList.map(p => { const q = normalize8(parse(sections[p.id] || p.points || "")); const c = center(q); const selectedSectionState = selectedSection === p.id; return <g key={p.id}><polygon points={stringify(q)} fill={selectedSectionState ? "rgba(124,58,237,.18)" : "rgba(124,58,237,.08)"} stroke="#7c3aed" strokeWidth={selectedSectionState ? 4 : 2} onPointerDown={e => startShape(e, p.id, q, "section")} />{selectedSectionState && q.map((v,i)=><circle key={i} cx={v.x} cy={v.y} r={9/zoom} fill="#7c3aed" stroke="white" strokeWidth={2} onPointerDown={e => startPoint(e,p.id,i,"section")} />)}<text x={c.x} y={c.y} textAnchor="middle" dominantBaseline="middle" fontSize="22" fontWeight="800" fill="#4c1d95" pointerEvents="none">{p.name}</text></g>; })}
          {visiblePlots.map(p => { const q = normalize8(parse(p.points)); const c = center(q); const isSelected = selected === p.id; return <g key={p.id}><polygon points={stringify(q)} fill={isSelected ? "rgba(37,99,235,.30)" : "rgba(37,99,235,.12)"} stroke={isSelected ? "#1d4ed8" : "#334155"} strokeWidth={isSelected ? 4 : 2} onPointerDown={e => startShape(e,p.id,q,"plot")} />{isSelected && q.map((v,i)=><circle key={i} cx={v.x} cy={v.y} r={9/zoom} fill="#1d4ed8" stroke="white" strokeWidth={2} onPointerDown={e => startPoint(e,p.id,i,"plot")} />)}<text x={c.x} y={c.y} textAnchor="middle" dominantBaseline="middle" fontSize="24" fontWeight="800" fill="#172033" paintOrder="stroke" stroke="white" strokeWidth="5" pointerEvents="none">{p.number}</text></g>; })}
        </svg>
      </main>
      <aside style={{ background: "white", borderLeft: "1px solid #e2e8f0", padding: 16, overflow: "auto" }}>
        {selectedSection ? <><div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}><div><b>Section</b><small style={{ display:"block", color:"#64748b" }}>Edit section</small></div><button type="button" onClick={deselect}><X size={16}/></button></div><label style={{ display:"block", marginTop:16 }}>Section name<input value={section?.name || ""} onChange={e => renamePlan(selectedSection,e.target.value)} style={{ width:"100%" }}/></label><button type="button" onClick={() => setConfirm({kind:"section",id:selectedSection,label:section?.name || "Section"})} style={{ marginTop:18, width:"100%", padding:10, color:"#b91c1c" }}><Trash2 size={15}/> Delete section</button></> : selectedPlot ? <><div style={{ display:"flex", justifyContent:"space-between" }}><div><b>Plot {selectedPlot.number}</b><small style={{ display:"block", color:"#64748b" }}>Edit plot</small></div><button type="button" onClick={deselect}><X size={16}/></button></div><label style={{ display:"block", marginTop:16 }}>Plot number<input value={selectedPlot.number} onChange={e => updatePlot("number",e.target.value)} style={{ width:"100%" }}/></label><label style={{ display:"block", marginTop:10 }}>Section<select value={selectedPlot.sectionId || ""} onChange={e => updatePlot("sectionId",e.target.value)} style={{ width:"100%" }}><option value="">Master Plan</option>{sectionList.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label style={{ display:"block", marginTop:10 }}>Status<select value={selectedPlot.status} onChange={e => updatePlot("status",e.target.value)} style={{ width:"100%" }}><option>available</option><option>reserved</option><option>sold</option><option>hold</option></select></label><label style={{ display:"block", marginTop:10 }}>Owner<input value={selectedPlot.owner} onChange={e => updatePlot("owner",e.target.value)} style={{ width:"100%" }}/></label><label style={{ display:"block", marginTop:10 }}>Price<input value={selectedPlot.price ?? ""} onChange={e => updatePlot("price",e.target.value)} style={{ width:"100%" }}/></label><label style={{ display:"block", marginTop:10 }}>Area<input value={selectedPlot.area ?? ""} onChange={e => updatePlot("area",e.target.value)} style={{ width:"100%" }}/></label><button type="button" onClick={() => setConfirm({kind:"plot",id:selectedPlot.id,label:`Plot ${selectedPlot.number}`})} style={{ marginTop:18, width:"100%", padding:10, color:"#b91c1c" }}><Trash2 size={15}/> Delete plot</button></> : <div style={{ color:"#64748b" }}>Click an empty area of the map to deselect. Drag the empty map to pan.</div>}
      </aside>
    </div>
    {confirm && <div style={{ position:"fixed", inset:0, zIndex:50, display:"grid", placeItems:"center", background:"rgba(15,23,42,.45)" }}><div style={{ width:380, background:"white", borderRadius:12, padding:22 }}><h3>Delete {confirm.kind}?</h3><p>Are you sure you want to delete <b>{confirm.label}</b>?</p><div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}><button type="button" onClick={() => setConfirm(null)}>Cancel</button><button type="button" onClick={confirmDelete} disabled={Boolean(busy)} style={{ background:"#b91c1c", color:"white", border:0, padding:"9px 14px", borderRadius:7 }}>Delete</button></div></div></div>}
  </div>;
}
