"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Filter, List, Minus, Plus, Search, X } from "lucide-react";

type Point = { x: number; y: number };
type Layer = { x: number; y: number; width: number; height: number; opacity: number; visible: boolean };
type Plan = { id: string; name: string; masterPlanUrl?: string | null; droneUrl?: string | null; layerGeometry?: any };
type Lot = { id: string; number: string; status: string; owner: string; price: number | string | null; area: number | string | null; areaSqFt: number | null; lengthM: number | null; widthM: number | null; direction: string; notes: string; points: string; sectionId?: string | null };

const DEFAULT_W = 1600, DEFAULT_H = 1000;
const parse = (s: string): Point[] => s.trim().split(/\s+/).filter(Boolean).map(v => { const [x, y] = v.split(",").map(Number); return { x, y }; }).filter(p => isFinite(p.x) && isFinite(p.y));
const stringify = (p: Point[]) => p.map(v => `${Math.round(v.x)},${Math.round(v.y)}`).join(" ");
const center = (p: Point[]) => p.length ? { x: p.reduce((a, v) => a + v.x, 0) / p.length, y: p.reduce((a, v) => a + v.y, 0) / p.length } : { x: DEFAULT_W / 2, y: DEFAULT_H / 2 };
const normalize = (p: Point[]) => p.length >= 3 ? p : [{ x: 600, y: 400 }, { x: 800, y: 400 }, { x: 800, y: 520 }, { x: 600, y: 520 }];
const edgeLen = (a: Point, b: Point) => Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);

const STATUS: Record<string, { fill: string; stroke: string; label: string }> = {
  available: { fill: "rgba(34,197,94,.18)",   stroke: "#16a34a", label: "Available" },
  reserved:  { fill: "rgba(234,179,8,.22)",   stroke: "#ca8a04", label: "Reserved"  },
  sold:      { fill: "rgba(239,68,68,.22)",   stroke: "#dc2626", label: "Sold"      },
  hold:      { fill: "rgba(148,163,184,.22)", stroke: "#64748b", label: "Hold"      },
};
const sc = (s: string) => STATUS[s] ?? { fill: "rgba(37,99,235,.14)", stroke: "#334155", label: s };

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
  const [sheet, setSheet] = useState<"none" | "filter" | "detail">("none");

  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const pinch = useRef<{ dist: number; px: number; py: number; zoom: number } | null>(null);

  const vw = cw / zoom, vh = ch / zoom;
  const viewBox = `${pan.x} ${pan.y} ${vw} ${vh}`;
  const conv = (m: number) => unit === "ft" ? (m * 3.281).toFixed(1) : unit === "yd" ? (m * 1.094).toFixed(1) : m.toFixed(1);

  // Load data
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
          id: l.id, number: l.number, status: l.status || "available",
          owner: l.owner || "", price: l.price, area: l.area ?? null,
          areaSqFt: l.areaSqFt ?? null, lengthM: l.lengthM ?? null, widthM: l.widthM ?? null,
          direction: l.direction || "", notes: l.details || l.notes || "",
          points: l.points || "", sectionId: l.sectionId || null,
        })));
        // Fit canvas to screen on load
        const sw = window.innerWidth, sh2 = window.innerHeight;
        const fitZ = Math.min(sw / W, sh2 / H) * 0.95;
        setZoom(fitZ);
        setPan({ x: (W - W / fitZ) / 2, y: (H - H / fitZ) / 2 });
      })
      .finally(() => setLoading(false));
  }, [projectSlug]);

  const master = plans.find(p => p.id === "master_plan") || plans[0];
  const sections = useMemo(() => plans.filter(p => p.id !== "master_plan"), [plans]);
  const planLots = useMemo(() => planId === "master_plan" ? lots : lots.filter(l => l.sectionId === planId), [lots, planId]);
  const filtered = useMemo(() => planLots.filter(l => {
    if (filterStatus !== "all" && l.status !== filterStatus) return false;
    if (filterSearch.trim()) { const q = filterSearch.toLowerCase(); return l.number.includes(q) || (l.owner || "").toLowerCase().includes(q); }
    return true;
  }), [planLots, filterStatus, filterSearch]);
  const filteredSet = useMemo(() => new Set(filtered.map(l => l.id)), [filtered]);
  const selectedLot = lots.find(l => l.id === selected) ?? null;
  const statusCounts = useMemo(() => { const c: Record<string, number> = { all: planLots.length }; for (const l of planLots) c[l.status] = (c[l.status] || 0) + 1; return c; }, [planLots]);

  function assetUrl(kind: "map" | "drone") {
    const url = kind === "map" ? master?.masterPlanUrl : master?.droneUrl;
    if (!url) return null;
    return `/api/projects/${encodeURIComponent(projectSlug)}/assets/file?kind=${kind === "map" ? "master-plan" : "drone"}&planType=master_plan&v=${encodeURIComponent(url)}`;
  }

  function fitView() {
    const sw = window.innerWidth, sh2 = window.innerHeight;
    const fitZ = Math.min(sw / cw, sh2 / ch) * 0.95;
    setZoom(fitZ);
    setPan({ x: (cw - cw / fitZ) / 2, y: (ch - ch / fitZ) / 2 });
  }

  function focusLot(lot: Lot) {
    const q = normalize(parse(lot.points)), c = center(q);
    setSelected(lot.id);
    setPlanId(lot.sectionId || "master_plan");
    setZoom(1.5);
    setPan({ x: c.x - cw / 2, y: c.y - ch / 2 });
    setSheet("detail");
  }

  // Pointer pan
  function onPD(e: React.PointerEvent) {
    if (e.button !== 0 && e.pointerType !== "touch") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
  }
  function onPM(e: React.PointerEvent) {
    if (!drag.current) return;
    const r = svgRef.current!.getBoundingClientRect();
    setPan({ x: drag.current.px - (e.clientX - drag.current.sx) * vw / (r.width || 1), y: drag.current.py - (e.clientY - drag.current.sy) * vh / (r.height || 1) });
  }
  function onPU() { drag.current = null; }

  // Wheel zoom
  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const d = e.deltaY > 0 ? 1 / 1.15 : 1.15;
    setZoom(z => Math.min(8, Math.max(.2, +(z * d).toFixed(3))));
  }

  // Touch pinch zoom
  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const t0 = e.touches[0], t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      pinch.current = { dist, px: (t0.clientX + t1.clientX) / 2, py: (t0.clientY + t1.clientY) / 2, zoom };
    }
  }
  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && pinch.current) {
      e.preventDefault();
      const t0 = e.touches[0], t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const newZoom = Math.min(8, Math.max(.2, pinch.current.zoom * (dist / pinch.current.dist)));
      setZoom(newZoom);
    }
  }
  function onTouchEnd() { pinch.current = null; }

  function renderAnnotations(q: Point[], lot: Lot, z: number, sel: boolean) {
    const c = center(q);
    const sqYd = lot.area != null ? Number(lot.area) : null;
    const lm = lot.lengthM, wm = lot.widthM;
    const edges = q.map((pt, i) => { const nx = q[(i + 1) % q.length]; return { len: edgeLen(pt, nx), mx: (pt.x + nx.x) / 2, my: (pt.y + nx.y) / 2, angle: Math.atan2(nx.y - pt.y, nx.x - pt.x) * 180 / Math.PI }; });
    const hE = edges.filter(e => { const a = Math.abs(e.angle % 180); return a < 45 || a > 135; }).sort((a, b) => b.len - a.len);
    const vE = edges.filter(e => { const a = Math.abs(e.angle % 180); return a >= 45 && a <= 135; }).sort((a, b) => b.len - a.len);
    const sorted = [hE[0], vE[0]].filter(Boolean);
    const fs = 16 / z, off = 28 / z;
    const dim = (m: number) => unit === "ft" ? `${(m * 3.281).toFixed(1)}ft` : unit === "yd" ? `${(m * 1.094).toFixed(1)}yd` : `${m.toFixed(1)}m`;
    return <>
      <text x={c.x} y={sel && sqYd != null ? c.y - 18 / z : c.y} textAnchor="middle" dominantBaseline="middle" fontSize={22 / z} fontWeight={900} pointerEvents="none" fill="#172033" paintOrder="stroke" stroke="white" strokeWidth={5 / z}>{lot.number}</text>
      {sel && sqYd != null && <text x={c.x} y={c.y + 16 / z} textAnchor="middle" dominantBaseline="middle" fontSize={14 / z} fontWeight={700} pointerEvents="none" fill="#475569" paintOrder="stroke" stroke="white" strokeWidth={3 / z}>{sqYd} sq.yd</text>}
      {sel && (lm || wm) && sorted.map((e, i) => {
        const absA = Math.abs(e.angle % 180), isH = absA < 45 || absA > 135;
        const d = lm && wm ? (isH ? lm : wm) : (lm || wm || null);
        if (!d) return null;
        const pa = e.angle + 90, cp = Math.cos(pa * Math.PI / 180), sp = Math.sin(pa * Math.PI / 180);
        const dot = cp * (c.x - e.mx) + sp * (c.y - e.my);
        const sign = dot > 0 ? -1 : 1;
        const px = e.mx + cp * off * sign, py = e.my + sp * off * sign;
        let rot = e.angle; if (rot > 90) rot -= 180; if (rot < -90) rot += 180;
        return <text key={i} x={px} y={py} textAnchor="middle" dominantBaseline="middle" fontSize={fs} fontWeight={400} pointerEvents="none" fill="#1e40af" paintOrder="stroke" stroke="rgba(255,255,255,.95)" strokeWidth={3 / z} transform={`rotate(${rot},${px},${py})`}>{dim(d)}</text>;
      })}
    </>;
  }

  const btn: React.CSSProperties = { border: "1px solid #dbe2ea", background: "#fff", color: "#243047", borderRadius: 8, padding: "8px 10px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 };

  if (loading) return <div style={{ height: "100%", display: "grid", placeItems: "center", color: "#64748b", fontSize: 14 }}>Loading…</div>;

  // ── LEFT PANEL CONTENT ──
  const filterContent = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {sections.length > 0 && (
        <div style={{ padding: 12, borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
          <div style={{ fontSize: 10, letterSpacing: 1, fontWeight: 900, color: "#7b8798", marginBottom: 7 }}>PLAN</div>
          <button onClick={() => setPlanId("master_plan")} style={{ ...btn, width: "100%", justifyContent: "flex-start", marginBottom: 5, background: planId === "master_plan" ? "#eef2ff" : "#fff", borderColor: planId === "master_plan" ? "#c7d2fe" : "#e2e8f0" }}>▦ Master Plan</button>
          {sections.map(s => <button key={s.id} onClick={() => setPlanId(s.id)} style={{ ...btn, width: "100%", justifyContent: "flex-start", marginBottom: 4, background: planId === s.id ? "#eef2ff" : "#fff", borderColor: planId === s.id ? "#c7d2fe" : "#e2e8f0" }}>{s.name}</button>)}
        </div>
      )}
      <div style={{ padding: 12, borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
        <div style={{ fontSize: 10, letterSpacing: 1, fontWeight: 900, color: "#7b8798", marginBottom: 7 }}>STATUS</div>
        {[["all", "All"], ...Object.keys(STATUS).map(k => [k, STATUS[k].label])].map(([key, label]) => (
          <button key={key} onClick={() => { setFilterStatus(key); setSheet("none"); }} style={{ ...btn, width: "100%", justifyContent: "space-between", marginBottom: 4, background: filterStatus === key ? "#172554" : "#fff", color: filterStatus === key ? "#fff" : "#243047", borderColor: filterStatus === key ? "#172554" : "#e2e8f0" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              {key !== "all" && <span style={{ width: 10, height: 10, borderRadius: 3, background: STATUS[key]?.stroke, flexShrink: 0 }} />}
              {label}
            </span>
            <span style={{ fontSize: 11, opacity: .7 }}>{statusCounts[key] ?? 0}</span>
          </button>
        ))}
      </div>
      <div style={{ padding: 12, borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
        <div style={{ position: "relative" }}>
          <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input value={filterSearch} onChange={e => setFilterSearch(e.target.value)} placeholder="Search plot or owner…" style={{ width: "100%", boxSizing: "border-box", paddingLeft: 28, paddingRight: filterSearch ? 28 : 10, paddingTop: 8, paddingBottom: 8, border: "1px solid #dbe2ea", borderRadius: 8, fontSize: 12, outline: "none" }} />
          {filterSearch && <button onClick={() => setFilterSearch("")} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 2 }}><X size={12} /></button>}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
        {filtered.length === 0
          ? <div style={{ padding: 16, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>No plots match</div>
          : filtered.slice().sort((a, b) => Number(a.number) - Number(b.number)).map(lot => {
              const col = sc(lot.status);
              return (
                <button key={lot.id} onClick={() => focusLot(lot)} style={{ width: "100%", textAlign: "left", padding: "10px 10px", border: `1px solid ${selected === lot.id ? col.stroke : "#e4e9f0"}`, borderRadius: 8, background: selected === lot.id ? col.fill : "#fff", marginBottom: 5, cursor: "pointer", display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: col.stroke, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>Plot {lot.number}</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{col.label}{lot.area != null ? ` · ${lot.area} sq.yd` : ""}</div>
                  </div>
                </button>
              );
            })}
      </div>
    </div>
  );

  // ── DETAIL PANEL CONTENT ──
  const detailContent = selectedLot ? (() => {
    const col = sc(selectedLot.status);
    return (
      <div style={{ padding: "4px 16px 32px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 10, letterSpacing: 1, fontWeight: 900, color: "#64748b" }}>PLOT DETAILS</span>
              <select value={unit} onChange={e => setUnit(e.target.value as "m" | "ft" | "yd")} style={{ fontSize: 11, border: "1px solid #e2e8f0", borderRadius: 6, padding: "2px 6px", background: "#f8fafc" }}>
                <option value="m">m</option><option value="ft">ft</option><option value="yd">yd</option>
              </select>
            </div>
            <h3 style={{ margin: 0, fontSize: 24, letterSpacing: "-.02em", fontWeight: 900 }}>Plot {selectedLot.number}</h3>
          </div>
          <button onClick={() => { setSelected(null); setSheet("none"); }} style={{ ...btn, padding: 7, marginTop: 4 }}><X size={15} /></button>
        </div>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 999, background: col.fill, border: `1px solid ${col.stroke}`, fontWeight: 800, fontSize: 13, color: col.stroke, marginBottom: 16 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: col.stroke }} />{col.label}
        </div>

        {(selectedLot.lengthM || selectedLot.widthM || selectedLot.area) && (
          <div style={{ padding: "12px 14px", borderRadius: 10, background: "#f0f9ff", border: "1px solid #bae6fd", marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: "#0369a1", marginBottom: 8, letterSpacing: .7 }}>DIMENSIONS & AREA</div>
            {selectedLot.lengthM && selectedLot.widthM && (
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1e3a5f", marginBottom: 4 }}>
                {conv(selectedLot.lengthM)}{unit} × {conv(selectedLot.widthM)}{unit}
                <span style={{ fontSize: 12, color: "#64748b", marginLeft: 6 }}>= {+(selectedLot.lengthM * selectedLot.widthM).toFixed(2)} sq.m</span>
              </div>
            )}
            {selectedLot.area != null && (
              <div style={{ fontSize: 20, fontWeight: 900, color: "#172554" }}>
                {selectedLot.area} sq.yd
                {selectedLot.areaSqFt != null && <span style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginLeft: 8 }}>· {selectedLot.areaSqFt} sq.ft</span>}
              </div>
            )}
          </div>
        )}

        <div style={{ display: "grid", gap: 12 }}>
          {[["Price", selectedLot.price != null ? `₹ ${selectedLot.price}` : null], ["Direction", selectedLot.direction || null], ["Owner", selectedLot.owner || null], ["Notes", selectedLot.notes || null]].filter(([, v]) => v).map(([label, value]) => (
            <div key={label as string} style={{ padding: "10px 12px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e8edf3" }}>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: .7, color: "#94a3b8", marginBottom: 3 }}>{label as string}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#172033" }}>{value as string}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24, padding: 14, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1, color: "#94a3b8", marginBottom: 10 }}>LEGEND</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {Object.entries(STATUS).map(([key, c]) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 13, height: 13, borderRadius: 3, background: c.fill, border: `2px solid ${c.stroke}`, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 700 }}>{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  })() : null;

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        .pv { height: 100%; display: grid; grid-template-columns: 260px 1fr 300px; font-family: Inter, ui-sans-serif, system-ui, sans-serif; font-size: 13px; color: #182235; background: #f4f6f9; }
        .pv-left { background: #fff; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; overflow: hidden; }
        .pv-canvas { position: relative; overflow: hidden; background: #d9dee5; }
        .pv-right { background: #fff; border-left: 1px solid #e2e8f0; overflow-y: auto; }
        .pv-toolbar { position: absolute; top: 12px; left: 12px; right: 12px; z-index: 10; display: flex; align-items: center; gap: 6px; padding: 7px 10px; border: 1px solid rgba(226,232,240,.9); border-radius: 12px; background: rgba(255,255,255,.97); box-shadow: 0 4px 20px rgba(15,23,42,.1); }
        .pv-hint { font-size: 11px; color: #64748b; margin-left: auto; }
        .pv-fab { display: none; }
        .pv-bottom-bar { display: none; }
        .pv-sheet { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; background: #fff; border-radius: 20px 20px 0 0; box-shadow: 0 -8px 40px rgba(15,23,42,.18); transform: translateY(100%); transition: transform .3s cubic-bezier(.32,0,.67,0); max-height: 80vh; display: flex; flex-direction: column; padding-bottom: env(safe-area-inset-bottom); }
        .pv-sheet.open { transform: translateY(0); transition: transform .3s cubic-bezier(.33,1,.68,1); }
        .pv-handle { width: 40px; height: 4px; background: #cbd5e1; border-radius: 2px; margin: 12px auto 4px; flex-shrink: 0; }
        .pv-sheet-body { flex: 1; overflow-y: auto; }
        .pv-overlay { display: none; position: fixed; inset: 0; z-index: 45; background: rgba(15,23,42,.4); opacity: 0; pointer-events: none; transition: opacity .25s; }
        .pv-overlay.open { opacity: 1; pointer-events: auto; display: block; }
        @media (max-width: 767px) {
          .pv { grid-template-columns: 1fr; }
          .pv-left, .pv-right { display: none; }
          .pv-hint { display: none; }
          .pv-toolbar { top: 10px; left: 10px; right: 10px; padding: 6px 8px; gap: 4px; }
          .pv-bottom-bar {
            display: flex; position: absolute; bottom: 0; left: 0; right: 0; z-index: 10;
            background: rgba(255,255,255,.97); border-top: 1px solid #e2e8f0;
            padding: 8px 10px; padding-bottom: max(10px, env(safe-area-inset-bottom));
            gap: 8px; align-items: center; box-shadow: 0 -2px 16px rgba(15,23,42,.08);
          }
        }
      `}</style>

      <div className="pv">
        {/* Desktop left */}
        <aside className="pv-left">{filterContent}</aside>

        {/* Canvas */}
        <main className="pv-canvas">
          {/* Toolbar */}
          <div className="pv-toolbar">
            <button onClick={() => setZoom(z => Math.min(8, +(z * 1.25).toFixed(2)))} style={{ ...btn, padding: 7 }}><Plus size={14} /></button>
            <span style={{ width: 42, textAlign: "center", fontSize: 12, fontWeight: 800 }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.max(.2, +(z / 1.25).toFixed(2)))} style={{ ...btn, padding: 7 }}><Minus size={14} /></button>
            <button onClick={fitView} style={btn}>Fit</button>
            <div style={{ width: 1, height: 18, background: "#e2e8f0", margin: "0 1px" }} />
            <button onClick={() => setLayer("map")}   style={{ ...btn, background: layer === "map"   ? "#172554" : "#fff", color: layer === "map"   ? "#fff" : "#243047" }}>Map</button>
            <button onClick={() => setLayer("drone")} style={{ ...btn, background: layer === "drone" ? "#172554" : "#fff", color: layer === "drone" ? "#fff" : "#243047" }}>Drone</button>
            <span className="pv-hint">Drag to pan · scroll to zoom</span>
          </div>

          {/* SVG */}
          <svg ref={svgRef} viewBox={viewBox} preserveAspectRatio="xMinYMin meet"
            onPointerDown={onPD} onPointerMove={onPM} onPointerUp={onPU} onPointerCancel={onPU}
            onWheel={onWheel}
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "pan-x pan-y pinch-zoom", cursor: "grab" }}>
            {droneL.visible && assetUrl("drone") && layer === "drone" && <image href={assetUrl("drone")!} x={droneL.x} y={droneL.y} width={droneL.width} height={droneL.height} opacity={droneL.opacity} preserveAspectRatio="none" pointerEvents="none" />}
            {mapL.visible && assetUrl("map") && layer === "map" && <image href={assetUrl("map")!} x={mapL.x} y={mapL.y} width={mapL.width} height={mapL.height} opacity={mapL.opacity} preserveAspectRatio="none" pointerEvents="none" />}
            {planLots.map(lot => {
              const q = normalize(parse(lot.points));
              const isSel = selected === lot.id;
              const isFilt = !filteredSet.has(lot.id) && (filterStatus !== "all" || filterSearch.trim());
              const col = sc(lot.status);
              return (
                <g key={lot.id} onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); focusLot(lot); }} style={{ cursor: "pointer" }}>
                  <polygon points={stringify(q)} fill={isSel ? col.fill.replace(/[\d.]+\)$/, ".45)") : isFilt ? "rgba(203,213,225,.15)" : col.fill} stroke={isSel ? col.stroke : isFilt ? "#cbd5e1" : col.stroke} strokeWidth={isSel ? 4 : 2} opacity={isFilt ? .35 : 1} />
                  {renderAnnotations(q, lot, zoom, isSel)}
                </g>
              );
            })}
          </svg>

          {!assetUrl("map") && !assetUrl("drone") && (
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#64748b", pointerEvents: "none", fontSize: 13 }}>No site plan image yet.</div>
          )}

          {/* Mobile bottom bar */}
          <div className="pv-bottom-bar">
            <button onClick={() => setSheet(s => s === "filter" ? "none" : "filter")} style={{ ...btn, flex: 1, justifyContent: "center", background: sheet === "filter" ? "#172554" : "#fff", color: sheet === "filter" ? "#fff" : "#243047" }}>
              <Filter size={14} /> Filters{filterStatus !== "all" ? ` · ${filterStatus}` : ""}
            </button>
            <button onClick={() => setSheet(s => s === "detail" ? "none" : "detail")} style={{ ...btn, flex: 1, justifyContent: "center", background: sheet === "detail" ? "#172554" : "#fff", color: sheet === "detail" ? "#fff" : "#243047" }}>
              <List size={14} /> {selectedLot ? `Plot ${selectedLot.number}` : "Plots"}
            </button>
            <button onClick={fitView} style={{ ...btn, padding: "8px 12px" }}>Fit</button>
          </div>
        </main>

        {/* Desktop right */}
        <aside className="pv-right">
          {detailContent ?? (
            <div style={{ padding: 16 }}>
              <div style={{ padding: "32px 8px", color: "#64748b", textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🗺</div>
                <div style={{ fontWeight: 800, color: "#334155", marginBottom: 6, fontSize: 14 }}>Tap a plot to view details</div>
                <div style={{ fontSize: 12, lineHeight: 1.6 }}>Filter by status or search by plot number or owner name.</div>
              </div>
              <div style={{ padding: 14, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1, color: "#94a3b8", marginBottom: 10 }}>LEGEND</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {Object.entries(STATUS).map(([key, c]) => (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 13, height: 13, borderRadius: 3, background: c.fill, border: `2px solid ${c.stroke}`, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{c.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Mobile sheets */}
      <div className={`pv-overlay${sheet !== "none" ? " open" : ""}`} onClick={() => setSheet("none")} />

      <div className={`pv-sheet${sheet === "filter" ? " open" : ""}`} style={{ maxHeight: "75vh" }}>
        <div className="pv-handle" />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px 8px", flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>Filter & Search</div>
          <button onClick={() => setSheet("none")} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 6 }}><X size={18} /></button>
        </div>
        <div className="pv-sheet-body">{filterContent}</div>
      </div>

      <div className={`pv-sheet${sheet === "detail" ? " open" : ""}`} style={{ maxHeight: "70vh" }}>
        <div className="pv-handle" />
        <div className="pv-sheet-body">
          {detailContent ?? (
            <div style={{ padding: "8px 16px 24px" }}>
              <div style={{ fontWeight: 800, color: "#334155", marginBottom: 6 }}>No plot selected</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Tap a plot on the map or use Filters to find one.</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
