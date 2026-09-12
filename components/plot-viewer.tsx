"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Search, X } from "lucide-react";

type Point = { x: number; y: number };
type Layer = { x: number; y: number; width: number; height: number; opacity: number; visible: boolean };
type Plan = { id: string; name: string; masterPlanUrl?: string | null; droneUrl?: string | null; layerGeometry?: any };
type Lot = { id: string; number: string; status: string; ownerName?: string; price: number | string | null; area: number | string | null; areaSqFt: number | null; lengthM: number | null; widthM: number | null; direction: string; notes: string; points: string; sectionId?: string | null };

const DEFAULT_W = 1600, DEFAULT_H = 1000;
const parse = (s: string): Point[] => s.trim().split(/\s+/).filter(Boolean).map(v => { const [x, y] = v.split(",").map(Number); return { x, y }; }).filter(p => isFinite(p.x) && isFinite(p.y));
const stringify = (p: Point[]) => p.map(v => `${Math.round(v.x)},${Math.round(v.y)}`).join(" ");
const center = (p: Point[]) => p.length ? { x: p.reduce((a, v) => a + v.x, 0) / p.length, y: p.reduce((a, v) => a + v.y, 0) / p.length } : { x: DEFAULT_W / 2, y: DEFAULT_H / 2 };
const normalize = (p: Point[]) => p.length >= 3 ? p : [{ x: 600, y: 400 }, { x: 800, y: 400 }, { x: 800, y: 520 }, { x: 600, y: 520 }];
const edgeLen = (a: Point, b: Point) => Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);

const STATUS: Record<string, { dot: string; stroke: string; label: string }> = {
  available: { dot: "#16a34a", stroke: "rgba(22,163,74,.55)", label: "Available" },
  reserved: { dot: "#ca8a04", stroke: "rgba(202,138,4,.55)", label: "Reserved" },
  sold: { dot: "#dc2626", stroke: "rgba(220,38,38,.55)", label: "Sold" },
  hold: { dot: "#64748b", stroke: "rgba(100,116,139,.45)", label: "Hold" },
};
const sc = (s: string) => STATUS[s] ?? { dot: "#334155", stroke: "rgba(51,65,85,.4)", label: s };

export default function PlotViewer({ projectSlug }: { projectSlug: string }) {
  const [cw, setCw] = useState(DEFAULT_W), [ch, setCh] = useState(DEFAULT_H);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [planId, setPlanId] = useState("master_plan");
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSearch, setFilterSearch] = useState("");
  const [layer, setLayer] = useState<"map" | "drone">("map");
  const [mapL, setMapL] = useState<Layer>({ x: 0, y: 0, width: DEFAULT_W, height: DEFAULT_H, opacity: 1, visible: true });
  const [droneL, setDroneL] = useState<Layer>({ x: 0, y: 0, width: DEFAULT_W, height: DEFAULT_H, opacity: 1, visible: true });
  const [unit, setUnit] = useState<"m" | "ft" | "yd">("m");
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState<"none" | "detail">("none");

  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const pinch = useRef<{ dist: number; px: number; py: number; zoom: number } | null>(null);

  const vw = cw / zoom, vh = ch / zoom;
  const viewBox = `${pan.x} ${pan.y} ${vw} ${vh}`;
  const conv = (m: number) => unit === "ft" ? (m * 3.281).toFixed(1) : unit === "yd" ? (m * 1.094).toFixed(1) : m.toFixed(1);

  useEffect(() => {
    fetch(`/api/projects/${encodeURIComponent(projectSlug)}/plan`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        const W = d.canvasWidth || DEFAULT_W, H = d.canvasHeight || DEFAULT_H;
        setCw(W); setCh(H);
        const master = (d.sections || []).find((s: any) => s.id === "master_plan");
        const geom = master?.layerGeometry;
        const iw = master?.imageWidth ?? null, ih = master?.imageHeight ?? null;
        const dx = iw ? (W - iw) / 2 : 0, dy = ih ? (H - ih) / 2 : 0;
        const dw = iw || W, dh = ih || H;
        if (geom?.map?.width) setMapL(l => ({ ...l, ...geom.map, visible: geom.map.visible !== false }));
        else setMapL(l => ({ ...l, x: dx, y: dy, width: dw, height: dh, visible: true }));
        if (geom?.drone?.width) setDroneL(l => ({ ...l, ...geom.drone, visible: geom.drone.visible !== false }));
        else setDroneL(l => ({ ...l, x: dx, y: dy, width: dw, height: dh, visible: true }));
        setPlans(d.sections || []);
        setLots((d.lots || []).map((l: any) => ({
          id: l.id, number: l.number, status: l.status || "available", ownerName: l.ownerId ? ((d.owners || []).find((o: any) => o.id === l.ownerId)?.name || null) : null,
          price: l.price, area: l.area ?? null, areaSqFt: l.areaSqFt ?? null, lengthM: l.lengthM ?? null, widthM: l.widthM ?? null,
          direction: l.direction || "", notes: l.details || l.notes || "", points: l.points || "", sectionId: l.sectionId || null,
        })));
        setZoom(1);
        setPan({ x: 0, y: 0 });
      })
      .finally(() => setLoading(false));
  }, [projectSlug]);

  const master = plans.find(p => p.id === "master_plan") || plans[0];
  const sections = useMemo(() => plans.filter(p => p.id !== "master_plan"), [plans]);
  const planLots = useMemo(() => planId === "master_plan" ? lots : lots.filter(l => l.sectionId === planId), [lots, planId]);
  const filtered = useMemo(() => planLots.filter(l => {
    if (filterStatus !== "all" && l.status !== filterStatus) return false;
    if (filterSearch.trim()) { const q = filterSearch.toLowerCase(); return l.number.includes(q) || (l.ownerName || "").toLowerCase().includes(q); }
    return true;
  }), [planLots, filterStatus, filterSearch]);
  const filteredSet = useMemo(() => new Set(filtered.map(l => l.id)), [filtered]);
  const selectedLot = lots.find(l => l.id === selected) ?? null;
  const statusCounts = useMemo(() => { const c: Record<string, number> = { all: planLots.length }; for (const l of planLots) c[l.status] = (c[l.status] || 0) + 1; return c; }, [planLots]);
  const ownerSummary = useMemo(() => {
    const m = new Map<string, { count: number; area: number; plots: string[] }>();
    for (const l of planLots) {
      const owner = (l.ownerName || "Unassigned").trim() || "Unassigned";
      const v = m.get(owner) || { count: 0, area: 0, plots: [] };
      v.count += 1; v.area += Number(l.area || 0); v.plots.push(l.number); m.set(owner, v);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [planLots]);

  function assetUrl(kind: "map" | "drone") {
    const url = kind === "map" ? master?.masterPlanUrl : master?.droneUrl;
    if (!url) return null;
    return `/api/projects/${encodeURIComponent(projectSlug)}/assets/file?kind=${kind === "map" ? "master-plan" : "drone"}&planType=master_plan&v=${encodeURIComponent(url)}`;
  }

  function fitView() { setZoom(1); setPan({ x: 0, y: 0 }); }

  function focusLot(lot: Lot) {
    const q = normalize(parse(lot.points)), c = center(q);
    setSelected(lot.id); setPlanId(lot.sectionId || "master_plan"); setZoom(1.5); setPan({ x: c.x - cw / 2, y: c.y - ch / 2 }); setSheet("detail");
  }

  function onPD(e: React.PointerEvent) { if (e.button !== 0 && e.pointerType !== "touch") return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y }; }
  function onPM(e: React.PointerEvent) { if (!drag.current) return; const r = svgRef.current!.getBoundingClientRect(); setPan({ x: drag.current.px - (e.clientX - drag.current.sx) * vw / (r.width || 1), y: drag.current.py - (e.clientY - drag.current.sy) * vh / (r.height || 1) }); }
  function onPU() { drag.current = null; }
  function onWheel(e: React.WheelEvent) { e.preventDefault(); const d = e.deltaY > 0 ? 1 / 1.15 : 1.15; setZoom(z => Math.min(8, Math.max(.2, +(z * d).toFixed(3)))); }
  function onTouchStart(e: React.TouchEvent) { if (e.touches.length === 2) { const t0 = e.touches[0], t1 = e.touches[1]; const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY); pinch.current = { dist, px: (t0.clientX + t1.clientX) / 2, py: (t0.clientY + t1.clientY) / 2, zoom }; } }
  function onTouchMove(e: React.TouchEvent) { if (e.touches.length === 2 && pinch.current) { e.preventDefault(); const t0 = e.touches[0], t1 = e.touches[1]; const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY); setZoom(Math.min(8, Math.max(.2, pinch.current.zoom * (dist / pinch.current.dist)))); } }
  function onTouchEnd() { pinch.current = null; }

  function renderAnnotations(q: Point[], lot: Lot, z: number, sel: boolean) {
    const c = center(q); const sqYd = lot.area != null ? Number(lot.area) : null; const lm = lot.lengthM, wm = lot.widthM;
    const edges = q.map((pt, i) => { const nx = q[(i + 1) % q.length]; return { len: edgeLen(pt, nx), mx: (pt.x + nx.x) / 2, my: (pt.y + nx.y) / 2, angle: Math.atan2(nx.y - pt.y, nx.x - pt.x) * 180 / Math.PI }; });
    const hE = edges.filter(e => { const a = Math.abs(e.angle % 180); return a < 45 || a > 135; }).sort((a, b) => b.len - a.len); const vE = edges.filter(e => { const a = Math.abs(e.angle % 180); return a >= 45 && a <= 135; }).sort((a, b) => b.len - a.len); const sorted = [hE[0], vE[0]].filter(Boolean); const fs = 16 / z, off = 28 / z;
    const dim = (m: number) => unit === "ft" ? `${(m * 3.281).toFixed(1)}ft` : unit === "yd" ? `${(m * 1.094).toFixed(1)}yd` : `${m.toFixed(1)}m`;
    return <><text x={c.x} y={sel && sqYd != null ? c.y - 18 / z : c.y} textAnchor="middle" dominantBaseline="middle" fontSize={22 / z} fontWeight={900} pointerEvents="none" fill="#172033" paintOrder="stroke" stroke="white" strokeWidth={5 / z}>{lot.number}</text>{sel && sqYd != null && <text x={c.x} y={c.y + 16 / z} textAnchor="middle" dominantBaseline="middle" fontSize={14 / z} fontWeight={700} pointerEvents="none" fill="#475569" paintOrder="stroke" stroke="white" strokeWidth={3 / z}>{sqYd} sq.yd</text>}{sel && (lm || wm) && sorted.map((e, i) => { const absA = Math.abs(e.angle % 180), isH = absA < 45 || absA > 135; const d = lm && wm ? (isH ? lm : wm) : (lm || wm || null); if (!d) return null; const pa = e.angle + 90, cp = Math.cos(pa * Math.PI / 180), sp = Math.sin(pa * Math.PI / 180); const dot = cp * (c.x - e.mx) + sp * (c.y - e.my); const sign = dot > 0 ? -1 : 1; const px = e.mx + cp * off * sign, py = e.my + sp * off * sign; let rot = e.angle; if (rot > 90) rot -= 180; if (rot < -90) rot += 180; return <text key={i} x={px} y={py} textAnchor="middle" dominantBaseline="middle" fontSize={fs} fontWeight={400} pointerEvents="none" fill="#1e40af" paintOrder="stroke" stroke="rgba(255,255,255,.95)" strokeWidth={3 / z} transform={`rotate(${rot},${px},${py})`}>{dim(d)}</text>; })}</>;
  }

  const btn: React.CSSProperties = { border: "1px solid #dbe2ea", background: "#fff", color: "#243047", borderRadius: 8, padding: "8px 10px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 };
  if (loading) return <div style={{ height: "100%", display: "grid", placeItems: "center", color: "#64748b", fontSize: 14 }}>Loading…</div>;

  const filterContent = <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
    <div style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", fontWeight: 900 }}>Filters &amp; Find</div>
    {sections.length > 0 && <div style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}><div style={{ fontSize: 10, letterSpacing: 1, fontWeight: 900, color: "#7b8798", marginBottom: 7 }}>PLAN</div><button onClick={() => setPlanId("master_plan")} style={{ ...btn, width: "100%", justifyContent: "flex-start", marginBottom: 5 }}>▦ Master Plan</button>{sections.map(s => <button key={s.id} onClick={() => setPlanId(s.id)} style={{ ...btn, width: "100%", justifyContent: "flex-start", marginBottom: 4 }}>{s.name}</button>)}</div>}
    <div style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}><div style={{ fontSize: 10, letterSpacing: 1, fontWeight: 900, color: "#7b8798", marginBottom: 7 }}>STATUS</div>{[["all", "All"], ...Object.keys(STATUS).map(k => [k, STATUS[k].label])].map(([key, label]) => <button key={key} onClick={() => setFilterStatus(key)} style={{ ...btn, width: "100%", justifyContent: "space-between", marginBottom: 4, background: filterStatus === key ? "#172554" : "#fff", color: filterStatus === key ? "#fff" : "#243047" }}><span>{label}</span><span>{statusCounts[key] ?? 0}</span></button>)}</div>
    <div style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}><div style={{ position: "relative" }}><Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} /><input value={filterSearch} onChange={e => setFilterSearch(e.target.value)} placeholder="Search plot or owner…" style={{ width: "100%", boxSizing: "border-box", paddingLeft: 28, padding: "8px 10px 8px 28px", border: "1px solid #dbe2ea", borderRadius: 8, fontSize: 12 }} /></div></div>
    <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>{filtered.length === 0 ? <div style={{ padding: 16, textAlign: "center", color: "#94a3b8" }}>No plots match</div> : filtered.slice().sort((a, b) => Number(a.number) - Number(b.number)).map(lot => { const col = sc(lot.status); return <button key={lot.id} onClick={() => focusLot(lot)} style={{ width: "100%", textAlign: "left", padding: 10, border: `1px solid ${selected === lot.id ? col.dot : "#e4e9f0"}`, borderRadius: 8, background: selected === lot.id ? `${col.dot}18` : "#fff", marginBottom: 5, cursor: "pointer", display: "flex", alignItems: "center", gap: 9 }}><span style={{ width: 9, height: 9, borderRadius: 999, background: col.dot }} /><div><div style={{ fontWeight: 800 }}>Plot {lot.number}</div><div style={{ fontSize: 11, color: "#64748b" }}>{col.label}{lot.area != null ? ` · ${lot.area} sq.yd` : ""}</div></div></button>; })}</div>
  </div>;

  const detailContent = selectedLot ? (() => { const col = sc(selectedLot.status); return <div style={{ padding: "4px 16px 32px" }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}><div><div style={{ fontSize: 10, letterSpacing: 1, fontWeight: 900, color: "#64748b" }}>PLOT DETAILS</div><h3 style={{ margin: 0, fontSize: 24 }}>Plot {selectedLot.number}</h3></div><button onClick={() => { setSelected(null); setSheet("none"); }} style={{ ...btn, padding: 7 }}><X size={15} /></button></div><div style={{ display: "inline-flex", gap: 8, padding: "7px 14px", borderRadius: 999, border: `1.5px solid ${col.dot}`, color: col.dot, marginBottom: 16 }}>{col.label}</div>{(selectedLot.lengthM || selectedLot.widthM || selectedLot.area) && <div style={{ padding: 12, borderRadius: 10, background: "#f0f9ff", marginBottom: 12 }}><b>DIMENSIONS &amp; AREA</b><div>{selectedLot.lengthM && selectedLot.widthM ? `${conv(selectedLot.lengthM)}${unit} × ${conv(selectedLot.widthM)}${unit}` : ""}</div>{selectedLot.area != null && <strong>{selectedLot.area} sq.yd</strong>}</div>}<div style={{ display: "grid", gap: 12 }}>{[["Price", selectedLot.price != null ? `₹ ${selectedLot.price}` : null], ["Direction", selectedLot.direction || null], ["Owner", selectedLot.ownerName || null], ["Notes", selectedLot.notes || null]].filter(([, v]) => v).map(([label, value]) => <div key={label as string} style={{ padding: 10, borderRadius: 8, background: "#f8fafc" }}><div style={{ fontSize: 10, fontWeight: 900, color: "#94a3b8" }}>{label as string}</div><div style={{ fontWeight: 700 }}>{value as string}</div></div>)}</div></div>; })() : null;

  const summaryContent = <div style={{ padding: 14 }}><div style={{ fontSize: 10, letterSpacing: 1, fontWeight: 900, color: "#64748b", marginBottom: 12 }}>OWNER SUMMARY</div>{ownerSummary.length === 0 ? <div style={{ color: "#64748b", fontSize: 12 }}>No owner information.</div> : ownerSummary.map(([owner, v]) => <div key={owner} style={{ padding: "11px 10px", border: "1px solid #e2e8f0", borderRadius: 10, marginBottom: 8, background: "#f8fafc" }}><div style={{ fontWeight: 900 }}>{owner}</div><div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>{v.count} plots · {v.area.toFixed(2)} sq.yd</div><div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{v.plots.join(", ")}</div></div>)}</div>;

  return <>
    <style>{`*{box-sizing:border-box}.pv{height:100%;flex:1;min-height:0;display:grid;grid-template-columns:260px 1fr 300px;font-family:Inter,ui-sans-serif,system-ui,sans-serif;font-size:13px;color:#182235;background:#f4f6f9}.pv-left{background:#fff;border-right:1px solid #e2e8f0;display:flex;flex-direction:column;overflow:hidden}.pv-canvas{position:relative;overflow:hidden;background:#d9dee5;min-height:0}.pv-right{background:#fff;border-left:1px solid #e2e8f0;overflow-y:auto}.pv-toolbar{position:absolute;top:12px;left:12px;right:12px;z-index:10;display:flex;align-items:center;gap:6px;padding:7px 10px;border:1px solid rgba(226,232,240,.9);border-radius:12px;background:rgba(255,255,255,.97);box-shadow:0 4px 20px rgba(15,23,42,.1)}.pv-hint{font-size:11px;color:#64748b;margin-left:auto}.pv-bottom-bar{display:none}.pv-sheet{display:none}.pv-overlay{display:none}@media(max-width:767px){.pv{grid-template-columns:1fr}.pv-left,.pv-right{display:none}.pv-hint{display:none}.pv-toolbar{top:10px;left:10px;right:10px;padding:6px 8px;gap:4px}.pv-mobile-actions{display:grid!important}.pv-mobile-panel{display:block!important}.pv-sheet{display:flex;position:fixed;left:8px;right:8px;bottom:calc(70px + env(safe-area-inset-bottom));z-index:50;background:#fff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 8px 32px rgba(15,23,42,.22);transform:translateY(calc(100% + 20px));transition:transform .25s ease;max-height:70vh;flex-direction:column;overflow:hidden}.pv-sheet.open{transform:translateY(0)}.pv-overlay{display:block;position:fixed;inset:0;z-index:45;background:rgba(15,23,42,.25);opacity:0;pointer-events:none}.pv-overlay.open{opacity:1;pointer-events:auto}.pv-mobile-actions{position:absolute;display:none;bottom:max(8px,env(safe-area-inset-bottom));left:8px;right:8px;z-index:30;gap:8px}.pv-mobile-action{height:48px;border:1px solid #dbe2ea;border-radius:14px;background:rgba(255,255,255,.98);box-shadow:0 5px 20px rgba(15,23,42,.16);font-weight:800;color:#243047}.pv-mobile-action.active{background:#172554;color:#fff;border-color:#172554}.pv-canvas>svg{touch-action:none!important}}`}</style>
    <div className="pv">
      <aside className="pv-left">{filterContent}</aside>
      <main className="pv-canvas">
        <div className="pv-toolbar"><button onClick={() => setZoom(z => Math.min(8, +(z * 1.25).toFixed(2)))} style={{ ...btn, padding: 7 }}><Plus size={14} /></button><span style={{ width: 42, textAlign: "center", fontWeight: 800 }}>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(z => Math.max(.2, +(z / 1.25).toFixed(2)))} style={{ ...btn, padding: 7 }}><Minus size={14} /></button><button onClick={fitView} style={btn}>Fit</button><div style={{ width: 1, height: 18, background: "#e2e8f0" }} /><button onClick={() => setLayer("map")} style={{ ...btn, background: layer === "map" ? "#172554" : "#fff", color: layer === "map" ? "#fff" : "#243047" }}>Map</button><button onClick={() => setLayer("drone")} style={{ ...btn, background: layer === "drone" ? "#172554" : "#fff", color: layer === "drone" ? "#fff" : "#243047" }}>Drone</button><span className="pv-hint">Drag to pan · scroll to zoom</span></div>
        <svg ref={svgRef} viewBox={viewBox} preserveAspectRatio="xMidYMid meet" onPointerDown={onPD} onPointerMove={onPM} onPointerUp={onPU} onPointerCancel={onPU} onWheel={onWheel} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} style={{ position:"absolute",inset:0,width:"100%",height:"100%",touchAction:"none",cursor:"grab" }}>
          {droneL.visible && assetUrl("drone") && layer === "drone" && <image href={assetUrl("drone")!} x={droneL.x} y={droneL.y} width={droneL.width} height={droneL.height} opacity={droneL.opacity} preserveAspectRatio="none" pointerEvents="none" />}
          {mapL.visible && assetUrl("map") && layer === "map" && <image href={assetUrl("map")!} x={mapL.x} y={mapL.y} width={mapL.width} height={mapL.height} opacity={mapL.opacity} preserveAspectRatio="none" pointerEvents="none" />}
          {planLots.map(lot => { const q=normalize(parse(lot.points)); const isSel=selected===lot.id; const isFilt=!filteredSet.has(lot.id)&&(filterStatus!=="all"||filterSearch.trim()); const col=sc(lot.status); const c=center(q); const fillColor=isSel?"rgba(255,215,0,.22)":isFilt?"rgba(255,255,255,.06)":"rgba(255,255,255,.18)"; return <g key={lot.id} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();focusLot(lot)}} style={{cursor:"pointer"}} opacity={isFilt?.35:1}><polygon points={stringify(q)} fill={fillColor} stroke={isSel?"rgba(218,165,32,.85)":"transparent"} strokeWidth={isSel?3/zoom:0} />{isSel&&<polygon points={stringify(q)} fill="none" stroke="rgba(255,200,0,.35)" strokeWidth={6/zoom}/>} {!isFilt&&!isSel&&<circle cx={c.x} cy={c.y} r={Math.max(4,Math.min(10,60/zoom))} fill={col.dot} opacity={.85}/>} {isSel&&<circle cx={c.x} cy={c.y} r={Math.max(4,Math.min(10,60/zoom))*1.3} fill="rgba(255,215,0,.9)" stroke="rgba(218,165,32,1)" strokeWidth={1.5/zoom}/>} {renderAnnotations(q,lot,zoom,isSel)}</g> })}
        </svg>
        {!assetUrl("map")&&!assetUrl("drone")&&<div style={{position:"absolute",inset:0,display:"grid",placeItems:"center",color:"#64748b",pointerEvents:"none"}}>No site plan image yet.</div>}
        <div className="pv-mobile-actions">
          <button className={`pv-mobile-action${filterStatus !== "all" || filterSearch ? " active" : ""}`} onClick={() => setSheet(s => s === "none" ? "filter" as any : "none")}>☰ Filters</button>
          <button className={`pv-mobile-action${ownerSummary.length ? "" : ""}`} onClick={() => setSheet(s => s === "none" ? "summary" as any : "none")}>▤ Summary</button>
        </div>
      </main>
      <aside className="pv-right">{detailContent}</aside>
    </div>
    <div className={`pv-overlay${sheet !== "none" ? " open" : ""}`} onClick={() => setSheet("none")} />
    <div className={`pv-sheet${(sheet as string) === "filter" ? " open" : ""}`}><div style={{padding:12,fontWeight:900}}>Filters &amp; Find</div><div style={{overflowY:"auto"}}>{filterContent}</div></div>
    <div className={`pv-sheet${(sheet as string) === "summary" ? " open" : ""}`}><div style={{padding:12,fontWeight:900,borderBottom:"1px solid #e2e8f0"}}>Owner Summary</div><div style={{overflowY:"auto"}}>{summaryContent}</div></div>
    <div className={`pv-sheet${sheet === "detail" ? " open" : ""}`}><div style={{padding:12,fontWeight:900}}>Plot Details</div><div style={{overflowY:"auto"}}>{detailContent ?? <div style={{padding:16,color:"#64748b"}}>No plot selected.</div>}</div></div>
  </>;
}
