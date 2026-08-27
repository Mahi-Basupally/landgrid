"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, Eye, EyeOff, FileJson, Minus, Plus, Save, Trash2, Upload, X, UserPlus } from "lucide-react";

type Point = { x: number; y: number };
type Layer = { visible: boolean; opacity: number; x: number; y: number; width: number; height: number };
type Layers = { map: Layer; drone: Layer };
type ShapeMode = "rectangle" | "polygon";
type Plan = { id: string; name: string; sortOrder?: number; masterPlanUrl?: string | null; droneUrl?: string | null; points?: string | null; layerGeometry?: any };
type Owner = { id: string; name: string; email?: string | null; phone?: string | null; notes?: string | null };
type Plot = { id: string; number: string; status: string; owner: string; ownerId?: string | null; price: number | string | null; area: number | string | null; areaSqFt: number | null; lengthM: number | null; widthM: number | null; direction: string; model: string; notes: string; locked?: boolean; points: string; labelX: number; labelY: number; sectionId?: string | null };
type SectionVisibility = { hidden: boolean; plotsHidden: boolean };
type Drag = { kind: "pan" | "move" | "edge" | "point"; id: string; start: Point; points?: Point[]; edge?: number; point?: number; panStart?: Point; section?: boolean };

const DEFAULT_W = 1600, DEFAULT_H = 1000;
const parse = (s: string): Point[] => s.trim().split(/\s+/).filter(Boolean).map(v => v.split(",").map(Number)).filter(v => Number.isFinite(v[0]) && Number.isFinite(v[1])).map(([x, y]) => ({ x, y }));
const stringify = (p: Point[]) => p.map(v => `${Math.round(v.x)},${Math.round(v.y)}`).join(" ");
const center = (p: Point[]) => p.length ? { x: p.reduce((a, v) => a + v.x, 0) / p.length, y: p.reduce((a, v) => a + v.y, 0) / p.length } : { x: DEFAULT_W / 2, y: DEFAULT_H / 2 };
const bounds = (p: Point[]) => !p.length ? { minX: 0, minY: 0, maxX: DEFAULT_W, maxY: DEFAULT_H } : { minX: Math.min(...p.map(v => v.x)), minY: Math.min(...p.map(v => v.y)), maxX: Math.max(...p.map(v => v.x)), maxY: Math.max(...p.map(v => v.y)) };
const rectangle = (p: Point[]): Point[] => { const b = bounds(p); return [{ x: b.minX, y: b.minY }, { x: b.maxX, y: b.minY }, { x: b.maxX, y: b.maxY }, { x: b.minX, y: b.maxY }]; };
const polygon8 = (p: Point[]): Point[] => { const b = bounds(p), mx = (b.minX + b.maxX) / 2, my = (b.minY + b.maxY) / 2; return [{ x: b.minX, y: b.minY }, { x: mx, y: b.minY }, { x: b.maxX, y: b.minY }, { x: b.maxX, y: my }, { x: b.maxX, y: b.maxY }, { x: mx, y: b.maxY }, { x: b.minX, y: b.maxY }, { x: b.minX, y: my }]; };
const normalize = (p: Point[]) => p.length === 4 || p.length === 8 ? p : p.length >= 3 ? p : rectangle([{ x: 600, y: 400 }, { x: 800, y: 400 }, { x: 800, y: 520 }, { x: 600, y: 520 }]);
const defaultLayer = (opacity: number): Layer => ({ visible: true, opacity, x: 0, y: 0, width: DEFAULT_W, height: DEFAULT_H });
const defaultLayers = (): Layers => ({ map: defaultLayer(.72), drone: defaultLayer(.42) });
const emptyVisibility = (): SectionVisibility => ({ hidden: false, plotsHidden: false });

export default function PlotEditor({ projectSlug, onStatusChange }: { projectSlug: string; onStatusChange?: (msg: string) => void }) {
  const [plans, setPlans] = useState<Plan[]>([]), [plots, setPlots] = useState<Plot[]>([]), [sections, setSections] = useState<Record<string, string>>({}), [owners, setOwners] = useState<Owner[]>([]);
  const [visibility, setVisibility] = useState<Record<string, SectionVisibility>>({});
  const [canvasW, setCanvasW] = useState(DEFAULT_W), [canvasH, setCanvasH] = useState(DEFAULT_H);
  const [dimUnit, setDimUnit] = useState<"m"|"ft"|"yd">("m");
  const W = canvasW, H = canvasH;
  const [planId, setPlanId] = useState("master_plan"), [selected, setSelected] = useState<string | null>(null), [selectedIds, setSelectedIds] = useState<Set<string>>(new Set()), [selectedSection, setSelectedSection] = useState<string | null>(null), [shapeMode, setShapeMode] = useState<ShapeMode>("polygon");
  const [layers, setLayers] = useState<Layers>(defaultLayers()), [zoom, setZoom] = useState(1), [pan, setPan] = useState<Point>({ x: 0, y: 0 }), [drag, setDrag] = useState<Drag | null>(null), [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState<{ kind: "plot" | "section"; id: string; label: string } | null>(null), [uploading, setUploading] = useState<"map" | "drone" | null>(null), [ownerName, setOwnerName] = useState(""), [ownerEmail, setOwnerEmail] = useState(""), [ownerPhone, setOwnerPhone] = useState(""), [ownersOpen, setOwnersOpen] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null), mapInput = useRef<HTMLInputElement | null>(null), droneInput = useRef<HTMLInputElement | null>(null), importInput = useRef<HTMLInputElement | null>(null), loaded = useRef(false), saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const master = plans.find(p => p.id === "master_plan") || plans[0], section = plans.find(p => p.id === selectedSection) || null, selectedPlot = plots.find(p => p.id === selected) || null;
  const sectionList = useMemo(() => plans.filter(p => p.id !== "master_plan"), [plans]);
  const visiblePlots = useMemo(() => planId === "master_plan" ? plots.filter(p => !p.sectionId || !visibility[p.sectionId]?.plotsHidden) : visibility[planId]?.plotsHidden ? [] : plots.filter(p => p.sectionId === planId), [plots, planId, visibility]);
  const viewW = W / zoom, viewH = H / zoom, viewBox = `${(W - viewW) / 2 + pan.x} ${(H - viewH) / 2 + pan.y} ${viewW} ${viewH}`;
  const button: React.CSSProperties = { border: "1px solid #dbe2ea", background: "#fff", color: "#243047", borderRadius: 8, padding: "8px 10px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" };
  const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #dbe2ea", borderRadius: 8, padding: "9px 10px", fontSize: 13, outline: "none", background: "#fff" };
  const card: React.CSSProperties = { background: "#fff", border: "1px solid #e4e9f0", borderRadius: 12, padding: 12, boxShadow: "0 1px 2px rgba(15,23,42,.04)" };

  const point = (e: React.PointerEvent<SVGElement>): Point => { const svg = svgRef.current; if (!svg) return { x: 0, y: 0 }; const r = svg.getBoundingClientRect(), v = svg.viewBox.baseVal; return { x: v.x + ((e.clientX - r.left) / r.width) * v.width, y: v.y + ((e.clientY - r.top) / r.height) * v.height }; };
  const asset = (kind: "map" | "drone") => { const url = kind === "map" ? master?.masterPlanUrl : master?.droneUrl; if (!url) return null; return `/api/projects/${encodeURIComponent(projectSlug)}/assets/file?kind=${kind === "map" ? "master-plan" : "drone"}&planType=master_plan&v=${encodeURIComponent(url)}`; };

  useEffect(() => { void load(); }, [projectSlug]);
  useEffect(() => { if (!loaded.current || !dirty) return; if (saveTimer.current) clearTimeout(saveTimer.current); saveTimer.current = setTimeout(() => void save(), 700); return () => { if (saveTimer.current) clearTimeout(saveTimer.current); }; }, [plans, plots, sections, visibility, layers, dirty]);

  useEffect(() => {
    const loadNativeSize = (kind: "map" | "drone", src: string | null) => {
      if (!src) return;
      const img = new window.Image();
      img.onload = () => {
        const width = img.naturalWidth || W;
        const height = img.naturalHeight || H;
        setLayers(current => {
          const existing = current[kind];
          const sameSize = existing.width === width && existing.height === height;
          if (sameSize) return current;
          return { ...current, [kind]: { ...existing, x: (W - width) / 2, y: (H - height) / 2, width, height } };
        });
      };
      img.onerror = () => setMessage(`Unable to read ${kind} image dimensions`);
      img.src = src;
    };
    loadNativeSize("map", asset("map"));
    loadNativeSize("drone", asset("drone"));
  }, [master?.masterPlanUrl, master?.droneUrl, projectSlug]);

  async function load() {
    try {
      const r = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/plan`, { cache: "no-store" }), d = await r.json(); if (!r.ok) throw new Error(d.error || "Unable to load plan");
      if (d.canvasWidth && d.canvasHeight) { setCanvasW(d.canvasWidth); setCanvasH(d.canvasHeight); }
      const ps = (d.sections || []) as Plan[], nextVisibility: Record<string, SectionVisibility> = {};
      ps.filter(p => p.id !== "master_plan").forEach(p => { const g = p.layerGeometry || {}; nextVisibility[p.id] = { hidden: Boolean(g.hidden), plotsHidden: Boolean(g.plotsHidden) }; });
      const ss: Record<string, string> = {}; ps.filter(p => p.id !== "master_plan").forEach(p => { ss[p.id] = p.points || ""; });
      setPlans(ps); setSections(ss); setVisibility(nextVisibility); setOwners((d.owners || []) as Owner[]); setPlots((d.lots || []).map((p: Plot) => { const q = normalize(parse(p.points || "")), c = center(q); return { ...p, ownerId: p.ownerId || null, points: stringify(q), labelX: c.x, labelY: c.y }; }));
      const g = ps.find(p => p.id === "master_plan")?.layerGeometry;
      if (g) { if (g.map) setLayers(v => ({ ...v, map: { ...defaultLayer(.72), ...g.map } })); if (g.drone) setLayers(v => ({ ...v, drone: { ...defaultLayer(.42), ...g.drone } })); if (Number.isFinite(g.zoom)) setZoom(Math.max(.25, Math.min(8, Number(g.zoom)))); setPan({ x: Number(g.panX || 0), y: Number(g.panY || 0) }); }
      loaded.current = true;
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to load plan"); }
  }

  async function save() {
    if (!loaded.current || busy || !dirty) return; setBusy(true); onStatusChange?.("Saving…");
    try {
      const masterGeometry = { map: layers.map, drone: layers.drone, zoom, panX: pan.x, panY: pan.y };
      const payload = plans.map(p => ({ ...p, points: p.id === "master_plan" ? p.points || null : sections[p.id] || p.points || null, layerGeometry: p.id === "master_plan" ? masterGeometry : { ...(p.layerGeometry || {}), ...(visibility[p.id] || {}) } }));
      const r = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/plan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sections: payload, lots: plots.map(p => ({ ...p, ownerId: p.ownerId || null })), canvasWidth: W, canvasHeight: H }) }), d = await r.json(); if (!r.ok) throw new Error(d.error || "Unable to save");
      setDirty(false); setMessage("All changes saved"); onStatusChange?.("All changes saved");
    } catch (e) { const msg = e instanceof Error ? e.message : "Unable to save"; setMessage(msg); onStatusChange?.(msg); } finally { setBusy(false); }
  }

  function deselect() { setSelected(null); setSelectedIds(new Set()); setSelectedSection(null); setDrag(null); }
  async function addSection() {
    const n = Math.max(0, ...plans.map(p => Number(p.id.match(/^section_(\d+)$/)?.[1] || 0))) + 1, id = `section_${n}`;
    try { const r = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/plans`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planType: id }) }), d = await r.json(); if (!r.ok) throw new Error(d.error || "Unable to add section"); const x = 120 + ((n - 1) % 3) * 480, y = 120 + Math.floor((n - 1) / 3) * 300, q = stringify(polygon8([{ x, y }, { x: x + 380, y }, { x: x + 380, y: y + 230 }, { x, y: y + 230 }])); setPlans(v => [...v, { id, name: `Section ${n}`, sortOrder: n, points: q }]); setSections(v => ({ ...v, [id]: q })); setVisibility(v => ({ ...v, [id]: emptyVisibility() })); setPlanId(id); setSelectedSection(id); setSelected(null); setShapeMode("polygon"); setDirty(true); setMessage(`Section ${n} added`); } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to add section"); }
  }
  async function deleteSection(id: string) { try { const r = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/plans`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planType: id }) }), d = await r.json(); if (!r.ok) throw new Error(d.error || "Unable to delete section"); setPlans(v => v.filter(p => p.id !== id)); setSections(v => { const n = { ...v }; delete n[id]; return n; }); setVisibility(v => { const n = { ...v }; delete n[id]; return n; }); setPlots(v => v.map(p => p.sectionId === id ? { ...p, sectionId: null } : p)); setPlanId("master_plan"); deselect(); setDirty(true); setMessage("Section deleted"); } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to delete section"); } finally { setConfirm(null); } }
  function renamePlan(id: string, name: string) { setPlans(v => v.map(p => p.id === id ? { ...p, name } : p)); setDirty(true); }
  function toggleSectionVisibility(id: string, key: keyof SectionVisibility) { setVisibility(v => ({ ...v, [id]: { ...(v[id] || emptyVisibility()), [key]: !(v[id]?.[key] || false) } })); setDirty(true); }
  function addPlot() { const n = String(Math.max(0, ...plots.map(p => Number(p.number)).filter(Number.isFinite)) + 1), sectionId = planId === "master_plan" ? null : planId, q = polygon8([{ x: 650, y: 430 }, { x: 830, y: 430 }, { x: 830, y: 540 }, { x: 650, y: 540 }]), c = center(q); const p: Plot = { id: crypto.randomUUID(), number: n, status: "available", owner: "", ownerId: null, price: null, area: null, areaSqFt: null, lengthM: null, widthM: null, direction: "", model: "", notes: "", locked: true, points: stringify(q), labelX: c.x, labelY: c.y, sectionId }; setPlots(v => [...v, p]); setSelected(p.id); setSelectedSection(null); setShapeMode("polygon"); setDirty(true); setMessage(`Plot ${n} added${sectionId ? ` to ${plans.find(s => s.id === sectionId)?.name || "Section"}` : ""}`); }
  function duplicatePlot() { if (!selectedPlot) return; const q = parse(selectedPlot.points).map(p => ({ x: p.x + 40, y: p.y + 40 })), nums = plots.map(p => Number(p.number)).filter(Number.isFinite), n = String(Math.max(...nums, Number(selectedPlot.number) || 0) + 1), c = center(q); const p: Plot = { ...selectedPlot, id: crypto.randomUUID(), number: n, points: stringify(q), labelX: c.x, labelY: c.y }; setPlots(v => [...v, p]); setSelected(p.id); setSelectedSection(null); setDirty(true); setMessage(`Plot ${n} duplicated`); }
  function toggleLock(id: string) { setPlots(v => v.map(p => p.id === id ? { ...p, locked: !p.locked } : p)); setDirty(true); }
  function updatePlot(k: keyof Plot, value: string | number | null) { if (!selectedPlot) return; setPlots(v => v.map(p => p.id === selectedPlot.id ? { ...p, [k]: k === "sectionId" || k === "ownerId" ? (value || null) : value } : p)); setDirty(true); }
  function updateMulti(key: "status" | "sectionId" | "ownerId", value: string) { setPlots(v => v.map(p => selectedIds.has(p.id) ? { ...p, [key]: value || null } : p)); setDirty(true); }
  function deleteMulti() { setPlots(v => v.filter(p => !selectedIds.has(p.id))); setSelectedIds(new Set()); setSelected(null); setDirty(true); setMessage(`${selectedIds.size} plots deleted`); }
  function choosePlot(id: string) { if (!id) { setSelected(null); return; } const p = plots.find(x => x.id === id); if (!p) return; const q = normalize(parse(p.points)), c = center(q), b = bounds(q), target = Math.min(8, Math.max(.75, Math.min(W / Math.max(1, b.maxX - b.minX), H / Math.max(1, b.maxY - b.minY)) * .55)); setSelected(id); setSelectedSection(null); setPlanId(p.sectionId || "master_plan"); setShapeMode(q.length === 4 ? "rectangle" : "polygon"); setZoom(target); setPan({ x: c.x - W / 2, y: c.y - H / 2 }); }
  function selectSection(id: string) { setPlanId(id); setSelectedSection(id); setSelected(null); const q = normalize(parse(sections[id] || "")); setShapeMode(q.length === 4 ? "rectangle" : "polygon"); if (q.length) { const c = center(q), b = bounds(q); setPan({ x: c.x - W / 2, y: c.y - H / 2 }); setZoom(Math.min(8, Math.max(.6, Math.min(W / Math.max(1, b.maxX - b.minX), H / Math.max(1, b.maxY - b.minY)) * .75))); } }
  function convertSelected(mode: ShapeMode) { const target = selectedPlot?.points || (selectedSection ? sections[selectedSection] : ""), q = parse(target), n = mode === "rectangle" ? rectangle(q) : polygon8(q), c = center(n); if (selectedPlot) setPlots(v => v.map(p => p.id === selectedPlot.id ? { ...p, points: stringify(n), labelX: c.x, labelY: c.y } : p)); if (selectedSection) { const s = stringify(n); setSections(v => ({ ...v, [selectedSection]: s })); setPlans(v => v.map(p => p.id === selectedSection ? { ...p, points: s } : p)); } setShapeMode(mode); setDirty(true); }
  function startCanvasPan(e: React.PointerEvent<SVGSVGElement>) { if (e.button !== 0) return; if (!e.ctrlKey && !e.metaKey) { setSelected(null); setSelectedIds(new Set()); setSelectedSection(null); } setDrag({ kind: "pan", id: "canvas", start: { x: e.clientX, y: e.clientY }, panStart: { ...pan } }); e.currentTarget.setPointerCapture(e.pointerId); }
  function startShape(e: React.PointerEvent<SVGElement>, id: string, q: Point[], sectionShape: boolean) { e.stopPropagation(); if (!sectionShape) { const plt = plots.find(p => p.id === id); if (plt?.locked) { setSelected(id); setSelectedSection(null); e.currentTarget.setPointerCapture(e.pointerId); return; } } if (sectionShape) { setSelectedSection(id); setSelected(null); setSelectedIds(new Set()); } else { if (e.ctrlKey || e.metaKey) { setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) { next.delete(id); } else { next.add(id); if (selected) next.add(selected); } return next; }); setSelected(id); setSelectedSection(null); } else { const isInMulti = selectedIds.has(id) && selectedIds.size > 1; if (!isInMulti) { setSelectedIds(new Set([id])); setSelected(id); } else { setSelected(id); } setSelectedSection(null);
        // Clicking a plot locks it
        setPlots(v => v.map(p => p.id === id ? { ...p, locked: true } : p));
        // zoom into clicked plot
        const b2 = bounds(q); const target2 = Math.min(6, Math.max(1.5, Math.min(W/(Math.max(1,b2.maxX-b2.minX)*1.5), H/(Math.max(1,b2.maxY-b2.minY)*1.5)))); setZoom(target2); setPan({ x: center(q).x - W/2, y: center(q).y - H/2 }); } } if (!sectionShape) { const isMulti = (e.ctrlKey || e.metaKey) || (selectedIds.has(id) && selectedIds.size > 1); setShapeMode(q.length === 4 ? "rectangle" : "polygon"); if (isMulti && selectedIds.size > 1) { const allPoints = plots.filter(p => selectedIds.has(p.id)).map(p => ({ id: p.id, pts: normalize(parse(p.points)) })); setDrag({ kind: "multimove", id, start: point(e), points: q, allPoints } as any); } else { setDrag({ kind: "move", id, start: point(e), points: q, section: false }); } } else { setShapeMode(q.length === 4 ? "rectangle" : "polygon"); setDrag({ kind: "move", id, start: point(e), points: q, section: true }); } e.currentTarget.setPointerCapture(e.pointerId); }
  function startEdge(e: React.PointerEvent<SVGLineElement>, id: string, edge: number, q: Point[], sectionShape: boolean) { e.stopPropagation(); if (sectionShape) { setSelectedSection(id); setSelected(null); } else { setSelected(id); setSelectedSection(null); } setDrag({ kind: "edge", id, start: point(e), points: q, edge, section: sectionShape }); e.currentTarget.setPointerCapture(e.pointerId); }
  function startPoint(e: React.PointerEvent<SVGCircleElement>, id: string, index: number, q: Point[], sectionShape: boolean) { e.stopPropagation(); if (sectionShape) { setSelectedSection(id); setSelected(null); } else { setSelected(id); setSelectedSection(null); } setDrag({ kind: "point", id, start: point(e), points: q, point: index, section: sectionShape }); e.currentTarget.setPointerCapture(e.pointerId); }
  function moveEdge(q: Point[], edge: number, dx: number, dy: number): Point[] { const i = edge % q.length, j = (i + 1) % q.length, a = q[i], b = q[j], ex = b.x - a.x, ey = b.y - a.y, len = Math.hypot(ex, ey) || 1, nx = -ey / len, ny = ex / len, amount = dx * nx + dy * ny; return q.map((p, idx) => idx === i || idx === j ? { x: p.x + nx * amount, y: p.y + ny * amount } : p); }
  function move(e: React.PointerEvent<SVGSVGElement>) { if (!drag) return; if (drag.kind === "pan") { const r = svgRef.current?.getBoundingClientRect(); if (!r) return; setPan({ x: drag.panStart!.x - (e.clientX - drag.start.x) * viewW / r.width, y: drag.panStart!.y - (e.clientY - drag.start.y) * viewH / r.height }); setDirty(true); return; } const n = point(e), dx = n.x - drag.start.x, dy = n.y - drag.start.y; if ((drag as any).kind === "multimove") { const allPoints = (drag as any).allPoints as { id: string; pts: Point[] }[]; setPlots(v => v.map(p => { const entry = allPoints.find(a => a.id === p.id); if (!entry) return p; const moved = entry.pts.map((pt: Point) => ({ x: pt.x + dx, y: pt.y + dy })); const c = center(moved); return { ...p, points: stringify(moved), labelX: c.x, labelY: c.y }; })); setDirty(true); return; } let q = drag.points!; if (drag.kind === "move") q = q.map(p => ({ x: p.x + dx, y: p.y + dy })); else if (drag.kind === "edge") q = moveEdge(q, drag.edge!, dx, dy); else if (drag.kind === "point") q = q.map((p, i) => i === drag.point ? { x: p.x + dx, y: p.y + dy } : p); else return; if (drag.section) { const s = stringify(q); setSections(v => ({ ...v, [drag.id]: s })); setPlans(v => v.map(p => p.id === drag.id ? { ...p, points: s } : p)); } else { const c = center(q); setPlots(v => v.map(p => p.id === drag.id ? { ...p, points: stringify(q), labelX: c.x, labelY: c.y } : p)); } setDirty(true); }
  async function upload(kind: "map" | "drone", file: File) { setUploading(kind); try { const form = new FormData(); form.append("file", file); form.append("kind", kind === "map" ? "master-plan" : "drone"); form.append("planType", "master_plan"); const r = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/assets`, { method: "POST", body: form }), d = await r.json(); if (!r.ok) throw new Error(d.error || "Upload failed"); setPlans(v => v.map(p => p.id === "master_plan" ? { ...p, ...(kind === "map" ? { masterPlanUrl: d.savedValue } : { droneUrl: d.savedValue }) } : p)); setDirty(true); setMessage(`${kind} uploaded`); } catch (e) { setMessage(e instanceof Error ? e.message : "Upload failed"); } finally { setUploading(null); } }
  function resetView() { setZoom(1); setPan({ x: 0, y: 0 }); setDirty(true); }
  function dimStr(m: number | null) { if (!m) return ""; if (dimUnit === "ft") return `${+(m * 3.28084).toFixed(1)}ft`; if (dimUnit === "yd") return `${+(m * 1.09361).toFixed(1)}yd`; return `${+m.toFixed(2)}m`; }
  function edgeLenM(a: Point, b: Point) { return Math.sqrt((b.x-a.x)**2+(b.y-a.y)**2); }
  function renderPlotAnnotations(q: Point[], p: Plot, z: number, active = false) {
    const c = center(q);
    const sqYd = p.area != null ? Number(p.area) : null;
    const showArea = active; // only show area when selected
    const lm = p.lengthM, wm = p.widthM;
    // Edge dimension labels — only show on the 4 main edges (longest 4 of polygon)
    const edges = q.map((pt, i) => { const next = q[(i+1)%q.length]; return { a: pt, b: next, len: edgeLenM(pt, next), mx: (pt.x+next.x)/2, my: (pt.y+next.y)/2, angle: Math.atan2(next.y-pt.y, next.x-pt.x)*180/Math.PI }; });
    const sorted = [...edges].sort((a,b) => b.len-a.len).slice(0, 4);
    const fs = 16/z, offset = 20/z;
    return <>
      {/* Plot number */}
      <text x={c.x} y={active && sqYd ? c.y - 18/z : c.y} textAnchor="middle" dominantBaseline="middle" fontSize={22/z} fontWeight={900} pointerEvents="none" fill="#172033" paintOrder="stroke" stroke="white" strokeWidth={5/z}>{p.number}</text>
      {/* Area in sq.yd — only when selected */}
      {showArea && sqYd != null && <text x={c.x} y={c.y + 16/z} textAnchor="middle" dominantBaseline="middle" fontSize={14/z} fontWeight={700} pointerEvents="none" fill="#475569" paintOrder="stroke" stroke="white" strokeWidth={3/z}>{sqYd} sq.yd</text>}
      {/* Edge dimension labels — only for selected plot */}
      {active && (lm || wm) && sorted.map((e, i) => {
        const perpAngle = e.angle + 90;
        const px2 = e.mx + Math.cos(perpAngle*Math.PI/180)*offset;
        const py2 = e.my + Math.sin(perpAngle*Math.PI/180)*offset;
        // alternate sides to avoid overlap
        const px = i%2===0 ? px2 : e.mx - Math.cos(perpAngle*Math.PI/180)*offset;
        const py = i%2===0 ? py2 : e.my - Math.sin(perpAngle*Math.PI/180)*offset;
        // Use stored dims for the two longest edges; pixel length for others
        const isLong = i < 2;
        const storedDim = isLong ? (i===0 ? (lm && wm ? Math.max(lm,wm) : null) : (lm && wm ? Math.min(lm,wm) : null)) : null;
        const label = storedDim ? dimStr(storedDim) : dimStr(e.len * (lm && wm ? (lm+wm)/(2*edgeLenM(q[0],q[1])||1) : 1) || null);
        if (!label) return null;
        let rot = e.angle; if (rot > 90) rot -= 180; if (rot < -90) rot += 180;
        return <text key={i} x={px} y={py} textAnchor="middle" dominantBaseline="middle" fontSize={fs} fontWeight={800} pointerEvents="none" fill="#1e40af" paintOrder="stroke" stroke="rgba(255,255,255,.95)" strokeWidth={3/z} transform={`rotate(${rot},${px},${py})`}>{label}</text>;
      })}
    </>;
  }
  function importPlots(file: File) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const raw = JSON.parse(String(e.target?.result || "[]"));
        if (!Array.isArray(raw) || !raw.length) { setMessage("No plots found in file"); return; }
        const incoming: Plot[] = raw.map((item: any) => {
          const pts = parse(String(item.points || ""));
          const q = pts.length >= 3 ? pts : normalize([]);
          const c = center(q);
          return {
            id: item.id && /^[0-9a-f-]{36}$/i.test(item.id) ? item.id : crypto.randomUUID(),
            number: String(item.number || ""),
            status: item.status || "available",
            owner: item.owner || "",
            ownerId: item.ownerId || null,
            price: item.price ?? null,
            area: item.area ?? null,
            direction: item.direction || "",
            model: item.model || "",
            notes: item.notes || "",
            areaSqFt: item.areaSqFt ?? null,
            lengthM: item.lengthM ?? null,
            widthM: item.widthM ?? null,
            points: stringify(q),
            labelX: Number(item.labelX) || c.x,
            labelY: Number(item.labelY) || c.y,
            sectionId: item.sectionId || null,
            locked: true,
          };
        });
        let added = 0, updated = 0;
        setPlots(existing => {
          const byId = new Map(existing.map(p => [p.id, p]));
          const byNum = new Map(existing.map(p => [p.number, p]));
          for (const p of incoming) {
            if (byId.has(p.id)) {
              byId.set(p.id, { ...byId.get(p.id)!, ...p });
              updated++;
            } else if (byNum.has(p.number)) {
              const ex = byNum.get(p.number)!;
              byId.set(ex.id, { ...ex, ...p, id: ex.id });
              updated++;
            } else {
              byId.set(p.id, p);
              added++;
            }
          }
          return Array.from(byId.values());
        });
        setDirty(true);
        setMessage(`Import done: ${added} added, ${updated} updated`);
        if (importInput.current) importInput.current.value = "";
      } catch { setMessage("Invalid JSON file"); }
    };
    reader.readAsText(file);
  }

  function exportPlots() {
    const data = plots.map(p => ({
      id: p.id, number: p.number, status: p.status, area: p.area, areaSqFt: p.areaSqFt,
      lengthM: p.lengthM, widthM: p.widthM, price: p.price, model: p.model, notes: p.notes,
      owner: p.owner, ownerId: p.ownerId, direction: p.direction,
      points: p.points, labelX: p.labelX, labelY: p.labelY,
      geometrySource: "manual", sectionId: p.sectionId,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${projectSlug}-plots.json`; a.click();
    URL.revokeObjectURL(url);
    setMessage(`Exported ${plots.length} plots`);
  }
  function layerChange(kind: "map" | "drone", patch: Partial<Layer>) { setLayers(v => ({ ...v, [kind]: { ...v[kind], ...patch } })); setDirty(true); }
  function removePlot() { if (!selectedPlot) return; setPlots(v => v.filter(p => p.id !== selectedPlot.id)); setSelected(null); setDirty(true); setMessage("Plot deleted"); }
  async function addOwner() { const name = ownerName.trim(); if (!name) return; try { const r = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/owners`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email: ownerEmail, phone: ownerPhone }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "Unable to add owner"); setOwners(v => [...v, d.owner].sort((a: Owner, b: Owner) => a.name.localeCompare(b.name))); setOwnerName(""); setOwnerEmail(""); setOwnerPhone(""); setMessage("Owner added"); } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to add owner"); } }
  async function deleteOwner(id: string) { try { const r = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/owners`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "Unable to delete owner"); setOwners(v => v.filter(o => o.id !== id)); setPlots(v => v.map(p => p.ownerId === id ? { ...p, ownerId: null, owner: "" } : p)); setDirty(true); setMessage("Owner removed"); } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to remove owner"); } }


  const image = (kind: "map" | "drone") => { const src = asset(kind); if (!src || !layers[kind].visible) return null; const l = layers[kind]; return <image key={kind} href={src} x={l.x} y={l.y} width={l.width} height={l.height} opacity={l.opacity} preserveAspectRatio="none" pointerEvents="none" />; };
  const renderShapeControls = (q: Point[], id: string, sectionShape: boolean) => q.length === 8 ? q.map((p, i) => <circle key={`point-${i}`} cx={p.x} cy={p.y} r={9 / zoom} fill="white" stroke={sectionShape ? "#7c3aed" : "#1d4ed8"} strokeWidth={3 / zoom} style={{ cursor: "move" }} onPointerDown={e => startPoint(e, id, i, q, sectionShape)} />) : q.map((a, i) => { const b = q[(i + 1) % q.length]; return <line key={`edge-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={22 / zoom} strokeLinecap="round" pointerEvents="stroke" style={{ cursor: i % 2 === 0 ? "ns-resize" : "ew-resize" }} onPointerDown={e => startEdge(e, id, i, q, sectionShape)} />; });

  return <div style={{ height: "100%", display: "grid", gridTemplateRows: "1fr", background: "#f4f6f9", color: "#182235", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>
    <div style={{ display: "grid", gridTemplateColumns: "290px minmax(0,1fr) 330px", minHeight: 0 }}>
      <aside style={{ background: "#fff", borderRight: "1px solid #e2e8f0", padding: 12, overflow: "auto" }}>
        <button type="button" onClick={() => { setPlanId("master_plan"); deselect(); }} style={{ ...button, width: "100%", justifyContent: "flex-start", background: planId === "master_plan" ? "#eef2ff" : "#fff", borderColor: planId === "master_plan" ? "#c7d2fe" : "#e2e8f0" }}>▦ <span>Master Plan</span></button>
        <div style={{ margin: "18px 0 7px", fontSize: 10, letterSpacing: 1, fontWeight: 900, color: "#7b8798" }}>PLOTS</div><div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 6 }}><button type="button" onClick={addPlot} style={{ ...button, background: "#172554", color: "#fff", borderColor: "#172554" }}><Plus size={14} /> Add Plot</button><button type="button" title="Import plots from JSON (merges existing)" onClick={() => importInput.current?.click()} style={{ ...button, padding: "8px 10px" }}><FileJson size={14} /></button><button type="button" title="Export plots to JSON" onClick={exportPlots} style={{ ...button, padding: "8px 10px" }}><Download size={14} /></button></div><input ref={importInput} hidden type="file" accept=".json,application/json" onChange={e => { const f = e.target.files?.[0]; if (f) importPlots(f); }} /><select aria-label="Select a plot" value={selected || ""} onChange={e => choosePlot(e.target.value)} style={{ ...input, marginTop: 7 }}><option value="">Select a plot…</option>{plots.slice().sort((a, b) => Number(a.number) - Number(b.number)).map(p => <option key={p.id} value={p.id}>Plot {p.number} {p.sectionId ? `— ${plans.find(s => s.id === p.sectionId)?.name || "Section"}` : "— Master Plan"}</option>)}</select>
        <div style={{ margin: "18px 0 7px", fontSize: 10, letterSpacing: 1, fontWeight: 900, color: "#7b8798" }}>OWNERS</div><button type="button" onClick={() => setOwnersOpen(v => !v)} style={{ ...button, width: "100%", justifyContent: "space-between" }}><span><UserPlus size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />Manage Owners</span><span>{owners.length}</span></button>{ownersOpen && <div style={{ ...card, marginTop: 7 }}><input placeholder="Owner name" value={ownerName} onChange={e => setOwnerName(e.target.value)} style={{ ...input, marginBottom: 6 }} /><input placeholder="Email (optional)" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} style={{ ...input, marginBottom: 6 }} /><input placeholder="Phone (optional)" value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)} style={{ ...input, marginBottom: 7 }} /><button type="button" onClick={() => void addOwner()} style={{ ...button, width: "100%", background: "#172554", color: "#fff", borderColor: "#172554" }}><Plus size={13} /> Add owner</button><div style={{ marginTop: 9, display: "grid", gap: 5 }}>{owners.map(o => <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 0", borderTop: "1px solid #eef2f6" }}><div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 12, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name}</div><div style={{ fontSize: 10, color: "#64748b" }}>{plots.filter(p => p.ownerId === o.id).length} plot(s)</div></div><button type="button" title="Remove owner" onClick={() => void deleteOwner(o.id)} style={{ ...button, padding: 5, color: "#b91c1c" }}><Trash2 size={12} /></button></div>)}</div></div>}
        <div style={{ margin: "18px 0 7px", fontSize: 10, letterSpacing: 1, fontWeight: 900, color: "#7b8798" }}>SECTIONS</div><button type="button" onClick={() => void addSection()} style={{ ...button, width: "100%" }}><Plus size={14} /> Add Section</button><div style={{ display: "grid", gap: 6, marginTop: 7 }}>{sectionList.map(s => { const v = visibility[s.id] || emptyVisibility(); return <div key={s.id} style={{ display: "flex", gap: 5 }}><button type="button" onClick={() => selectSection(s.id)} style={{ ...button, flex: 1, justifyContent: "flex-start", background: selectedSection === s.id ? "#eef2ff" : "#fff", borderColor: selectedSection === s.id ? "#c7d2fe" : "#e2e8f0", opacity: v.hidden ? .55 : 1 }}>{v.hidden ? <EyeOff size={13} /> : <Eye size={13} />}<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span></button><button type="button" title="Hide/show section" onClick={() => toggleSectionVisibility(s.id, "hidden")} style={{ ...button, padding: 8 }}>{v.hidden ? <EyeOff size={13} /> : <Eye size={13} />}</button></div>; })}</div>
        <div style={{ margin: "18px 0 7px", fontSize: 10, letterSpacing: 1, fontWeight: 900, color: "#7b8798" }}>MAP / DRONE</div>{["map", "drone"].map(k => <div key={k} style={{ ...card, marginTop: 6 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, fontWeight: 800 }}><span>{k === "map" ? "Master plan" : "Drone image"}</span><button type="button" onClick={() => layerChange(k as "map" | "drone", { visible: !layers[k as "map" | "drone"].visible })} style={{ ...button, padding: 5 }}>{layers[k as "map" | "drone"].visible ? <Eye size={13} /> : <EyeOff size={13} />}</button></div><div style={{ display: "flex", gap: 7, alignItems: "center", marginTop: 8 }}><span style={{ fontSize: 10, color: "#64748b" }}>Opacity</span><input aria-label={`${k} opacity`} type="range" min="0" max="1" step=".05" value={layers[k as "map" | "drone"].opacity} onChange={e => layerChange(k as "map" | "drone", { opacity: Number(e.target.value) })} style={{ flex: 1 }} /></div><button type="button" style={{ ...button, width: "100%", marginTop: 8 }} onClick={() => (k === "map" ? mapInput.current?.click() : droneInput.current?.click())}><Upload size={13} /> {uploading === k ? "Uploading…" : `Upload ${k}`}</button></div>)}<input ref={mapInput} hidden type="file" accept="image/*,.svg" onChange={e => { const f = e.target.files?.[0]; if (f) void upload("map", f); e.currentTarget.value = ""; }} /><input ref={droneInput} hidden type="file" accept="image/*,.svg" onChange={e => { const f = e.target.files?.[0]; if (f) void upload("drone", f); e.currentTarget.value = ""; }} />
      </aside>
      <main style={{ position: "relative", minWidth: 0, background: "#d9dee5", overflow: "hidden" }}><div style={{ position: "absolute", zIndex: 5, top: 12, left: 12, right: 12, display: "flex", alignItems: "center", gap: 6, padding: 8, border: "1px solid rgba(226,232,240,.9)", borderRadius: 10, background: "rgba(255,255,255,.96)", boxShadow: "0 4px 16px rgba(15,23,42,.08)" }}><span style={{ fontSize: 11, fontWeight: 900, color: "#475569", marginRight: 3 }}>CANVAS</span><button type="button" onClick={() => setZoom(z => Math.min(8, +(z * 1.25).toFixed(2)))} style={{ ...button, padding: 7 }}><Plus size={14} /></button><span style={{ width: 48, textAlign: "center", fontSize: 12, fontWeight: 800 }}>{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom(z => Math.max(.25, +(z / 1.25).toFixed(2)))} style={{ ...button, padding: 7 }}><Minus size={14} /></button><button type="button" onClick={resetView} style={button}>Fit</button><button type="button" onClick={() => void save()} disabled={!dirty || busy} style={{ ...button, marginLeft: 2, background: dirty && !busy ? "#172554" : "#eef2f7", color: dirty && !busy ? "#fff" : "#94a3b8", borderColor: dirty && !busy ? "#172554" : "#e2e8f0", cursor: dirty && !busy ? "pointer" : "default" }}><Save size={14} /> Save</button><span style={{ marginLeft: "auto", color: "#64748b", fontSize: 11 }}>Drag shape to move · {shapeMode === "polygon" ? "drag points to reshape" : "drag sides to resize"}</span></div><svg ref={svgRef} viewBox={viewBox} preserveAspectRatio="xMinYMin meet" onPointerDown={startCanvasPan} onPointerMove={move} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none", cursor: drag?.kind === "pan" ? "grabbing" : "grab" }}>{image("drone")}{image("map")}{sectionList.map(s => { const v = visibility[s.id] || emptyVisibility(); if (v.hidden) return null; const q = normalize(parse(sections[s.id] || "")), c = center(q), active = selectedSection === s.id; return <g key={s.id} opacity={.78}><polygon points={stringify(q)} fill={active ? "rgba(124,58,237,.18)" : "rgba(124,58,237,.07)"} stroke={active ? "#7c3aed" : "#64748b"} strokeWidth={active ? 4 : 2} onPointerDown={e => startShape(e, s.id, q, true)} />{active && renderShapeControls(q, s.id, true)}<text x={c.x} y={c.y} textAnchor="middle" dominantBaseline="middle" fontSize={24} fontWeight={800} pointerEvents="none" fill="#172033" paintOrder="stroke" stroke="white" strokeWidth={5}>{s.name}</text></g>; })}{visiblePlots.map(p => { const q = normalize(parse(p.points)), active = selected === p.id, inMulti = selectedIds.has(p.id) && !active, c = center(q); return <g key={p.id}><polygon points={stringify(q)} fill={active ? "rgba(37,99,235,.30)" : inMulti ? "rgba(37,99,235,.20)" : "rgba(37,99,235,.11)"} stroke={active ? "#1d4ed8" : inMulti ? "#3b82f6" : "#334155"} strokeWidth={active ? 4 : inMulti ? 3 : 2} onPointerDown={e => startShape(e, p.id, q, false)} style={{ cursor: p.locked ? "default" : undefined }} />{active && !p.locked && renderShapeControls(q, p.id, false)}{renderPlotAnnotations(q, p, zoom, active)}</g>; })}</svg>{!asset("map") && !asset("drone") && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#64748b", pointerEvents: "none", fontSize: 13 }}>Upload a master plan or drone image to begin.</div>}</main>
      <aside style={{ background: "#fff", borderLeft: "1px solid #e2e8f0", padding: 14, overflow: "auto" }}>{selectedIds.size > 1 ? <div><div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}><div><div style={{ fontSize: 10, letterSpacing: 1, fontWeight: 900, color: "#64748b" }}>MULTI-SELECT</div><h3 style={{ margin: "3px 0 0", fontSize: 20 }}>{selectedIds.size} Plots Selected</h3><div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>Hold Ctrl and click to add/remove plots</div></div><button type="button" onClick={deselect} style={{ ...button, padding: 6 }}><X size={14} /></button></div><label style={{ display: "block", marginTop: 16, fontSize: 11, fontWeight: 800, color: "#475569" }}>Set Status<select defaultValue="" onChange={e => { if (e.target.value) updateMulti("status", e.target.value); }} style={{ ...input, marginTop: 5 }}><option value="" disabled>— apply to all —</option><option value="available">Available</option><option value="reserved">Reserved</option><option value="sold">Sold</option><option value="hold">Hold</option></select></label><label style={{ display: "block", marginTop: 11, fontSize: 11, fontWeight: 800, color: "#475569" }}>Set Owner<select defaultValue="" onChange={e => { if (e.target.value !== "__none__") updateMulti("ownerId", e.target.value === "__none__" ? "" : e.target.value); else updateMulti("ownerId", ""); }} style={{ ...input, marginTop: 5 }}><option value="" disabled>— apply to all —</option><option value="__none__">Unassigned</option>{owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label><label style={{ display: "block", marginTop: 11, fontSize: 11, fontWeight: 800, color: "#475569" }}>Set Section<select defaultValue="" onChange={e => { if (e.target.value !== "__unchanged__") updateMulti("sectionId", e.target.value === "__master__" ? "" : e.target.value); }} style={{ ...input, marginTop: 5 }}><option value="" disabled>— apply to all —</option><option value="__master__">Master Plan</option>{sectionList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><div style={{ marginTop: 16, padding: "10px 12px", borderRadius: 9, background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: 12, color: "#64748b" }}>Drag any selected plot to move all {selectedIds.size} together.</div><button type="button" onClick={deleteMulti} style={{ ...button, width: "100%", marginTop: 16, color: "#b91c1c", borderColor: "#fecaca", background: "#fff7f7" }}><Trash2 size={14} /> Delete {selectedIds.size} plots</button></div> : selectedPlot ? <div><div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}><div><div style={{ fontSize: 10, letterSpacing: 1, fontWeight: 900, color: "#64748b" }}>SELECTED PLOT</div><h3 style={{ margin: "3px 0 0", fontSize: 20 }}>Plot {selectedPlot.number}</h3></div><button type="button" onClick={deselect} style={{ ...button, padding: 6 }}><X size={14} /></button></div><div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 8, background: selectedPlot.locked ? "#fff7ed" : "#f0fdf4", border: `1px solid ${selectedPlot.locked ? "#fed7aa" : "#bbf7d0"}` }}><div><div style={{ fontSize: 12, fontWeight: 800, color: selectedPlot.locked ? "#9a3412" : "#166534" }}>{selectedPlot.locked ? "🔒 Locked" : "🔓 Unlocked"}</div><div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{selectedPlot.locked ? "Unlock to move or edit" : "Can be moved and edited freely"}</div></div><button type="button" onClick={() => toggleLock(selectedPlot.id)} style={{ ...button, padding: "6px 12px", background: selectedPlot.locked ? "#fff" : "#16a34a", color: selectedPlot.locked ? "#9a3412" : "#fff", borderColor: selectedPlot.locked ? "#fed7aa" : "#16a34a", fontWeight: 800 }}>{selectedPlot.locked ? "Unlock" : "Lock"}</button></div><div style={{ ...card, marginTop: 12, padding: 8, opacity: selectedPlot.locked ? 0.45 : 1, pointerEvents: selectedPlot.locked ? "none" : "auto" }}><div style={{ fontSize: 10, fontWeight: 900, color: "#64748b", marginBottom: 6 }}>SHAPE</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}><button type="button" onClick={() => convertSelected("rectangle")} style={{ ...button, background: shapeMode === "rectangle" ? "#172554" : "#fff", color: shapeMode === "rectangle" ? "#fff" : "#243047" }}>Rectangle · 4 sides</button><button type="button" onClick={() => convertSelected("polygon")} style={{ ...button, background: shapeMode === "polygon" ? "#172554" : "#fff", color: shapeMode === "polygon" ? "#fff" : "#243047" }}>Polygon · 8 points</button></div></div><button type="button" onClick={duplicatePlot} disabled={!!selectedPlot.locked} style={{ ...button, width: "100%", marginTop: 8, opacity: selectedPlot.locked ? 0.45 : 1 }}><Copy size={14} /> Duplicate plot</button><label style={{ display: "block", marginTop: 11, fontSize: 11, fontWeight: 800, color: selectedPlot.locked ? "#94a3b8" : "#475569" }}>Plot Number<input value={selectedPlot.number} onChange={e => !selectedPlot.locked && updatePlot("number", e.target.value)} readOnly={selectedPlot.locked} style={{ ...input, marginTop: 5, background: selectedPlot.locked ? "#f8fafc" : "#fff", color: selectedPlot.locked ? "#94a3b8" : "#172033" }} /></label><label style={{ display: "block", marginTop: 11, fontSize: 11, fontWeight: 800, color: selectedPlot.locked ? "#94a3b8" : "#475569" }}>Owner<select value={selectedPlot.ownerId || ""} onChange={e => !selectedPlot.locked && updatePlot("ownerId", e.target.value)} disabled={selectedPlot.locked} style={{ ...input, marginTop: 5, background: selectedPlot.locked ? "#f8fafc" : "#fff", color: selectedPlot.locked ? "#94a3b8" : "#172033" }}><option value="">Unassigned</option>{owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
{/* Dimension calculator */}
<div style={{ ...card, marginTop: 12, padding: 10, opacity: selectedPlot.locked ? 0.55 : 1, pointerEvents: selectedPlot.locked ? "none" : "auto" }}>
  <div style={{ fontSize: 10, fontWeight: 900, color: "#64748b", marginBottom: 8 }}>DIMENSIONS & AREA</div>
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 6, alignItems: "end" }}>
    <label style={{ fontSize: 11, fontWeight: 800, color: "#475569" }}>Length
      <input type="number" min="0" step="0.01"
        value={dimUnit === "m" ? (selectedPlot.lengthM ?? "") : dimUnit === "ft" ? (selectedPlot.lengthM ? +(selectedPlot.lengthM * 3.28084).toFixed(3) : "") : (selectedPlot.lengthM ? +(selectedPlot.lengthM * 1.09361).toFixed(3) : "")}
        onChange={e => {
          const v = parseFloat(e.target.value);
          if (isNaN(v)) { updatePlot("lengthM", null); return; }
          const m = dimUnit === "m" ? v : dimUnit === "ft" ? v / 3.28084 : v / 1.09361;
          const lm = +m.toFixed(4);
          updatePlot("lengthM", lm);
          const wm = selectedPlot.widthM ?? 0;
          if (wm) {
            const sqm = lm * wm;
            updatePlot("area", +( sqm * 1.196).toFixed(2));
            updatePlot("areaSqFt", +(sqm * 10.764).toFixed(2));
          }
        }}
        style={{ ...input, marginTop: 4 }} />
    </label>
    <label style={{ fontSize: 11, fontWeight: 800, color: "#475569" }}>Width
      <input type="number" min="0" step="0.01"
        value={dimUnit === "m" ? (selectedPlot.widthM ?? "") : dimUnit === "ft" ? (selectedPlot.widthM ? +(selectedPlot.widthM * 3.28084).toFixed(3) : "") : (selectedPlot.widthM ? +(selectedPlot.widthM * 1.09361).toFixed(3) : "")}
        onChange={e => {
          const v = parseFloat(e.target.value);
          if (isNaN(v)) { updatePlot("widthM", null); return; }
          const m = dimUnit === "m" ? v : dimUnit === "ft" ? v / 3.28084 : v / 1.09361;
          const wm = +m.toFixed(4);
          updatePlot("widthM", wm);
          const lm = selectedPlot.lengthM ?? 0;
          if (lm) {
            const sqm = lm * wm;
            updatePlot("area", +(sqm * 1.196).toFixed(2));
            updatePlot("areaSqFt", +(sqm * 10.764).toFixed(2));
          }
        }}
        style={{ ...input, marginTop: 4 }} />
    </label>
    <select value={dimUnit} onChange={e => setDimUnit(e.target.value as "m"|"ft"|"yd")} style={{ ...input, padding: "9px 6px", marginTop: 4 }}>
      <option value="m">m</option>
      <option value="ft">ft</option>
      <option value="yd">yd</option>
    </select>
  </div>
  {selectedPlot.lengthM && selectedPlot.widthM ? (
    <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 8, background: "#f0f9ff", border: "1px solid #bae6fd", fontSize: 12 }}>
      <div style={{ fontWeight: 900, color: "#0369a1", marginBottom: 4 }}>AREA CALCULATION</div>
      <div style={{ color: "#334155" }}>{selectedPlot.lengthM}m × {selectedPlot.widthM}m = <b>{+(selectedPlot.lengthM * selectedPlot.widthM).toFixed(2)} sq.m</b></div>
      <div style={{ color: "#334155", marginTop: 2 }}><b style={{ color: "#172554" }}>{selectedPlot.area ?? 0} sq.yd</b> · {selectedPlot.areaSqFt ?? 0} sq.ft</div>
      <div style={{ color: "#64748b", fontSize: 10, marginTop: 4 }}>sq.yd = sq.m × 1.196 · sq.ft = sq.m × 10.764</div>
    </div>
  ) : null}
</div>
<label style={{ display: "block", marginTop: 11, fontSize: 11, fontWeight: 800, color: selectedPlot.locked ? "#94a3b8" : "#475569" }}>Price
  <input value={String(selectedPlot.price ?? "")} readOnly={selectedPlot.locked} onChange={e => !selectedPlot.locked && updatePlot("price", e.target.value)} style={{ ...input, marginTop: 5, background: selectedPlot.locked ? "#f8fafc" : "#fff", color: selectedPlot.locked ? "#94a3b8" : "#172033" }} />
</label>
<label style={{ display: "block", marginTop: 11, fontSize: 11, fontWeight: 800, color: selectedPlot.locked ? "#94a3b8" : "#475569" }}>Direction
  <input value={selectedPlot.direction} readOnly={selectedPlot.locked} onChange={e => !selectedPlot.locked && updatePlot("direction", e.target.value)} style={{ ...input, marginTop: 5, background: selectedPlot.locked ? "#f8fafc" : "#fff", color: selectedPlot.locked ? "#94a3b8" : "#172033" }} />
</label>
<label style={{ display: "block", marginTop: 11, fontSize: 11, fontWeight: 800, color: selectedPlot.locked ? "#94a3b8" : "#475569" }}>Notes
  <input value={selectedPlot.notes} readOnly={selectedPlot.locked} onChange={e => !selectedPlot.locked && updatePlot("notes", e.target.value)} style={{ ...input, marginTop: 5, background: selectedPlot.locked ? "#f8fafc" : "#fff", color: selectedPlot.locked ? "#94a3b8" : "#172033" }} />
</label><label style={{ display: "block", marginTop: 11, fontSize: 11, fontWeight: 800, color: selectedPlot.locked ? "#94a3b8" : "#475569" }}>Section<select value={selectedPlot.sectionId || ""} disabled={selectedPlot.locked} onChange={e => !selectedPlot.locked && updatePlot("sectionId", e.target.value)} style={{ ...input, marginTop: 5, background: selectedPlot.locked ? "#f8fafc" : "#fff" }}><option value="">Master Plan</option>{sectionList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label style={{ display: "block", marginTop: 11, fontSize: 11, fontWeight: 800, color: selectedPlot.locked ? "#94a3b8" : "#475569" }}>Status<select value={selectedPlot.status} disabled={selectedPlot.locked} onChange={e => !selectedPlot.locked && updatePlot("status", e.target.value)} style={{ ...input, marginTop: 5, background: selectedPlot.locked ? "#f8fafc" : "#fff" }}><option>available</option><option>reserved</option><option>sold</option><option>hold</option></select></label>{!selectedPlot.locked && <button type="button" onClick={() => setConfirm({ kind: "plot", id: selectedPlot.id, label: `Plot ${selectedPlot.number}` })} style={{ ...button, width: "100%", marginTop: 18, color: "#b91c1c", borderColor: "#fecaca", background: "#fff7f7" }}><Trash2 size={14} /> Delete plot</button>}</div> : selectedSection ? <div><div style={{ fontSize: 10, letterSpacing: 1, fontWeight: 900, color: "#64748b" }}>SELECTED SECTION</div><h3 style={{ margin: "3px 0 0", fontSize: 20 }}>{section?.name || "Section"}</h3><label style={{ display: "block", marginTop: 14, fontSize: 11, fontWeight: 800, color: "#475569" }}>Section name<input value={section?.name || ""} onChange={e => renamePlan(selectedSection, e.target.value)} style={{ ...input, marginTop: 5 }} /></label><div style={{ ...card, marginTop: 12 }}><div style={{ fontSize: 10, letterSpacing: .7, fontWeight: 900, color: "#64748b", marginBottom: 8 }}>SECTION VISIBILITY</div><label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 12, fontWeight: 700, padding: "7px 0" }}><span>Hide section</span><input type="checkbox" checked={Boolean(visibility[selectedSection]?.hidden)} onChange={() => toggleSectionVisibility(selectedSection, "hidden")} /></label><div style={{ fontSize: 10, color: "#64748b", marginTop: -2 }}>Hides only the section boundary and name.</div><label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 12, fontWeight: 700, padding: "12px 0 7px" }}><span>Hide plots in section</span><input type="checkbox" checked={Boolean(visibility[selectedSection]?.plotsHidden)} onChange={() => toggleSectionVisibility(selectedSection, "plotsHidden")} /></label><div style={{ fontSize: 10, color: "#64748b" }}>Plots assigned to this section are hidden too.</div></div><div style={{ ...card, marginTop: 12 }}><div style={{ fontSize: 10, fontWeight: 900, color: "#64748b", marginBottom: 6 }}>SHAPE</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}><button type="button" onClick={() => convertSelected("rectangle")} style={{ ...button, background: shapeMode === "rectangle" ? "#172554" : "#fff", color: shapeMode === "rectangle" ? "#fff" : "#243047" }}>Rectangle · 4 sides</button><button type="button" onClick={() => convertSelected("polygon")} style={{ ...button, background: shapeMode === "polygon" ? "#172554" : "#fff", color: shapeMode === "polygon" ? "#fff" : "#243047" }}>Polygon · 8 points</button></div></div><button type="button" onClick={() => setConfirm({ kind: "section", id: selectedSection, label: section?.name || selectedSection })} style={{ ...button, width: "100%", marginTop: 18, color: "#b91c1c", borderColor: "#fecaca", background: "#fff7f7" }}><Trash2 size={14} /> Delete section</button></div> : <div style={{ padding: "20px 4px", color: "#64748b" }}><div style={{ fontWeight: 800, color: "#334155", marginBottom: 5 }}>Nothing selected</div>Select a plot or section on the canvas or from the left panel.</div>}</aside>
    </div>
    {confirm && <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "grid", placeItems: "center", background: "rgba(15,23,42,.45)" }}><div style={{ width: 380, maxWidth: "calc(100vw - 32px)", background: "#fff", borderRadius: 14, padding: 22 }}><h3 style={{ margin: 0, fontSize: 18 }}>Delete {confirm.kind}?</h3><p style={{ color: "#64748b", fontSize: 13 }}>Are you sure you want to delete <b>{confirm.label}</b>?</p><div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button type="button" onClick={() => setConfirm(null)} style={button}>Cancel</button><button type="button" onClick={() => confirm.kind === "section" ? void deleteSection(confirm.id) : (removePlot(), setConfirm(null))} style={{ ...button, background: "#b91c1c", color: "#fff", borderColor: "#b91c1c" }}>Delete</button></div></div></div>}
  </div>;
}
