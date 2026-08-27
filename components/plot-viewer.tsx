"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Search, X } from "lucide-react";

type Point = { x: number; y: number };
type Layer = { x: number; y: number; width: number; height: number; opacity: number; visible: boolean };
type Plan = { id: string; name: string; sortOrder?: number; masterPlanUrl?: string | null; droneUrl?: string | null; points?: string | null; layerGeometry?: any };
type Lot = { id: string; number: string; status: string; owner: string; price: number | string | null; area: number | string | null; areaSqFt: number | null; lengthM: number | null; widthM: number | null; direction: string; notes: string; points: string; labelX: number; labelY: number; sectionId?: string | null };

const DEFAULT_W = 1600, DEFAULT_H = 1000;
const parse = (s: string): Point[] => s.trim().split(/\s+/).filter(Boolean).map(v => v.split(",").map(Number)).filter(v => Number.isFinite(v[0]) && Number.isFinite(v[1])).map(([x, y]) => ({ x, y }));
const stringify = (p: Point[]) => p.map(v => `${Math.round(v.x)},${Math.round(v.y)}`).join(" ");
const center = (p: Point[]) => p.length ? { x: p.reduce((a, v) => a + v.x, 0) / p.length, y: p.reduce((a, v) => a + v.y, 0) / p.length } : { x: DEFAULT_W / 2, y: DEFAULT_H / 2 };
const normalize = (p: Point[]) => p.length >= 3 ? p : [{ x: 600, y: 400 }, { x: 800, y: 400 }, { x: 800, y: 520 }, { x: 600, y: 520 }];

const STATUS_COLORS: Record<string, { fill: string; stroke: string; label: string }> = {
  available: { fill: "rgba(34,197,94,.18)",  stroke: "#16a34a", label: "Available" },
  reserved:  { fill: "rgba(234,179,8,.22)",  stroke: "#ca8a04", label: "Reserved"  },
  sold:      { fill: "rgba(239,68,68,.22)",  stroke: "#dc2626", label: "Sold"      },
  hold:      { fill: "rgba(148,163,184,.22)",stroke: "#64748b", label: "Hold"      },
};

function statusColor(status: string) {
  return STATUS_COLORS[status] ?? { fill: "rgba(37,99,235,.14)", stroke: "#334155", label: status };
}

export default function PlotViewer({ projectSlug }: { projectSlug: string }) {
  const [canvasW, setCanvasW] = useState(DEFAULT_W), [canvasH, setCanvasH] = useState(DEFAULT_H);
  const W = canvasW, H = canvasH;
  const [mapLayer,   setMapLayer]   = useState<Layer>({ x: 0, y: 0, width: DEFAULT_W, height: DEFAULT_H, opacity: 1, visible: true });
  const [droneLayer, setDroneLayer] = useState<Layer>({ x: 0, y: 0, width: DEFAULT_W, height: DEFAULT_H, opacity: 1, visible: true });
  const [plans, setPlans] = useState<Plan[]>([]);
  const [lots,  setLots]  = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [planId, setPlanId] = useState("master_plan");
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{ start: Point; panStart: Point } | null>(null);
  const [view, setView] = useState<"map" | "drone">("map");

  // filters
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSearch, setFilterSearch] = useState("");
  const [viewUnit, setViewUnit] = useState<"m"|"ft"|"yd">("m");

  const svgRef = useRef<SVGSVGElement | null>(null);
  function convertDim(m: number) {
    if (viewUnit === "ft") return +(m * 3.28084).toFixed(2);
    if (viewUnit === "yd") return +(m * 1.09361).toFixed(2);
    return +m.toFixed(2);
  }
  function dimStr(m: number | null) { if (!m) return ""; if (viewUnit === "ft") return `${+(m * 3.28084).toFixed(1)}ft`; if (viewUnit === "yd") return `${+(m * 1.09361).toFixed(1)}yd`; return `${+m.toFixed(2)}m`; }
  function edgeLenM(a: {x:number;y:number}, b: {x:number;y:number}) { return Math.sqrt((b.x-a.x)**2+(b.y-a.y)**2); }
  function renderLotAnnotations(q: {x:number;y:number}[], lot: Lot, z: number, isSelected: boolean) {
    const c = { x: q.reduce((s,p)=>s+p.x,0)/q.length, y: q.reduce((s,p)=>s+p.y,0)/q.length };
    const sqYd = lot.area != null ? Number(lot.area) : null;
    const lm = lot.lengthM, wm = lot.widthM;
    const edges = q.map((pt, i) => { const next = q[(i+1)%q.length]; return { a: pt, b: next, len: edgeLenM(pt, next), mx: (pt.x+next.x)/2, my: (pt.y+next.y)/2, angle: Math.atan2(next.y-pt.y, next.x-pt.x)*180/Math.PI }; });
    const sorted = [...edges].sort((a,b) => b.len-a.len).slice(0,4);
    const fs = 16/z, offset = 20/z;
    return <>
      <text x={c.x} y={isSelected && sqYd!=null ? c.y - 16/z : c.y} textAnchor="middle" dominantBaseline="middle" fontSize={20/z} fontWeight={900} pointerEvents="none" fill="#172033" paintOrder="stroke" stroke="white" strokeWidth={4/z}>{lot.number}</text>
      {isSelected && sqYd!=null && <text x={c.x} y={c.y+13/z} textAnchor="middle" dominantBaseline="middle" fontSize={13/z} fontWeight={700} pointerEvents="none" fill="#475569" paintOrder="stroke" stroke="white" strokeWidth={3/z}>{sqYd} sq.yd</text>}
      {isSelected && (lm||wm) && sorted.map((e,i) => {
        const perpAngle = e.angle+90;
        const px2 = e.mx+Math.cos(perpAngle*Math.PI/180)*offset, py2 = e.my+Math.sin(perpAngle*Math.PI/180)*offset;
        const px = i%2===0?px2:e.mx-Math.cos(perpAngle*Math.PI/180)*offset;
        const py = i%2===0?py2:e.my-Math.sin(perpAngle*Math.PI/180)*offset;
        const storedDim = i<2 ? (i===0?(lm&&wm?Math.max(lm,wm):null):(lm&&wm?Math.min(lm,wm):null)) : null;
        const label = storedDim ? dimStr(storedDim) : null;
        if (!label) return null;
        let rot = e.angle; if (rot>90) rot-=180; if (rot<-90) rot+=180;
        return <text key={i} x={px} y={py} textAnchor="middle" dominantBaseline="middle" fontSize={fs} fontWeight={800} pointerEvents="none" fill="#1e40af" paintOrder="stroke" stroke="rgba(255,255,255,.95)" strokeWidth={3/z} transform={`rotate(${rot},${px},${py})`}>{label}</text>;
      })}
    </>;
  }

  const master = plans.find(p => p.id === "master_plan") || plans[0];
  const sectionList = useMemo(() => plans.filter(p => p.id !== "master_plan"), [plans]);
  const selectedLot = lots.find(l => l.id === selected) ?? null;

  const viewW = W / zoom, viewH = H / zoom;
  const viewBox = `${(W - viewW) / 2 + pan.x} ${(H - viewH) / 2 + pan.y} ${viewW} ${viewH}`;

  const btn: React.CSSProperties = { border: "1px solid #dbe2ea", background: "#fff", color: "#243047", borderRadius: 8, padding: "8px 10px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" };

  useEffect(() => {
    fetch(`/api/projects/${encodeURIComponent(projectSlug)}/plan`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        if (d.canvasWidth && d.canvasHeight) {
          setCanvasW(d.canvasWidth);
          setCanvasH(d.canvasHeight);
        }
        const masterPlan = (d.sections || []).find((s: any) => s.id === 'master_plan');
        const geom = masterPlan?.layerGeometry;
        const iw = masterPlan?.imageWidth ?? null;
        const ih = masterPlan?.imageHeight ?? null;
        const cw = d.canvasWidth || DEFAULT_W;
        const ch = d.canvasHeight || DEFAULT_H;
        // Editor places image at: x = (W - imageW) / 2, y = (H - imageH) / 2
        const defaultX = iw ? (cw - iw) / 2 : 0;
        const defaultY = ih ? (ch - ih) / 2 : 0;
        const defaultW = iw || cw;
        const defaultH = ih || ch;
        if (geom?.map && (geom.map.width || geom.map.height)) {
          setMapLayer(l => ({ ...l, ...geom.map, visible: geom.map.visible !== false }));
        } else {
          setMapLayer(l => ({ ...l, x: defaultX, y: defaultY, width: defaultW, height: defaultH, visible: true }));
        }
        if (geom?.drone && (geom.drone.width || geom.drone.height)) {
          setDroneLayer(l => ({ ...l, ...geom.drone, visible: geom.drone.visible !== false }));
        } else {
          setDroneLayer(l => ({ ...l, x: defaultX, y: defaultY, width: defaultW, height: defaultH, visible: true }));
        }
        setPlans(d.sections || []);
        setLots((d.lots || []).map((l: any) => ({
          id: l.id, number: l.number, status: l.status || "available",
          owner: l.owner || "", price: l.price, area: l.area ?? null,
          direction: l.direction || "", notes: l.details || l.model || "", areaSqFt: l.areaSqFt ?? null, lengthM: l.lengthM ?? null, widthM: l.widthM ?? null,
          points: typeof l.points === "string" ? l.points : "",
          labelX: Number(l.labelX || 0), labelY: Number(l.labelY || 0),
          sectionId: l.sectionId || null,
        })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectSlug]);

  const assetUrl = (kind: "map" | "drone") => {
    const url = kind === "map" ? master?.masterPlanUrl : master?.droneUrl;
    if (!url) return null;
    return `/api/projects/${encodeURIComponent(projectSlug)}/assets/file?kind=${kind === "map" ? "master-plan" : "drone"}&planType=master_plan&v=${encodeURIComponent(url)}`;
  };

  const planLots = useMemo(() =>
    planId === "master_plan" ? lots : lots.filter(l => l.sectionId === planId),
    [lots, planId]);

  const filteredLots = useMemo(() => {
    let l = planLots;
    if (filterStatus !== "all") l = l.filter(p => p.status === filterStatus);
    if (filterSearch.trim()) l = l.filter(p => p.number.toLowerCase().includes(filterSearch.trim().toLowerCase()) || p.owner.toLowerCase().includes(filterSearch.trim().toLowerCase()));
    return l;
  }, [planLots, filterStatus, filterSearch]);

  const filteredIds = useMemo(() => new Set(filteredLots.map(l => l.id)), [filteredLots]);

  function pointFromEvent(e: React.PointerEvent<SVGSVGElement>): Point {
    const svg = svgRef.current; if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect(), v = svg.viewBox.baseVal;
    return { x: v.x + ((e.clientX - r.left) / r.width) * v.width, y: v.y + ((e.clientY - r.top) / r.height) * v.height };
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return;
    setDrag({ start: { x: e.clientX, y: e.clientY }, panStart: { ...pan } });
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    if (!drag) return;
    const dx = e.clientX - drag.start.x, dy = e.clientY - drag.start.y;
    if (Math.abs(dx) < 4 && Math.abs(dy) < 4) setSelected(null); // tap on canvas = deselect
    setDrag(null);
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!drag) return;
    setPan({ x: drag.panStart.x - (e.clientX - drag.start.x) * viewW / (svgRef.current?.getBoundingClientRect().width || 1), y: drag.panStart.y - (e.clientY - drag.start.y) * viewH / (svgRef.current?.getBoundingClientRect().height || 1) });
  }

  function zoomIn()  { setZoom(z => Math.min(8, +(z * 1.25).toFixed(2))); }
  function zoomOut() { setZoom(z => Math.max(.25, +(z / 1.25).toFixed(2))); }
  function resetView() { setZoom(1); setPan({ x: 0, y: 0 }); }

  function focusLot(lot: Lot) {
    const q = normalize(parse(lot.points));
    const c = center(q);
    const pts = q;
    const minX = Math.min(...pts.map(p=>p.x)), maxX = Math.max(...pts.map(p=>p.x));
    const minY = Math.min(...pts.map(p=>p.y)), maxY = Math.max(...pts.map(p=>p.y));
    const targetZoom = Math.min(6, Math.max(1.5, Math.min(W/(Math.max(1,maxX-minX)*2), H/(Math.max(1,maxY-minY)*2))));
    setSelected(lot.id);
    setPlanId(lot.sectionId || "master_plan");
    setZoom(targetZoom);
    setPan({ x: c.x - W / 2, y: c.y - H / 2 });
  }

  // Status counts for filter bar
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: planLots.length };
    for (const l of planLots) counts[l.status] = (counts[l.status] || 0) + 1;
    return counts;
  }, [planLots]);

  if (loading) return <div style={{ height: "100%", display: "grid", placeItems: "center", color: "#64748b", fontSize: 14 }}>Loading plan…</div>;

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateColumns: "260px minmax(0,1fr) 300px", background: "#f4f6f9", fontFamily: "Inter,ui-sans-serif,system-ui,sans-serif", fontSize: 13, color: "#182235" }}>

      {/* ── LEFT SIDEBAR ── */}
      <aside style={{ background: "#fff", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Plan switcher */}
        <div style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 10, letterSpacing: 1, fontWeight: 900, color: "#7b8798", marginBottom: 7 }}>PLAN</div>
          <button onClick={() => setPlanId("master_plan")} style={{ ...btn, width: "100%", justifyContent: "flex-start", marginBottom: 5, background: planId === "master_plan" ? "#eef2ff" : "#fff", borderColor: planId === "master_plan" ? "#c7d2fe" : "#e2e8f0" }}>▦ Master Plan</button>
          {sectionList.map(s => (
            <button key={s.id} onClick={() => setPlanId(s.id)} style={{ ...btn, width: "100%", justifyContent: "flex-start", marginBottom: 4, background: planId === s.id ? "#eef2ff" : "#fff", borderColor: planId === s.id ? "#c7d2fe" : "#e2e8f0" }}>{s.name}</button>
          ))}
        </div>

        {/* Status filter */}
        <div style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 10, letterSpacing: 1, fontWeight: 900, color: "#7b8798", marginBottom: 7 }}>STATUS</div>
          {[["all", "All"], ...Object.keys(STATUS_COLORS).map(k => [k, STATUS_COLORS[k].label])].map(([key, label]) => (
            <button key={key} onClick={() => setFilterStatus(key)} style={{ ...btn, width: "100%", justifyContent: "space-between", marginBottom: 4, background: filterStatus === key ? "#172554" : "#fff", color: filterStatus === key ? "#fff" : "#243047", borderColor: filterStatus === key ? "#172554" : "#e2e8f0" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                {key !== "all" && <span style={{ width: 10, height: 10, borderRadius: 3, background: STATUS_COLORS[key]?.stroke, flexShrink: 0 }} />}
                {label}
              </span>
              <span style={{ fontSize: 11, opacity: .7 }}>{statusCounts[key] ?? 0}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ position: "relative" }}>
            <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input value={filterSearch} onChange={e => setFilterSearch(e.target.value)} placeholder="Search plot or owner…" style={{ width: "100%", boxSizing: "border-box", paddingLeft: 28, paddingRight: filterSearch ? 28 : 10, paddingTop: 8, paddingBottom: 8, border: "1px solid #dbe2ea", borderRadius: 8, fontSize: 12, outline: "none" }} />
            {filterSearch && <button onClick={() => setFilterSearch("")} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 2 }}><X size={12} /></button>}
          </div>
        </div>

        {/* Filtered plot list */}
        <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
          {filteredLots.length === 0
            ? <div style={{ padding: 16, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>No plots match filters</div>
            : filteredLots.slice().sort((a, b) => Number(a.number) - Number(b.number)).map(lot => {
                const c = statusColor(lot.status);
                return (
                  <button key={lot.id} onClick={() => focusLot(lot)} style={{ width: "100%", textAlign: "left", padding: "9px 10px", border: `1px solid ${selected === lot.id ? c.stroke : "#e4e9f0"}`, borderRadius: 8, background: selected === lot.id ? c.fill : "#fff", marginBottom: 4, cursor: "pointer", display: "flex", alignItems: "center", gap: 9 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: c.stroke, flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 12 }}>Plot {lot.number}</div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.label}{lot.area != null ? ` · ${lot.area} sq.yd` : ""}
                      </div>
                    </div>
                  </button>
                );
              })
          }
        </div>
      </aside>

      {/* ── CANVAS ── */}
      <main style={{ position: "relative", overflow: "hidden", background: "#d9dee5" }}>
        {/* Toolbar */}
        <div style={{ position: "absolute", top: 12, left: 12, right: 12, zIndex: 5, display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", border: "1px solid rgba(226,232,240,.9)", borderRadius: 10, background: "rgba(255,255,255,.96)", boxShadow: "0 4px 16px rgba(15,23,42,.08)" }}>
          <button onClick={zoomIn}  style={{ ...btn, padding: 7 }}><Plus  size={14} /></button>
          <span style={{ width: 44, textAlign: "center", fontSize: 12, fontWeight: 800 }}>{Math.round(zoom * 100)}%</span>
          <button onClick={zoomOut} style={{ ...btn, padding: 7 }}><Minus size={14} /></button>
          <button onClick={resetView} style={btn}>Fit</button>
          <div style={{ width: 1, height: 20, background: "#e2e8f0", margin: "0 2px" }} />
          <button onClick={() => setView("map")}   style={{ ...btn, background: view === "map"   ? "#172554" : "#fff", color: view === "map"   ? "#fff" : "#243047" }}>Map</button>
          <button onClick={() => setView("drone")} style={{ ...btn, background: view === "drone" ? "#172554" : "#fff", color: view === "drone" ? "#fff" : "#243047" }}>Drone</button>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#64748b" }}>Drag to pan · scroll to zoom</span>
        </div>

        {/* SVG canvas */}
        <svg
          ref={svgRef}
          viewBox={viewBox}
          preserveAspectRatio="xMinYMin meet"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setDrag(null)}
          onWheel={e => { e.preventDefault(); const delta = e.deltaY > 0 ? 1/1.15 : 1.15; setZoom(z => Math.min(8, Math.max(.25, +(z * delta).toFixed(2)))); }}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none", cursor: drag ? "grabbing" : "grab" }}
        >
          {/* Background images — rendered at editor layer coordinates */}
          {droneLayer.visible && assetUrl("drone") && (
            <image href={assetUrl("drone")!} x={droneLayer.x} y={droneLayer.y} width={droneLayer.width} height={droneLayer.height} opacity={droneLayer.opacity} preserveAspectRatio="none" pointerEvents="none" />
          )}
          {mapLayer.visible && assetUrl("map") && (
            <image href={assetUrl("map")!} x={mapLayer.x} y={mapLayer.y} width={mapLayer.width} height={mapLayer.height} opacity={mapLayer.opacity} preserveAspectRatio="none" pointerEvents="none" />
          )}

          {/* Plots */}
          {planLots.map(lot => {
            const q = normalize(parse(lot.points));
            const c = center(q);
            const isSelected = selected === lot.id;
            const isFiltered = !filteredIds.has(lot.id) && (filterStatus !== "all" || filterSearch.trim());
            const col = statusColor(lot.status);
            return (
              <g key={lot.id} onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); focusLot(lot); }} style={{ cursor: "pointer" }}>
                <polygon
                  points={stringify(q)}
                  fill={isSelected ? col.fill.replace(/[\d.]+\)$/, ".45)") : isFiltered ? "rgba(203,213,225,.15)" : col.fill}
                  stroke={isSelected ? col.stroke : isFiltered ? "#cbd5e1" : col.stroke}
                  strokeWidth={isSelected ? 4 : 2}
                  opacity={isFiltered ? .35 : 1}
                />
                {renderLotAnnotations(q, lot, zoom, isSelected)}
              </g>
            );
          })}
        </svg>

        {!assetUrl("map") && !assetUrl("drone") && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#64748b", pointerEvents: "none", fontSize: 13 }}>No site plan image uploaded yet.</div>}
      </main>

      {/* ── RIGHT PANEL ── */}
      <aside style={{ background: "#fff", borderLeft: "1px solid #e2e8f0", overflowY: "auto", padding: 16 }}>
        {selectedLot ? (() => {
          const col = statusColor(selectedLot.status);
          return (
            <div>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 10, letterSpacing: 1, fontWeight: 900, color: "#64748b" }}>PLOT DETAILS</div>
                  <select value={viewUnit} onChange={e => setViewUnit(e.target.value as "m"|"ft"|"yd")} style={{ fontSize: 11, fontWeight: 700, border: "1px solid #e2e8f0", borderRadius: 6, padding: "2px 6px", background: "#f8fafc", cursor: "pointer" }}>
                    <option value="m">Meters</option>
                    <option value="ft">Feet</option>
                    <option value="yd">Yards</option>
                  </select>
                </div>
                  <h3 style={{ margin: "4px 0 0", fontSize: 22, letterSpacing: "-.02em" }}>Plot {selectedLot.number}</h3>
                </div>
                <button onClick={() => setSelected(null)} style={{ ...btn, padding: 6, marginTop: 2 }}><X size={14} /></button>
              </div>

              {/* Status badge */}
              <div style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 999, background: col.fill, border: `1px solid ${col.stroke}`, fontWeight: 800, fontSize: 12, color: col.stroke }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: col.stroke }} />
                {col.label}
              </div>

              {/* Fields */}
              <div style={{ marginTop: 16, display: "grid", gap: 10 }}>

                {/* Dimension + Area calculation card */}
                {(selectedLot.lengthM || selectedLot.widthM || selectedLot.area) && (
                  <div style={{ padding: "10px 12px", borderRadius: 8, background: "#f0f9ff", border: "1px solid #bae6fd" }}>
                    <div style={{ fontSize: 10, fontWeight: 900, color: "#0369a1", marginBottom: 6, letterSpacing: .7 }}>DIMENSIONS & AREA</div>
                    {selectedLot.lengthM && selectedLot.widthM && (
                      <div style={{ fontSize: 13, color: "#334155", marginBottom: 4 }}>
                        {convertDim(selectedLot.lengthM)}{viewUnit} × {convertDim(selectedLot.widthM)}{viewUnit}
                        {" = "}
                        <b>{+(selectedLot.lengthM * selectedLot.widthM).toFixed(2)} sq.m</b>
                      </div>
                    )}
                    {selectedLot.area != null && (
                      <div style={{ fontSize: 15, fontWeight: 900, color: "#172554" }}>
                        {selectedLot.area} sq.yd
                        {selectedLot.areaSqFt != null && (
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginLeft: 8 }}>
                            · {selectedLot.areaSqFt} sq.ft
                          </span>
                        )}
                      </div>
                    )}
                    {selectedLot.lengthM && selectedLot.widthM && (
                      <div style={{ fontSize: 10, color: "#64748b", marginTop: 5 }}>
                        sq.yd = sq.m × 1.196 · sq.ft = sq.m × 10.764
                      </div>
                    )}
                  </div>
                )}

                {[
                  ["Price",     selectedLot.price     != null ? `₹ ${selectedLot.price}` : null],
                  ["Direction", selectedLot.direction || null],
                  ["Owner",     selectedLot.owner     || null],
                  ["Notes",     selectedLot.notes     || null],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <div key={label as string}>
                    <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: .7, color: "#94a3b8", marginBottom: 3 }}>{label as string}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#172033" }}>{value as string}</div>
                  </div>
                ))}
                {selectedLot.sectionId && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: .7, color: "#94a3b8", marginBottom: 3 }}>SECTION</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#172033" }}>{plans.find(p => p.id === selectedLot.sectionId)?.name || selectedLot.sectionId}</div>
                  </div>
                )}
              </div>
            </div>
          );
        })() : (
          <div style={{ padding: "24px 4px", color: "#64748b", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🗺</div>
            <div style={{ fontWeight: 800, color: "#334155", marginBottom: 6 }}>Click a plot to view details</div>
            <div style={{ fontSize: 12, lineHeight: 1.6 }}>Use the filters on the left to find available plots by status or search by number.</div>
          </div>
        )}

        {/* Legend */}
        <div style={{ marginTop: 32, padding: 14, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1, color: "#94a3b8", marginBottom: 10 }}>LEGEND</div>
          {Object.entries(STATUS_COLORS).map(([key, c]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ width: 14, height: 14, borderRadius: 3, background: c.fill, border: `2px solid ${c.stroke}`, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700 }}>{c.label}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
