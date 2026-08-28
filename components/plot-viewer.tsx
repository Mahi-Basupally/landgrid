"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Filter, Minus, Plus, Search, SlidersHorizontal, X } from "lucide-react";

type Point = { x: number; y: number };
type Layer = { x: number; y: number; width: number; height: number; opacity: number; visible: boolean };
type Plan = { id: string; name: string; sortOrder?: number; masterPlanUrl?: string | null; droneUrl?: string | null; points?: string | null; layerGeometry?: any };
type Lot = { id: string; number: string; status: string; owner: string; price: number | string | null; area: number | string | null; areaSqFt: number | null; lengthM: number | null; widthM: number | null; direction: string; notes: string; points: string; labelX: number; labelY: number; sectionId?: string | null };

const DEFAULT_W = 1600, DEFAULT_H = 1000;
const parse = (s: string): Point[] => s.trim().split(/\s+/).filter(Boolean).map(v => v.split(",").map(Number)).filter(v => Number.isFinite(v[0]) && Number.isFinite(v[1])).map(([x, y]) => ({ x, y }));
const stringify = (p: Point[]) => p.map(v => `${Math.round(v.x)},${Math.round(v.y)}`).join(" ");
const center = (p: Point[]) => p.length ? { x: p.reduce((a, v) => a + v.x, 0) / p.length, y: p.reduce((a, v) => a + v.y, 0) / p.length } : { x: DEFAULT_W / 2, y: DEFAULT_H / 2 };
const normalize = (p: Point[]) => p.length >= 3 ? p : [{ x: 600, y: 400 }, { x: 800, y: 400 }, { x: 800, y: 520 }, { x: 600, y: 520 }];
const edgeLenM = (a: Point, b: Point) => Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);

const STATUS_COLORS: Record<string, { fill: string; stroke: string; label: string }> = {
  available: { fill: "rgba(34,197,94,.18)",   stroke: "#16a34a", label: "Available" },
  reserved:  { fill: "rgba(234,179,8,.22)",   stroke: "#ca8a04", label: "Reserved"  },
  sold:      { fill: "rgba(239,68,68,.22)",   stroke: "#dc2626", label: "Sold"      },
  hold:      { fill: "rgba(148,163,184,.22)", stroke: "#64748b", label: "Hold"      },
};
function statusColor(s: string) { return STATUS_COLORS[s] ?? { fill: "rgba(37,99,235,.14)", stroke: "#334155", label: s }; }

export default function PlotViewer({ projectSlug }: { projectSlug: string }) {
  const [canvasW, setCanvasW] = useState(DEFAULT_W), [canvasH, setCanvasH] = useState(DEFAULT_H);
  const W = canvasW, H = canvasH;
  const [plans, setPlans] = useState<Plan[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [planId, setPlanId] = useState("master_plan");
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{ start: { x: number; y: number }; panStart: { x: number; y: number } } | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSearch, setFilterSearch] = useState("");
  const [view, setView] = useState<"map" | "drone">("map");
  const [mapLayer,   setMapLayer]   = useState<Layer>({ x: 0, y: 0, width: DEFAULT_W, height: DEFAULT_H, opacity: 1, visible: true });
  const [droneLayer, setDroneLayer] = useState<Layer>({ x: 0, y: 0, width: DEFAULT_W, height: DEFAULT_H, opacity: 1, visible: true });
  const [viewUnit, setViewUnit] = useState<"m" | "ft" | "yd">("m");
  const [loading, setLoading] = useState(true);
  // Mobile UI state
  const [leftOpen, setLeftOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const viewW = W / zoom, viewH = H / zoom;
  const viewBox = `${pan.x} ${pan.y} ${viewW} ${viewH}`;

  const convertDim = (m: number) => {
    if (viewUnit === "ft") return (m * 3.281).toFixed(2);
    if (viewUnit === "yd") return (m * 1.094).toFixed(2);
    return m.toFixed(2);
  };

  useEffect(() => {
    fetch(`/api/projects/${encodeURIComponent(projectSlug)}/plan`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        if (d.canvasWidth && d.canvasHeight) { setCanvasW(d.canvasWidth); setCanvasH(d.canvasHeight); }
        const masterPlan = (d.sections || []).find((s: any) => s.id === 'master_plan');
        const geom = masterPlan?.layerGeometry;
        const iw = masterPlan?.imageWidth ?? null;
        const ih = masterPlan?.imageHeight ?? null;
        const cw = d.canvasWidth || DEFAULT_W;
        const ch = d.canvasHeight || DEFAULT_H;
        const defaultX = iw ? (cw - iw) / 2 : 0;
        const defaultY = ih ? (ch - ih) / 2 : 0;
        const defaultW2 = iw || cw;
        const defaultH2 = ih || ch;
        if (geom?.map && (geom.map.width || geom.map.height)) setMapLayer(l => ({ ...l, ...geom.map, visible: geom.map.visible !== false }));
        else setMapLayer(l => ({ ...l, x: defaultX, y: defaultY, width: defaultW2, height: defaultH2, visible: true }));
        if (geom?.drone && (geom.drone.width || geom.drone.height)) setDroneLayer(l => ({ ...l, ...geom.drone, visible: geom.drone.visible !== false }));
        else setDroneLayer(l => ({ ...l, x: defaultX, y: defaultY, width: defaultW2, height: defaultH2, visible: true }));
        setPlans(d.sections || []);
        setLots((d.lots || []).map((l: any) => ({
          id: l.id, number: l.number, status: l.status || "available",
          owner: l.owner || "", price: l.price, area: l.area ?? null,
          direction: l.direction || "", notes: l.details || l.model || "",
          areaSqFt: l.areaSqFt ?? null, lengthM: l.lengthM ?? null, widthM: l.widthM ?? null,
          points: l.points || "", labelX: l.labelX || 0, labelY: l.labelY || 0,
          sectionId: l.sectionId || null,
        })));
        const fitZoom = Math.min(1, (window.innerWidth * .6) / cw);
        setZoom(fitZoom);
        setPan({ x: -(window.innerWidth * .2 / fitZoom), y: 0 });
      })
      .finally(() => setLoading(false));
  }, [projectSlug]);

  const master = plans.find(p => p.id === "master_plan") || plans[0];
  const sectionList = useMemo(() => plans.filter(p => p.id !== "master_plan"), [plans]);

  const assetUrl = (kind: "map" | "drone") => {
    const url = kind === "map" ? master?.masterPlanUrl : master?.droneUrl;
    if (!url) return null;
    return `/api/projects/${encodeURIComponent(projectSlug)}/assets/file?kind=${kind === "map" ? "master-plan" : "drone"}&planType=master_plan&v=${encodeURIComponent(url)}`;
  };

  const planLots = useMemo(() =>
    planId === "master_plan" ? lots : lots.filter(l => l.sectionId === planId),
    [lots, planId]);

  const filteredLots = useMemo(() => planLots.filter(l => {
    if (filterStatus !== "all" && l.status !== filterStatus) return false;
    if (filterSearch.trim()) {
      const q = filterSearch.toLowerCase();
      return l.number.toLowerCase().includes(q) || (l.owner || "").toLowerCase().includes(q);
    }
    return true;
  }), [planLots, filterStatus, filterSearch]);

  const filteredIds = useMemo(() => new Set(filteredLots.map(l => l.id)), [filteredLots]);
  const selectedLot = lots.find(l => l.id === selected) ?? null;

  function zoomIn()  { setZoom(z => Math.min(8, +(z * 1.25).toFixed(2))); }
  function zoomOut() { setZoom(z => Math.max(.25, +(z / 1.25).toFixed(2))); }
  function resetView() { setZoom(1); setPan({ x: 0, y: 0 }); }

  function toSVG(e: React.PointerEvent) {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: pan.x + ((e.clientX - r.left) / r.width) * viewW, y: pan.y + ((e.clientY - r.top) / r.height) * viewH };
  }
  function onPointerDown(e: React.PointerEvent) { if (e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); setDrag({ start: { x: e.clientX, y: e.clientY }, panStart: { ...pan } }); }
  function onPointerMove(e: React.PointerEvent) { if (!drag) return; const r = svgRef.current!.getBoundingClientRect(); setPan({ x: drag.panStart.x - (e.clientX - drag.start.x) * viewW / (r.width || 1), y: drag.panStart.y - (e.clientY - drag.start.y) * viewH / (r.height || 1) }); }
  function onPointerUp() { setDrag(null); }

  function focusLot(lot: Lot) {
    const q = normalize(parse(lot.points));
    const c = center(q);
    setSelected(lot.id);
    setPlanId(lot.sectionId || "master_plan");
    setZoom(1.5);
    setPan({ x: c.x - W / 2, y: c.y - H / 2 });
    setDetailOpen(true);
    setLeftOpen(false);
  }

  function renderLotAnnotations(q: Point[], lot: Lot, z: number, isSelected: boolean) {
    const c = center(q);
    const sqYd = lot.area != null ? Number(lot.area) : null;
    const lm = lot.lengthM, wm = lot.widthM;
    const edges = q.map((pt, i) => { const next = q[(i + 1) % q.length]; return { len: edgeLenM(pt, next), mx: (pt.x + next.x) / 2, my: (pt.y + next.y) / 2, angle: Math.atan2(next.y - pt.y, next.x - pt.x) * 180 / Math.PI }; });
    const hEdges = edges.filter(e => { const a = Math.abs(e.angle % 180); return a < 45 || a > 135; }).sort((a, b) => b.len - a.len);
    const vEdges = edges.filter(e => { const a = Math.abs(e.angle % 180); return a >= 45 && a <= 135; }).sort((a, b) => b.len - a.len);
    const sorted = [hEdges[0], vEdges[0]].filter(Boolean);
    const fs = 16 / z, offset = 28 / z;
    const dimStr = (m: number) => viewUnit === "ft" ? `${(m * 3.281).toFixed(1)}ft` : viewUnit === "yd" ? `${(m * 1.094).toFixed(1)}yd` : `${m.toFixed(1)}m`;
    return <>
      <text x={c.x} y={isSelected && sqYd != null ? c.y - 18 / z : c.y} textAnchor="middle" dominantBaseline="middle" fontSize={22 / z} fontWeight={900} pointerEvents="none" fill="#172033" paintOrder="stroke" stroke="white" strokeWidth={5 / z}>{lot.number}</text>
      {isSelected && sqYd != null && <text x={c.x} y={c.y + 16 / z} textAnchor="middle" dominantBaseline="middle" fontSize={14 / z} fontWeight={700} pointerEvents="none" fill="#475569" paintOrder="stroke" stroke="white" strokeWidth={3 / z}>{sqYd} sq.yd</text>}
      {isSelected && (lm || wm) && sorted.map((e, i) => {
        if (i >= 2) return null;
        const absAngle = Math.abs(e.angle % 180);
        const isHorizontal = absAngle < 45 || absAngle > 135;
        const storedDim = lm && wm ? (isHorizontal ? lm : wm) : (lm || wm || null);
        const label = storedDim ? dimStr(storedDim) : null;
        if (!label) return null;
        const perpAngle = e.angle + 90;
        const cosP = Math.cos(perpAngle * Math.PI / 180), sinP = Math.sin(perpAngle * Math.PI / 180);
        const toCenter = { x: c.x - e.mx, y: c.y - e.my };
        const dot = cosP * toCenter.x + sinP * toCenter.y;
        const sign = dot > 0 ? -1 : 1;
        const px = e.mx + cosP * offset * sign;
        const py = e.my + sinP * offset * sign;
        let rot = e.angle; if (rot > 90) rot -= 180; if (rot < -90) rot += 180;
        return <text key={i} x={px} y={py} textAnchor="middle" dominantBaseline="middle" fontSize={fs} fontWeight={400} pointerEvents="none" fill="#1e40af" paintOrder="stroke" stroke="rgba(255,255,255,.95)" strokeWidth={3 / z} transform={`rotate(${rot},${px},${py})`}>{label}</text>;
      })}
    </>;
  }

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: planLots.length };
    for (const l of planLots) counts[l.status] = (counts[l.status] || 0) + 1;
    return counts;
  }, [planLots]);

  const btn: React.CSSProperties = { border: "1px solid #dbe2ea", background: "#fff", color: "#243047", borderRadius: 8, padding: "8px 10px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" };

  if (loading) return <div style={{ height: "100%", display: "grid", placeItems: "center", color: "#64748b", fontSize: 14 }}>Loading plan…</div>;

  const leftPanel = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Plan switcher */}
      <div style={{ padding: 12, borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
        <div style={{ fontSize: 10, letterSpacing: 1, fontWeight: 900, color: "#7b8798", marginBottom: 7 }}>PLAN</div>
        <button onClick={() => setPlanId("master_plan")} style={{ ...btn, width: "100%", justifyContent: "flex-start", marginBottom: 5, background: planId === "master_plan" ? "#eef2ff" : "#fff", borderColor: planId === "master_plan" ? "#c7d2fe" : "#e2e8f0" }}>▦ Master Plan</button>
        {sectionList.map(s => <button key={s.id} onClick={() => setPlanId(s.id)} style={{ ...btn, width: "100%", justifyContent: "flex-start", marginBottom: 4, background: planId === s.id ? "#eef2ff" : "#fff", borderColor: planId === s.id ? "#c7d2fe" : "#e2e8f0" }}>{s.name}</button>)}
      </div>
      {/* Status filter */}
      <div style={{ padding: 12, borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
        <div style={{ fontSize: 10, letterSpacing: 1, fontWeight: 900, color: "#7b8798", marginBottom: 7 }}>STATUS</div>
        {[["all", "All"], ...Object.keys(STATUS_COLORS).map(k => [k, STATUS_COLORS[k].label])].map(([key, label]) => (
          <button key={key} onClick={() => { setFilterStatus(key); setLeftOpen(false); }} style={{ ...btn, width: "100%", justifyContent: "space-between", marginBottom: 4, background: filterStatus === key ? "#172554" : "#fff", color: filterStatus === key ? "#fff" : "#243047", borderColor: filterStatus === key ? "#172554" : "#e2e8f0" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              {key !== "all" && <span style={{ width: 10, height: 10, borderRadius: 3, background: STATUS_COLORS[key]?.stroke, flexShrink: 0 }} />}
              {label}
            </span>
            <span style={{ fontSize: 11, opacity: .7 }}>{statusCounts[key] ?? 0}</span>
          </button>
        ))}
      </div>
      {/* Search */}
      <div style={{ padding: 12, borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
        <div style={{ position: "relative" }}>
          <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input value={filterSearch} onChange={e => setFilterSearch(e.target.value)} placeholder="Search plot or owner…" style={{ width: "100%", boxSizing: "border-box", paddingLeft: 28, paddingRight: filterSearch ? 28 : 10, paddingTop: 8, paddingBottom: 8, border: "1px solid #dbe2ea", borderRadius: 8, fontSize: 12, outline: "none" }} />
          {filterSearch && <button onClick={() => setFilterSearch("")} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 2 }}><X size={12} /></button>}
        </div>
      </div>
      {/* Plot list */}
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
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label}{lot.area != null ? ` · ${lot.area} sq.yd` : ""}</div>
                  </div>
                </button>
              );
            })
        }
      </div>
    </div>
  );

  const detailPanel = selectedLot ? (() => {
    const col = statusColor(selectedLot.status);
    return (
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <div style={{ fontSize: 10, letterSpacing: 1, fontWeight: 900, color: "#64748b" }}>PLOT DETAILS</div>
              <select value={viewUnit} onChange={e => setViewUnit(e.target.value as "m" | "ft" | "yd")} style={{ fontSize: 11, fontWeight: 700, border: "1px solid #e2e8f0", borderRadius: 6, padding: "2px 6px", background: "#f8fafc", cursor: "pointer" }}>
                <option value="m">Meters</option><option value="ft">Feet</option><option value="yd">Yards</option>
              </select>
            </div>
            <h3 style={{ margin: "4px 0 0", fontSize: 22, letterSpacing: "-.02em" }}>Plot {selectedLot.number}</h3>
          </div>
          <button onClick={() => { setSelected(null); setDetailOpen(false); }} style={{ ...btn, padding: 6, marginTop: 2 }}><X size={14} /></button>
        </div>
        <div style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 999, background: col.fill, border: `1px solid ${col.stroke}`, fontWeight: 800, fontSize: 12, color: col.stroke }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: col.stroke }} />{col.label}
        </div>
        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          {(selectedLot.lengthM || selectedLot.widthM || selectedLot.area) && (
            <div style={{ padding: "10px 12px", borderRadius: 8, background: "#f0f9ff", border: "1px solid #bae6fd" }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: "#0369a1", marginBottom: 6, letterSpacing: .7 }}>DIMENSIONS & AREA</div>
              {selectedLot.lengthM && selectedLot.widthM && <div style={{ fontSize: 13, color: "#334155", marginBottom: 4 }}>{convertDim(selectedLot.lengthM)}{viewUnit} × {convertDim(selectedLot.widthM)}{viewUnit} = <b>{+(selectedLot.lengthM * selectedLot.widthM).toFixed(2)} sq.m</b></div>}
              {selectedLot.area != null && <div style={{ fontSize: 15, fontWeight: 900, color: "#172554" }}>{selectedLot.area} sq.yd{selectedLot.areaSqFt != null && <span style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginLeft: 8 }}>· {selectedLot.areaSqFt} sq.ft</span>}</div>}
              {selectedLot.lengthM && selectedLot.widthM && <div style={{ fontSize: 10, color: "#64748b", marginTop: 5 }}>sq.yd = sq.m × 1.196 · sq.ft = sq.m × 10.764</div>}
            </div>
          )}
          {[["Price", selectedLot.price != null ? `₹ ${selectedLot.price}` : null], ["Direction", selectedLot.direction || null], ["Owner", selectedLot.owner || null], ["Notes", selectedLot.notes || null]].filter(([, v]) => v).map(([label, value]) => (
            <div key={label as string}>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: .7, color: "#94a3b8", marginBottom: 3 }}>{label as string}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#172033" }}>{value as string}</div>
            </div>
          ))}
          {selectedLot.sectionId && <div><div style={{ fontSize: 10, fontWeight: 900, letterSpacing: .7, color: "#94a3b8", marginBottom: 3 }}>SECTION</div><div style={{ fontSize: 14, fontWeight: 700, color: "#172033" }}>{plans.find(p => p.id === selectedLot.sectionId)?.name || selectedLot.sectionId}</div></div>}
        </div>
        <div style={{ marginTop: 24, padding: 14, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1, color: "#94a3b8", marginBottom: 10 }}>LEGEND</div>
          {Object.entries(STATUS_COLORS).map(([key, c]) => <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><span style={{ width: 14, height: 14, borderRadius: 3, background: c.fill, border: `2px solid ${c.stroke}`, flexShrink: 0 }} /><span style={{ fontSize: 12, fontWeight: 700 }}>{c.label}</span></div>)}
        </div>
      </div>
    );
  })() : (
    <div style={{ padding: 16 }}>
      <div style={{ padding: "24px 4px", color: "#64748b", textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>🗺</div>
        <div style={{ fontWeight: 800, color: "#334155", marginBottom: 6 }}>Click a plot to view details</div>
        <div style={{ fontSize: 12, lineHeight: 1.6 }}>Use the filters on the left to find available plots by status or search by number.</div>
      </div>
      <div style={{ padding: 14, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1, color: "#94a3b8", marginBottom: 10 }}>LEGEND</div>
        {Object.entries(STATUS_COLORS).map(([key, c]) => <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><span style={{ width: 14, height: 14, borderRadius: 3, background: c.fill, border: `2px solid ${c.stroke}`, flexShrink: 0 }} /><span style={{ fontSize: 12, fontWeight: 700 }}>{c.label}</span></div>)}
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        .pv-shell { height: 100%; display: grid; grid-template-columns: 260px minmax(0,1fr) 300px; background: #f4f6f9; font-family: Inter,ui-sans-serif,system-ui,sans-serif; font-size: 13px; color: #182235; }
        .pv-left { background: #fff; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; overflow: hidden; }
        .pv-right { background: #fff; border-left: 1px solid #e2e8f0; overflow-y: auto; }
        .pv-hint { display: inline; }
        .pv-mobile-bar { display: none; }
        .pv-bottom-sheet { display: none; }
        .pv-overlay { display: none; }
        @media (max-width: 767px) {
          .pv-shell { grid-template-columns: minmax(0,1fr); grid-template-rows: 1fr; }
          .pv-left { display: none; }
          .pv-right { display: none; }
          .pv-hint { display: none; }
          .pv-mobile-bar { display: flex; position: absolute; bottom: 0; left: 0; right: 0; z-index: 20; background: rgba(255,255,255,.97); border-top: 1px solid #e2e8f0; padding: 8px 10px; gap: 8px; align-items: center; box-shadow: 0 -4px 16px rgba(15,23,42,.08); }
          .pv-bottom-sheet { display: block; position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; background: #fff; border-radius: 18px 18px 0 0; box-shadow: 0 -8px 32px rgba(15,23,42,.18); max-height: 75vh; overflow-y: auto; transform: translateY(100%); transition: transform .28s cubic-bezier(.4,0,.2,1); }
          .pv-bottom-sheet.open { transform: translateY(0); }
          .pv-bottom-sheet-handle { width: 36px; height: 4px; background: #cbd5e1; border-radius: 2px; margin: 10px auto 6px; }
          .pv-overlay { display: block; position: fixed; inset: 0; z-index: 35; background: rgba(15,23,42,.32); opacity: 0; pointer-events: none; transition: opacity .25s; }
          .pv-overlay.open { opacity: 1; pointer-events: auto; }
        }
      `}</style>

      <div className="pv-shell">
        {/* ── DESKTOP LEFT ── */}
        <aside className="pv-left">{leftPanel}</aside>

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
            <span className="pv-hint" style={{ marginLeft: "auto", fontSize: 11, color: "#64748b" }}>Drag to pan · scroll to zoom</span>
          </div>

          {/* SVG canvas */}
          <svg ref={svgRef} viewBox={viewBox} preserveAspectRatio="xMinYMin meet"
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
            onPointerCancel={() => setDrag(null)}
            onWheel={e => { e.preventDefault(); const delta = e.deltaY > 0 ? 1/1.15 : 1.15; setZoom(z => Math.min(8, Math.max(.25, +(z * delta).toFixed(2)))); }}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none", cursor: drag ? "grabbing" : "grab" }}>
            {droneLayer.visible && assetUrl("drone") && <image href={assetUrl("drone")!} x={droneLayer.x} y={droneLayer.y} width={droneLayer.width} height={droneLayer.height} opacity={droneLayer.opacity} preserveAspectRatio="none" pointerEvents="none" />}
            {mapLayer.visible && assetUrl("map") && <image href={assetUrl("map")!} x={mapLayer.x} y={mapLayer.y} width={mapLayer.width} height={mapLayer.height} opacity={mapLayer.opacity} preserveAspectRatio="none" pointerEvents="none" />}
            {planLots.map(lot => {
              const q = normalize(parse(lot.points));
              const isSelected = selected === lot.id;
              const isFiltered = !filteredIds.has(lot.id) && (filterStatus !== "all" || filterSearch.trim());
              const col = statusColor(lot.status);
              return (
                <g key={lot.id} onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); focusLot(lot); }} style={{ cursor: "pointer" }}>
                  <polygon points={stringify(q)} fill={isSelected ? col.fill.replace(/[\d.]+\)$/, ".45)") : isFiltered ? "rgba(203,213,225,.15)" : col.fill} stroke={isSelected ? col.stroke : isFiltered ? "#cbd5e1" : col.stroke} strokeWidth={isSelected ? 4 : 2} opacity={isFiltered ? .35 : 1} />
                  {renderLotAnnotations(q, lot, zoom, isSelected)}
                </g>
              );
            })}
          </svg>
          {!assetUrl("map") && !assetUrl("drone") && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#64748b", pointerEvents: "none", fontSize: 13 }}>No site plan image uploaded yet.</div>}

          {/* Mobile bottom bar */}
          <div className="pv-mobile-bar" style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}>
            <button onClick={() => { setLeftOpen(v => !v); setDetailOpen(false); }} style={{ ...btn, flex: 1, justifyContent: "center" }}>
              <Filter size={14} /> Filters {filterStatus !== "all" ? `· ${filterStatus}` : ""}
            </button>
            <button onClick={zoomIn}  style={{ ...btn, padding: 10 }}><Plus  size={14} /></button>
            <button onClick={zoomOut} style={{ ...btn, padding: 10 }}><Minus size={14} /></button>
            <button onClick={resetView} style={btn}>Fit</button>
            {selectedLot && (
              <button onClick={() => setDetailOpen(v => !v)} style={{ ...btn, flex: 1, justifyContent: "center", background: "#172554", color: "#fff", borderColor: "#172554" }}>
                Plot {selectedLot.number} {detailOpen ? <ChevronDown size={13}/> : <ChevronUp size={13}/>}
              </button>
            )}
          </div>
        </main>

        {/* ── DESKTOP RIGHT ── */}
        <aside className="pv-right">{detailPanel}</aside>
      </div>

      {/* Mobile overlay */}
      <div className={`pv-overlay${leftOpen || detailOpen ? " open" : ""}`} onClick={() => { setLeftOpen(false); setDetailOpen(false); }} />

      {/* Mobile left drawer */}
      <div className={`pv-bottom-sheet${leftOpen ? " open" : ""}`} style={{ maxHeight: "80vh" }}>
        <div className="pv-bottom-sheet-handle" />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px 8px" }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>Filter & Search</div>
          <button onClick={() => setLeftOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 4 }}><X size={18} /></button>
        </div>
        {leftPanel}
      </div>

      {/* Mobile detail sheet */}
      <div className={`pv-bottom-sheet${detailOpen && selectedLot ? " open" : ""}`}>
        <div className="pv-bottom-sheet-handle" />
        {detailPanel}
      </div>
    </>
  );
}
