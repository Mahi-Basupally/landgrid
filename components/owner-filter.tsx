'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Download, FileText, Maximize2, Minimize2, Users } from 'lucide-react';

type Owner = { id: string; name: string; plotNumbers: string[]; color?: string | null };
type Lot = { id: string; number: string; ownerId?: string | null; points: string; area?: number | null };
type Palette = { base: string; light: string; dark: string };

const paletteFor = (i: number): Palette => { const h = Math.round((i * 137.508) % 360); return { base: `hsl(${h} 78% 52%)`, light: `hsl(${h} 88% 82%)`, dark: `hsl(${h} 82% 34%)` }; };
const hexToPalette = (hex: string): Palette => { const m = /^#([0-9a-f]{6})$/i.exec(hex); if (!m) return { base: '#2563eb', light: '#bfdbfe', dark: '#1d4ed8' }; const n = parseInt(m[1], 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return { base: hex.toUpperCase(), light: `rgb(${Math.min(255, r + 90)},${Math.min(255, g + 90)},${Math.min(255, b + 90)})`, dark: `rgb(${Math.round(r * .65)},${Math.round(g * .65)},${Math.round(b * .65)})` }; };
const lotCenter = (points: string) => { const p = points.trim().split(/\s+/).map(v => v.split(',').map(Number)).filter(v => Number.isFinite(v[0]) && Number.isFinite(v[1])); return p.length ? { x: p.reduce((s, v) => s + v[0], 0) / p.length, y: p.reduce((s, v) => s + v[1], 0) / p.length } : null; };
const fmtYards = (v: number | null | undefined) => v != null && Number.isFinite(Number(v)) ? Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—';
const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;');

export default function OwnerFilter({ projectSlug }: { projectSlug: string }) {
  const [owners, setOwners] = useState<Owner[]>([]), [lots, setLots] = useState<Lot[]>([]), [selected, setSelected] = useState<Set<string>>(new Set()), [open, setOpen] = useState(true), [loading, setLoading] = useState(true), [exporting, setExporting] = useState<'image' | 'pdf' | null>(null), [focusMode, setFocusMode] = useState(false);
  const originalPvStyles = useRef<{ cssText: string; bodyOverflow: string; htmlOverflow: string } | null>(null);

  useEffect(() => {
    let cancelled = false; setLoading(true);
    fetch(`/api/projects/${encodeURIComponent(projectSlug)}/plan`, { cache: 'no-store' }).then(r => r.json()).then(d => {
      if (cancelled) return;
      const rawOwners = d.owners || d.project_owners || [], byId = new Map<string, Owner>();
      rawOwners.forEach((o: any) => byId.set(String(o.id), { id: String(o.id), name: String(o.name || 'Unnamed owner'), plotNumbers: [], color: o.color || null }));
      const rawLots: Lot[] = (d.lots || d.plots || []).map((l: any) => ({ id: String(l.id), number: String(l.number ?? l.plot_number ?? ''), ownerId: l.ownerId != null ? String(l.ownerId) : (l.owner_id != null ? String(l.owner_id) : null), area: l.area != null ? Number(l.area) : (l.area_sq_yards != null ? Number(l.area_sq_yards) : null), points: typeof l.points === 'string' ? l.points : String(l.points || l.geometry?.points || '') }));
      const map = new Map<string, Owner>();
      rawLots.forEach(l => { if (!l.ownerId) return; const o = byId.get(l.ownerId); if (!o) return; const cur = map.get(o.id) || { ...o, plotNumbers: [] }; cur.plotNumbers.push(l.number); map.set(o.id, cur); });
      setLots(rawLots); setOwners([...map.values()].sort((a, b) => a.name.localeCompare(b.name)));
    }).catch(() => { if (!cancelled) { setOwners([]); setLots([]); } }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectSlug]);

  const colorByOwner = useMemo(() => { const m = new Map<string, Palette>(); owners.forEach((o, i) => m.set(o.id, o.color ? hexToPalette(o.color) : paletteFor(i))); return m; }, [owners]);

  useEffect(() => {
    let disposed = false, timer = 0, raf = 0; let observer: MutationObserver | null = null;
    const findPolygon = (svg: SVGSVGElement, lot: Lot) => { const wanted = lot.number.trim(); if (!wanted) return null; for (const t of Array.from(svg.querySelectorAll('text')) as SVGTextElement[]) { if ((t.textContent || '').trim() !== wanted || t.hasAttribute('data-owner-yard-label')) continue; const p = t.closest('g')?.querySelector('polygon') as SVGPolygonElement | null; if (p) return p; } return null; };
    const apply = () => {
      if (disposed) return;
      const svg = (Array.from(document.querySelectorAll('.pv-canvas svg')) as SVGSVGElement[]).find(s => s.querySelector('polygon'));
      const canvas = document.querySelector('.pv-canvas');
      if (!svg || !lots.length || !canvas) { timer = window.setTimeout(apply, 100); return; }
      const polys = new Map<string, SVGPolygonElement>(); lots.forEach(l => { const p = findPolygon(svg, l); if (p) polys.set(l.id, p); });
      observer?.disconnect(); polys.forEach(p => ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'filter'].forEach(k => p.style.removeProperty(k))); svg.querySelectorAll('[data-owner-yard-label]').forEach(e => e.remove());
      selected.forEach(ownerId => {
        const pal = colorByOwner.get(ownerId) || paletteFor(0);
        lots.filter(l => String(l.ownerId) === ownerId).forEach(lot => {
          const p = polys.get(lot.id); if (!p) return;
          p.style.setProperty('fill', pal.base, 'important'); p.style.setProperty('fill-opacity', '.90', 'important'); p.style.setProperty('stroke', '#fff', 'important'); p.style.setProperty('stroke-width', '5', 'important'); p.style.setProperty('filter', `drop-shadow(0 0 6px ${pal.base})`, 'important');
          const c = lotCenter(lot.points); if (!c || lot.area == null) return;
          const label = document.createElementNS('http://www.w3.org/2000/svg', 'text'); label.setAttribute('data-owner-yard-label', 'true'); label.setAttribute('x', String(c.x)); label.setAttribute('y', String(c.y + 18)); label.setAttribute('text-anchor', 'middle'); label.setAttribute('dominant-baseline', 'middle'); label.setAttribute('font-size', '13'); label.setAttribute('font-weight', '800'); label.setAttribute('pointer-events', 'none'); label.setAttribute('fill', '#172033'); label.setAttribute('paint-order', 'stroke'); label.setAttribute('stroke', 'white'); label.setAttribute('stroke-width', '4'); label.textContent = `${fmtYards(lot.area)} sq.yd`; p.parentElement?.appendChild(label);
        });
      });
      observer?.observe(canvas, { childList: true, subtree: true });
    };
    const schedule = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; apply(); }); };
    const canvas = document.querySelector('.pv-canvas'); observer = canvas ? new MutationObserver(ms => { const onlyLabels = ms.length > 0 && ms.every(m => [...m.addedNodes, ...m.removedNodes].every(n => (n as Element).nodeType !== 1 || (n as Element).hasAttribute?.('data-owner-yard-label'))); if (!onlyLabels) schedule(); }) : null; observer?.observe(canvas!, { childList: true, subtree: true }); schedule();
    return () => { disposed = true; observer?.disconnect(); if (raf) cancelAnimationFrame(raf); if (timer) clearTimeout(timer); };
  }, [lots, selected, colorByOwner]);

  useEffect(() => {
    const pv = document.querySelector('.pv') as HTMLElement | null, body = document.body, html = document.documentElement;
    if (!pv) return;
    if (!originalPvStyles.current) originalPvStyles.current = { cssText: pv.style.cssText, bodyOverflow: body.style.overflow, htmlOverflow: html.style.overflow };
    if (focusMode) {
      pv.style.position = 'fixed'; pv.style.top = '0'; pv.style.right = '0'; pv.style.bottom = '0'; pv.style.left = '0'; pv.style.width = '100vw'; pv.style.height = '100vh'; pv.style.minHeight = '100vh'; pv.style.margin = '0'; pv.style.padding = '0'; pv.style.border = '0'; pv.style.borderRadius = '0'; pv.style.boxShadow = 'none'; pv.style.zIndex = '9990'; pv.style.overflow = 'hidden';
      body.style.overflow = 'hidden'; html.style.overflow = 'hidden';
    } else {
      const original = originalPvStyles.current; if (original) { pv.style.cssText = original.cssText; body.style.overflow = original.bodyOverflow; html.style.overflow = original.htmlOverflow; originalPvStyles.current = null; }
    }
    return () => { if (focusMode) { const original = originalPvStyles.current; if (original && document.contains(pv)) { pv.style.cssText = original.cssText; body.style.overflow = original.bodyOverflow; html.style.overflow = original.htmlOverflow; } } };
  }, [focusMode]);

  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && focusMode) { e.preventDefault(); setFocusMode(false); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [focusMode]);

  const toggle = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clear = () => setSelected(new Set());
  const selectedSummary = useMemo(() => owners.filter(o => selected.has(o.id)).map(owner => { const ownerLots = lots.filter(l => String(l.ownerId) === owner.id); return { owner, ownerLots, totalYards: ownerLots.reduce((s, l) => s + (Number.isFinite(Number(l.area)) ? Number(l.area) : 0), 0) }; }), [owners, lots, selected]);
  const selectedPlotCount = selectedSummary.reduce((s, x) => s + x.ownerLots.length, 0), selectedYards = selectedSummary.reduce((s, x) => s + x.totalYards, 0);

  async function changeColor(id: string, color: string) { const c = /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : color; setOwners(os => os.map(o => o.id === id ? { ...o, color: c } : o)); try { await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/owners`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, color: c }) }); } catch {} }

  function getMapSvg() {
    const source = (Array.from(document.querySelectorAll('.pv-canvas svg')) as SVGSVGElement[]).find(s => s.querySelector('polygon'));
    if (!source) throw new Error('Map is not ready');
    const vb = (source.getAttribute('viewBox') || '').trim().split(/[ ,]+/).map(Number), viewBox = vb.length === 4 && vb.every(Number.isFinite) ? vb : [0, 0, Math.max(1, source.clientWidth), Math.max(1, source.clientHeight)];
    const [vx, vy, vw, vh] = viewBox;
    const output = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); output.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); output.setAttribute('viewBox', viewBox.join(' ')); output.setAttribute('width', '2400'); output.setAttribute('height', String(Math.round(2400 * vh / vw))); output.setAttribute('preserveAspectRatio', 'none');
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); bg.setAttribute('x', String(vx)); bg.setAttribute('y', String(vy)); bg.setAttribute('width', String(vw)); bg.setAttribute('height', String(vh)); bg.setAttribute('fill', '#eef0f3'); output.appendChild(bg);
    const mapImage = document.querySelector('.pv-canvas img') as HTMLImageElement | null;
    if (mapImage?.src) { const image = document.createElementNS('http://www.w3.org/2000/svg', 'image'); image.setAttribute('x', String(vx)); image.setAttribute('y', String(vy)); image.setAttribute('width', String(vw)); image.setAttribute('height', String(vh)); image.setAttribute('preserveAspectRatio', 'none'); image.setAttribute('data-export-background', mapImage.src); output.appendChild(image); }
    const overlay = source.cloneNode(true) as SVGSVGElement; overlay.removeAttribute('width'); overlay.removeAttribute('height'); overlay.removeAttribute('style'); overlay.setAttribute('x', String(vx)); overlay.setAttribute('y', String(vy)); overlay.setAttribute('width', String(vw)); overlay.setAttribute('height', String(vh)); overlay.setAttribute('viewBox', viewBox.join(' ')); overlay.setAttribute('preserveAspectRatio', 'none'); overlay.querySelectorAll('[data-owner-yard-label]').forEach(e => e.remove()); output.appendChild(overlay);
    return { output, viewBox, backgroundSrc: mapImage?.src || '' };
  }

  async function toDataUrl(url: string) {
    const response = await fetch(url, { credentials: 'same-origin' }); if (!response.ok) throw new Error('Unable to read map image');
    const blob = await response.blob(); return await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Unable to convert map image')); reader.readAsDataURL(blob); });
  }

  async function exportMapImage() {
    if (!selectedSummary.length || exporting) return; setExporting('image');
    try {
      const { output, viewBox, backgroundSrc } = getMapSvg();
      if (backgroundSrc) { const bg = output.querySelector('[data-export-background]') as SVGImageElement | null; if (bg) { const dataUrl = await toDataUrl(backgroundSrc); bg.setAttribute('href', dataUrl); bg.removeAttribute('data-export-background'); } }
      const markup = new XMLSerializer().serializeToString(output), [vx, vy, vw, vh] = viewBox;
      const image = new Image(); image.decoding = 'async';
      image.onload = () => { const scale = Math.min(2.5, Math.max(1, 2400 / Math.max(vw, vh))), canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(vw * scale)); canvas.height = Math.max(1, Math.round(vh * scale)); const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Unable to create image'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height); const link = document.createElement('a'); link.download = `landgrid-owner-map-${new Date().toISOString().slice(0, 10)}.png`; link.href = canvas.toDataURL('image/png', 1); link.click(); };
      image.onerror = () => { const blob = new Blob([markup], { type: 'image/svg+xml' }), link = document.createElement('a'); link.download = `landgrid-owner-map-${new Date().toISOString().slice(0, 10)}.svg`; link.href = URL.createObjectURL(blob); link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); };
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    } catch (e) { window.alert(e instanceof Error ? e.message : 'Unable to export the map image.'); } finally { window.setTimeout(() => setExporting(null), 1200); }
  }

  function exportPdfReport() {
    if (!selectedSummary.length || exporting) return; setExporting('pdf');
    try {
      const tables = selectedSummary.map(({ owner, ownerLots, totalYards }) => { const color = esc(colorByOwner.get(owner.id)?.base || '#2563eb'); const rows = ownerLots.slice().sort((a, b) => Number(a.number) - Number(b.number)).map(l => `<tr><td>${esc(l.number)}</td><td class="num">${fmtYards(l.area)}</td></tr>`).join(''); return `<section class="owner-section"><div class="owner-title"><div><span class="sw" style="background:${color}"></span><b>${esc(owner.name)}</b></div><div>${ownerLots.length} plots · ${fmtYards(totalYards)} sq.yd</div></div><table><thead><tr><th>Plot</th><th class="num">Area (sq.yd)</th></tr></thead><tbody>${rows}<tr class="subtotal"><td>Owner total</td><td class="num">${fmtYards(totalYards)} sq.yd</td></tr></tbody></table></section>`; }).join('');
      const cards = selectedSummary.map(({ owner, ownerLots, totalYards }) => `<div class="owner-card"><div><span class="sw large" style="background:${esc(colorByOwner.get(owner.id)?.base || '#2563eb')}"></span><b>${esc(owner.name)}</b></div><div class="owner-stats"><span>${ownerLots.length} plots</span><strong>${fmtYards(totalYards)} sq.yd</strong></div></div>`).join('');
      const w = window.open('', '_blank'); if (!w) throw new Error('Popup blocked. Please allow popups for this site.');
      w.document.write(`<!doctype html><html><head><title>LandGrid Owner Report</title><style>@page{size:letter portrait;margin:11mm}*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#172033}body{font-size:9px}header{border-bottom:2px solid #172554;padding-bottom:8px;margin-bottom:10px}.brand{font-size:19px;font-weight:900;color:#172554}.subtitle{color:#64748b;margin-top:2px;font-size:8px}.date{float:right;color:#64748b;font-size:8px}.hero{background:#172554;color:#fff;border-radius:6px;padding:9px 12px;margin-bottom:9px}.hero-label{font-size:7px;text-transform:uppercase;letter-spacing:1px;opacity:.75}.hero-value{font-size:19px;font-weight:900;margin-top:2px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:9px}.card{border:1px solid #dbe3ee;border-radius:5px;padding:6px 8px}.card span{display:block;font-size:6.5px;text-transform:uppercase;letter-spacing:.5px;color:#64748b;font-weight:800}.card b{display:block;font-size:11px;margin-top:2px}.owner-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:5px;margin:5px 0 10px}.owner-card{border:1px solid #dbe3ee;border-radius:5px;padding:6px 7px}.owner-stats{display:flex;justify-content:space-between;margin-top:4px;color:#64748b;font-size:7.5px}.owner-stats strong{color:#172033}.owner-section{margin:0 0 9px;break-inside:avoid}.owner-title{display:flex;justify-content:space-between;align-items:center;background:#f1f5f9;border:1px solid #dbe3ee;border-bottom:0;border-radius:5px 5px 0 0;padding:6px 8px;color:#172554;font-size:8.5px}table{width:100%;border-collapse:collapse;border:1px solid #dbe3ee}thead{display:table-header-group}th,td{padding:4px 6px;border-bottom:1px solid #e5e7eb;text-align:left;font-size:8px}th{background:#f8fafc;color:#475569;font-size:7px;text-transform:uppercase}.num{text-align:right}.subtotal{background:#f8fafc!important;font-weight:800}.grand{background:#172554!important;color:#fff;font-weight:900}.grand td{border-bottom:0}.sw{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px;vertical-align:middle}.sw.large{width:8px;height:8px}.footer{margin-top:10px;padding-top:6px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:7px;text-align:center}h2{font-size:9px;margin:8px 0 5px;color:#172554;text-transform:uppercase;letter-spacing:.5px}</style></head><body><header><span class="date">${new Date().toLocaleDateString()}</span><div class="brand">LandGrid</div><div class="subtitle">Owner & Plot Summary Report</div></header><div class="hero"><div class="hero-label">Selected land area</div><div class="hero-value">${fmtYards(selectedYards)} sq.yd</div></div><div class="cards"><div class="card"><span>Selected owners</span><b>${selectedSummary.length}</b></div><div class="card"><span>Selected plots</span><b>${selectedPlotCount}</b></div><div class="card"><span>Total area</span><b>${fmtYards(selectedYards)} sq.yd</b></div></div><h2>Owner Summary</h2><div class="owner-grid">${cards}</div><h2>Plot Details — Separate by Owner</h2>${tables}<table style="margin-top:8px"><tbody><tr class="grand"><td>Overall Total — ${selectedPlotCount} plots</td><td class="num">${fmtYards(selectedYards)} sq.yd</td></tr></tbody></table><div class="footer">Generated from the current LandGrid project owner selection.</div><script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`); w.document.close();
    } catch (e) { window.alert(e instanceof Error ? e.message : 'Unable to create the PDF report.'); } finally { setExporting(null); }
  }

  if (loading || !owners.length) return null;
  return <div className="landgrid-owner-filter" style={{ position: focusMode ? 'fixed' : 'absolute', top: focusMode ? 8 : 8, right: focusMode ? 8 : 8, width: 'min(360px,calc(100% - 16px))', maxHeight: focusMode ? 'calc(100vh - 16px)' : 'calc(100% - 16px)', overflow: 'hidden', zIndex: focusMode ? 10000 : 30, background: 'rgba(255,255,255,.98)', border: focusMode ? '0' : '1px solid #dbe3ee', borderRadius: focusMode ? 10 : 14, boxShadow: focusMode ? '0 8px 25px rgba(15,23,42,.16)' : '0 12px 35px rgba(15,23,42,.18)', fontFamily: 'Inter,ui-sans-serif,system-ui,sans-serif' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 12px', borderBottom: open ? '1px solid #e5e7eb' : 'none' }}><Users size={16} color="#172554" /><b style={{ flex: 1, fontSize: 13 }}>Highlight by owner</b>{selected.size > 0 && <button onClick={clear} style={{ border: 0, background: 'transparent', color: '#64748b', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Clear</button>}<button onClick={() => setFocusMode(v => !v)} title={focusMode ? 'Exit full screen' : 'Full screen'} style={{ border: '1px solid #dbe3ee', background: '#fff', borderRadius: 7, padding: 5, cursor: 'pointer' }}>{focusMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button><button onClick={() => setOpen(v => !v)} style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: 3 }}><ChevronDown size={16} style={{ transform: open ? 'none' : 'rotate(-90deg)' }} /></button></div>
    {open && <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: 'calc(100% - 48px)' }}>
      <div style={{ overflowY: 'auto', maxHeight: focusMode ? '38vh' : '240px', WebkitOverflowScrolling: 'touch' }}>{owners.map((owner, i) => { const pal = colorByOwner.get(owner.id) || paletteFor(i), active = selected.has(owner.id), count = lots.filter(l => String(l.ownerId) === owner.id).length; return <div key={owner.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderBottom: '1px solid #f0f2f5', background: active ? `${pal.base}12` : '#fff' }}><button onClick={() => toggle(owner.id)} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer', padding: 0 }}><span style={{ width: 19, height: 19, borderRadius: 5, border: `2px solid ${active ? pal.base : '#cbd5e1'}`, background: active ? pal.base : '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{active && <Check size={13} color="#fff" strokeWidth={3} />}</span><span style={{ width: 11, height: 11, borderRadius: 99, background: pal.base, flexShrink: 0 }} /><span style={{ minWidth: 0 }}><b style={{ display: 'block', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{owner.name}</b><span style={{ fontSize: 10, color: '#64748b' }}>{count} plots</span></span></button><input type="color" value={/^#[0-9a-f]{6}$/i.test(owner.color || '') ? owner.color! : '#2563eb'} onChange={e => changeColor(owner.id, e.target.value)} title="Owner color" style={{ width: 26, height: 26, padding: 0, border: 0, background: 'transparent', cursor: 'pointer' }} /></div>; })}</div>
      {selectedSummary.length > 0 && <div style={{ borderTop: '2px solid #e2e8f0', padding: '10px 11px', overflowY: 'auto', maxHeight: focusMode ? '42vh' : '300px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}><b style={{ fontSize: 12 }}>Plot Summary</b><span style={{ fontSize: 10, color: '#64748b' }}>{selectedPlotCount} plots · {fmtYards(selectedYards)} sq.yd</span></div>{selectedSummary.map(({ owner, ownerLots, totalYards }) => { const pal = colorByOwner.get(owner.id) || paletteFor(0); return <div key={owner.id} style={{ marginBottom: 9, border: `1px solid ${pal.light}`, borderRadius: 8, overflow: 'hidden' }}><div style={{ padding: '7px 8px', background: pal.light, display: 'flex', justifyContent: 'space-between', gap: 8 }}><b style={{ fontSize: 11 }}>{owner.name}</b><b style={{ fontSize: 10 }}>{fmtYards(totalYards)} sq.yd</b></div><div style={{ padding: '6px 8px', display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 4 }}>{ownerLots.slice().sort((a, b) => Number(a.number) - Number(b.number)).map(l => <div key={l.id} style={{ fontSize: 10, padding: '4px 5px', background: '#f8fafc', borderRadius: 5 }}><b>Plot {l.number}</b><span style={{ color: '#64748b' }}> · {fmtYards(l.area)} yd²</span></div>)}</div></div>; })}</div>}
      {selectedSummary.length > 0 && <div style={{ padding: 10, borderTop: '1px solid #e5e7eb', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}><button onClick={exportMapImage} disabled={!!exporting} style={{ border: 0, borderRadius: 8, padding: '9px 7px', background: '#172554', color: '#fff', fontWeight: 800, fontSize: 11, cursor: exporting ? 'wait' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5 }}><Download size={14} />{exporting === 'image' ? 'Creating…' : 'Map Image'}</button><button onClick={exportPdfReport} disabled={!!exporting} style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '9px 7px', background: '#fff', color: '#172554', fontWeight: 800, fontSize: 11, cursor: exporting ? 'wait' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5 }}><FileText size={14} />{exporting === 'pdf' ? 'Opening…' : 'PDF Report'}</button></div>}
    </div>}
  </div>;
}
