'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react';

type Owner = { id: string; name: string; color?: string | null };
type Lot = { id: string; number: string; ownerId?: string | null; ownerName?: string; area?: number | null };

const COLORS = ['#ef4444', '#facc15', '#e879f9', '#22c55e', '#d97732', '#38bdf8', '#a78bfa', '#14b8a6'];
const norm = (value: unknown) => String(value ?? '').trim().toLowerCase();
const colorFor = (owner: Owner, index: number) => owner.color || COLORS[index % COLORS.length];

function getMapSvg() {
  return Array.from(document.querySelectorAll<SVGSVGElement>('.pv-canvas svg')).find(svg => svg.querySelector('polygon')) || null;
}

function getPlotNumber(group: SVGGElement) {
  const text = Array.from(group.querySelectorAll('text')).find(node => {
    const value = (node.textContent || '').trim();
    return value && !node.hasAttribute('data-landgrid-yard') && !node.hasAttribute('data-landgrid-yard-label');
  });
  return text?.textContent?.trim() || '';
}

export default function LandGridFilters({ projectSlug }: { projectSlug: string }) {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [selectedOwners, setSelectedOwners] = useState<Set<string>>(() => new Set());
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ownerOpen, setOwnerOpen] = useState(true);
  const [ownerSearch, setOwnerSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${encodeURIComponent(projectSlug)}/plan`, { cache: 'no-store' })
      .then(response => { if (!response.ok) throw new Error(`Plan request failed: ${response.status}`); return response.json(); })
      .then(data => {
        if (cancelled) return;
        const rawOwners = Array.isArray(data?.owners) ? data.owners : Array.isArray(data?.project_owners) ? data.project_owners : [];
        const parsedOwners: Owner[] = rawOwners.map((owner: any) => ({ id: String(owner.id), name: String(owner.name || 'Unnamed owner'), color: owner.color || null }));
        const ownerNames = new Map(parsedOwners.map(owner => [owner.id, owner.name]));
        const rawLots = Array.isArray(data?.lots) ? data.lots : Array.isArray(data?.plots) ? data.plots : [];
        const parsedLots: Lot[] = rawLots.map((lot: any) => {
          const ownerId = lot.ownerId != null ? String(lot.ownerId) : lot.owner_id != null ? String(lot.owner_id) : null;
          return { id: String(lot.id), number: String(lot.number ?? lot.plot_number ?? ''), ownerId, ownerName: String(lot.ownerName || lot.owner_name || (ownerId ? ownerNames.get(ownerId) : '') || ''), area: lot.area != null ? Number(lot.area) : lot.area_sq_yards != null ? Number(lot.area_sq_yards) : null };
        });
        parsedOwners.sort((a, b) => a.name.localeCompare(b.name));
        parsedLots.sort((a, b) => Number(a.number) - Number(b.number));
        setOwners(parsedOwners.filter(owner => parsedLots.some(lot => lot.ownerId === owner.id)));
        setLots(parsedLots);
      })
      .catch(error => { console.error('[LandGrid] Failed to load plan', error); if (!cancelled) { setOwners([]); setLots([]); } });
    return () => { cancelled = true; };
  }, [projectSlug]);

  const ownerMap = useMemo(() => new Map(owners.map(owner => [owner.id, owner])), [owners]);
  const ownerIndex = useMemo(() => new Map(owners.map((owner, index) => [owner.id, index])), [owners]);
  const filteredOwners = useMemo(() => { const query = norm(ownerSearch); return query ? owners.filter(owner => norm(owner.name).includes(query)) : owners; }, [owners, ownerSearch]);
  const selectedLots = useMemo(() => lots.filter(lot => lot.ownerId != null && selectedOwners.has(String(lot.ownerId))), [lots, selectedOwners]);
  const selectedYards = useMemo(() => selectedLots.reduce((sum, lot) => sum + (Number.isFinite(Number(lot.area)) ? Number(lot.area) : 0), 0), [selectedLots]);

  const toggleOwner = (ownerId: string) => setSelectedOwners(previous => { const next = new Set(previous); if (next.has(ownerId)) next.delete(ownerId); else next.add(ownerId); return next; });
  const clearOwners = () => setSelectedOwners(new Set());
  const selectAllVisible = () => setSelectedOwners(previous => { const next = new Set(previous); filteredOwners.forEach(owner => next.add(owner.id)); return next; });
  const removeOwner = (ownerId: string) => setSelectedOwners(previous => { const next = new Set(previous); next.delete(ownerId); return next; });

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    const apply = () => {
      if (cancelled) return;
      const svg = getMapSvg();
      if (!svg) return;
      svg.querySelectorAll<SVGGElement>('g').forEach(group => {
        const number = getPlotNumber(group);
        const lot = lots.find(item => item.number === number);
        const polygon = group.querySelector<SVGPolygonElement>('polygon');
        if (!lot || !polygon) return;
        const ownerId = lot.ownerId == null ? '' : String(lot.ownerId);
        const owner = ownerMap.get(ownerId);
        const active = ownerId !== '' && selectedOwners.has(ownerId);
        if (active) {
          const color = owner ? colorFor(owner, ownerIndex.get(owner.id) ?? 0) : '#2563eb';
          polygon.style.setProperty('fill', color, 'important'); polygon.style.setProperty('fill-opacity', '0.92', 'important'); polygon.style.setProperty('stroke', '#fff', 'important'); polygon.style.setProperty('stroke-width', '4', 'important'); polygon.style.setProperty('filter', `drop-shadow(0 0 5px ${color})`, 'important');
        } else {
          polygon.style.removeProperty('fill'); polygon.style.removeProperty('fill-opacity'); polygon.style.removeProperty('stroke'); polygon.style.removeProperty('stroke-width'); polygon.style.removeProperty('filter');
        }
      });
    };
    const run = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(apply); };
    let attempts = 0;
    const retry = () => { if (cancelled || attempts++ >= 15) return; run(); window.setTimeout(retry, 100); };
    retry();
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [lots, selectedOwners, ownerMap, ownerIndex]);

  return (
    <div className="lg-shell-overlay">
      <aside className={`lg-left-panel ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Map filters">
        <button type="button" className="lg-mobile-toggle" onClick={() => setMobileOpen(value => !value)} aria-expanded={mobileOpen}>
          <span className="lg-mobile-handle" /><SlidersHorizontal size={16} /><strong>Filters</strong>
          {selectedOwners.size > 0 && <span className="lg-mobile-count">{selectedOwners.size}</span>}
          <span className="lg-mobile-chevron">{mobileOpen ? '⌄' : '⌃'}</span>
        </button>

        <div className="lg-title">
          <div className="lg-title-row"><div><strong>Map Filters</strong><span>Choose owners to highlight their plots.</span></div>{selectedOwners.size > 0 && <button type="button" className="lg-clear-top" onClick={clearOwners}>Clear all</button>}</div>
        </div>

        <section className="lg-section">
          <button type="button" className="lg-heading" onClick={() => setOwnerOpen(value => !value)}>
            <span className="lg-heading-left">{ownerOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}<b>Owners</b></span>
            <span className="lg-heading-meta">{selectedOwners.size ? `${selectedOwners.size} selected` : `${owners.length} available`}</span>
          </button>
          {ownerOpen && <div className="lg-body">
            <div className="lg-search-wrap"><Search size={14} /><input value={ownerSearch} onChange={event => setOwnerSearch(event.target.value)} placeholder="Search owners" aria-label="Search owners" />{ownerSearch && <button type="button" aria-label="Clear owner search" onClick={() => setOwnerSearch('')}><X size={14} /></button>}</div>
            <div className="lg-owner-actions"><span>{selectedOwners.size ? `${selectedLots.length} plots highlighted` : 'Select one or more owners'}</span><div>{filteredOwners.length > 0 && <button type="button" onClick={selectAllVisible}>Select all</button>}{selectedOwners.size > 0 && <button type="button" onClick={clearOwners}>Clear</button>}</div></div>
            {selectedOwners.size > 0 && <div className="lg-chips">{owners.filter(owner => selectedOwners.has(owner.id)).map(owner => <button key={owner.id} type="button" className="lg-chip" onClick={() => removeOwner(owner.id)}><span className="lg-dot" style={{ background: colorFor(owner, ownerIndex.get(owner.id) ?? 0) }} />{owner.name}<X size={11} /></button>)}</div>}
            <div className="lg-owner-list">{filteredOwners.map((owner, index) => { const active = selectedOwners.has(owner.id); const ownerLots = lots.filter(lot => lot.ownerId === owner.id); const yards = ownerLots.reduce((sum, lot) => sum + (Number.isFinite(Number(lot.area)) ? Number(lot.area) : 0), 0); return <button key={owner.id} type="button" className={`lg-row ${active ? 'active' : ''}`} aria-pressed={active} onClick={() => toggleOwner(owner.id)}><span className="lg-dot" style={{ background: colorFor(owner, ownerIndex.get(owner.id) ?? index) }} /><span className="lg-owner-name"><b>{owner.name}</b><small>{ownerLots.length} plots · {yards.toLocaleString(undefined, { maximumFractionDigits: 0 })} yd²</small></span><span className="lg-check">{active ? <Check size={12} /> : null}</span></button>; })}{filteredOwners.length === 0 && <div className="lg-empty">No owners match “{ownerSearch}”.</div>}</div>
          </div>}
        </section>

        <section className="lg-summary">
          <div className="lg-summary-head"><div><strong>Selection summary</strong><span>Updates instantly as you select owners.</span></div></div>
          <div className="lg-stat-grid"><div><b>{selectedOwners.size}</b><span>Owners</span></div><div><b>{selectedLots.length}</b><span>Plots</span></div><div><b>{selectedYards.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b><span>Sq. yd</span></div></div>
          {selectedOwners.size > 0 && <div className="lg-selected-list">{owners.filter(owner => selectedOwners.has(owner.id)).map(owner => { const ownerLots = lots.filter(lot => lot.ownerId === owner.id); const yards = ownerLots.reduce((sum, lot) => sum + (Number.isFinite(Number(lot.area)) ? Number(lot.area) : 0), 0); return <div className="lg-selected-row" key={owner.id}><span className="lg-dot" style={{ background: colorFor(owner, ownerIndex.get(owner.id) ?? 0) }} /><b>{owner.name}</b><span>{ownerLots.length} plots · {yards.toLocaleString(undefined, { maximumFractionDigits: 0 })} yd²</span></div>; })}</div>}
        </section>
      </aside>

      <style>{`
        .lg-shell-overlay{position:absolute;inset:0;z-index:1000;pointer-events:none}.lg-left-panel{position:absolute;left:12px;top:12px;bottom:12px;width:310px;pointer-events:auto;background:rgba(255,255,255,.98);border:1px solid #dbe3ee;border-radius:14px;box-shadow:0 10px 35px rgba(15,23,42,.18);overflow:auto;font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#172033}.lg-left-panel *{box-sizing:border-box}.lg-title{padding:15px;border-bottom:1px solid #e2e8f0}.lg-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.lg-title strong{display:block;font-size:15px;font-weight:900}.lg-title span{display:block;margin-top:3px;font-size:10px;color:#64748b;line-height:1.45}.lg-clear-top{border:0;background:#f1f5f9;color:#334155;border-radius:7px;padding:6px 8px;font-size:10px;font-weight:800;cursor:pointer}.lg-section,.lg-summary{border-bottom:1px solid #e2e8f0}.lg-heading{width:100%;padding:12px 14px;border:0;background:#fff;display:flex;align-items:center;justify-content:space-between;cursor:pointer;color:#172033;text-align:left}.lg-heading-left{display:flex;align-items:center;gap:6px}.lg-heading-meta{font-size:10px;color:#64748b;font-weight:700}.lg-body{padding:0 11px 11px}.lg-search-wrap{height:36px;display:flex;align-items:center;gap:7px;padding:0 9px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#64748b}.lg-search-wrap input{min-width:0;flex:1;border:0;outline:0;background:transparent;font-size:11px}.lg-search-wrap button{display:grid;place-items:center;border:0;background:none;color:#64748b;cursor:pointer}.lg-owner-actions{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 2px 6px;color:#64748b;font-size:10px}.lg-owner-actions>div{display:flex;gap:9px}.lg-owner-actions button{border:0;background:none;color:#334155;font-size:10px;font-weight:800;cursor:pointer;padding:0}.lg-chips{display:flex;gap:5px;flex-wrap:wrap;padding:0 0 8px}.lg-chip{display:flex;align-items:center;gap:5px;border:1px solid #c7d2fe;background:#eef2ff;color:#312e81;border-radius:99px;padding:4px 7px;font-size:9px;font-weight:800;cursor:pointer}.lg-owner-list{display:grid;gap:2px}.lg-row{width:100%;border:0;background:#fff;display:flex;align-items:center;gap:8px;padding:8px;border-radius:9px;cursor:pointer;text-align:left;color:#172033}.lg-row:hover{background:#f8fafc}.lg-row.active{background:#eef2ff}.lg-dot{width:9px;height:9px;min-width:9px;border-radius:50%;display:inline-block}.lg-owner-name{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}.lg-owner-name b{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lg-owner-name small{font-size:9px;color:#64748b}.lg-check{margin-left:auto;width:18px;height:18px;display:grid;place-items:center;border-radius:5px;background:#e2e8f0;color:#172554}.lg-row.active .lg-check{background:#172554;color:#fff}.lg-empty{padding:12px 5px;color:#64748b;font-size:11px}.lg-summary{padding:12px}.lg-summary-head strong{display:block;font-size:13px;font-weight:900}.lg-summary-head span{display:block;margin-top:3px;color:#64748b;font-size:10px}.lg-stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:10px}.lg-stat-grid div{padding:8px 5px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;text-align:center}.lg-stat-grid b{display:block;font-size:14px}.lg-stat-grid span{display:block;margin-top:2px;color:#64748b;font-size:9px}.lg-selected-list{display:grid;gap:5px;margin-top:8px}.lg-selected-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:6px;padding:6px 0;font-size:9px}.lg-selected-row b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lg-selected-row>span:last-child{color:#64748b}.lg-mobile-toggle{display:none}
        @media(max-width:767px){.lg-left-panel{left:8px;right:8px;bottom:max(8px,env(safe-area-inset-bottom));top:auto;width:auto;height:58px;max-height:58px;overflow:hidden;border-radius:16px;z-index:30}.lg-left-panel.mobile-open{height:auto;max-height:min(72dvh,560px);overflow:auto}.lg-mobile-toggle{width:100%;height:58px;padding:0 14px;border:0;background:#fff;display:flex;align-items:center;gap:10px;color:#172033;text-align:left;cursor:pointer}.lg-mobile-toggle>strong{font-size:13px;flex:1}.lg-mobile-handle{width:28px;height:4px;border-radius:99px;background:#cbd5e1}.lg-mobile-count{min-width:21px;height:21px;padding:0 6px;display:grid;place-items:center;border-radius:99px;background:#172554;color:#fff;font-size:10px;font-weight:800}.lg-mobile-chevron{font-size:16px;color:#64748b}.lg-title{display:none}.lg-heading{padding:12px 10px}.lg-body{padding:0 10px 10px}.lg-summary{padding:12px 10px}.lg-stat-grid{margin-top:8px}}
      `}</style>
    </div>
  );
}
