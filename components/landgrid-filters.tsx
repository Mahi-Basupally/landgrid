'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Search, SlidersHorizontal, X } from 'lucide-react';

type Owner = { id: string; name: string; color?: string | null };
type Lot = { id: string; number: string; ownerId?: string | null; ownerName?: string; area?: number | null };

const COLORS = ['#ef4444', '#facc15', '#e879f9', '#22c55e', '#d97732', '#38bdf8', '#a78bfa', '#14b8a6'];
const norm = (value: unknown) => String(value ?? '').trim().toLowerCase();
const colorFor = (owner: Owner, index: number) => owner.color || COLORS[index % COLORS.length];
const formatYards = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 0 });

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
  const [activeTab, setActiveTab] = useState<'owners' | 'summary'>('owners');
  const [summaryOwner, setSummaryOwner] = useState('all');
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

  const ownerStats = useMemo(() => new Map(owners.map(owner => {
    const ownerLots = lots.filter(lot => lot.ownerId === owner.id);
    return [owner.id, { plots: ownerLots.length, yards: ownerLots.reduce((sum, lot) => sum + (Number.isFinite(Number(lot.area)) ? Number(lot.area) : 0), 0) }];
  })), [owners, lots]);

  const summaryOwners = useMemo(() => owners.filter(owner => selectedOwners.has(owner.id)), [owners, selectedOwners]);
  const activeSummaryOwner = summaryOwner === 'all' ? null : ownerMap.get(summaryOwner) || null;
  const summaryLots = activeSummaryOwner ? lots.filter(lot => lot.ownerId === activeSummaryOwner.id) : selectedLots;
  const summaryYards = summaryLots.reduce((sum, lot) => sum + (Number.isFinite(Number(lot.area)) ? Number(lot.area) : 0), 0);

  const toggleOwner = (ownerId: string) => setSelectedOwners(previous => { const next = new Set(previous); if (next.has(ownerId)) next.delete(ownerId); else next.add(ownerId); return next; });
  const clearOwners = () => setSelectedOwners(new Set());
  const selectAllVisible = () => setSelectedOwners(previous => { const next = new Set(previous); filteredOwners.forEach(owner => next.add(owner.id)); return next; });

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
          polygon.style.setProperty('fill', color, 'important');
          polygon.style.setProperty('fill-opacity', '0.92', 'important');
          polygon.style.setProperty('stroke', '#fff', 'important');
          polygon.style.setProperty('stroke-width', '4', 'important');
          polygon.style.setProperty('filter', `drop-shadow(0 0 5px ${color})`, 'important');
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

  const closeModal = () => setMobileOpen(false);

  return (
    <div className="lg-shell-overlay">
      <button type="button" className="lg-filter-trigger" onClick={() => setMobileOpen(true)} aria-label="Open map filters">
        <SlidersHorizontal size={16} /><strong>Filters</strong>{selectedOwners.size > 0 && <span className="lg-filter-count">{selectedOwners.size}</span>}
      </button>

      {mobileOpen && <div className="lg-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closeModal(); }}>
        <aside className="lg-filter-modal" role="dialog" aria-modal="true" aria-label="Map filters">
          <header className="lg-modal-header">
            <div><strong>Filters</strong><span>{selectedOwners.size ? `${selectedOwners.size} owner${selectedOwners.size === 1 ? '' : 's'} selected · ${selectedLots.length} plots` : 'Choose what to show on the map'}</span></div>
            <div className="lg-header-actions">{selectedOwners.size > 0 && <button type="button" className="lg-clear" onClick={clearOwners}>Clear</button>}<button type="button" className="lg-close" onClick={closeModal} aria-label="Close filters"><X size={18} /></button></div>
          </header>

          <nav className="lg-tabs" aria-label="Filter navigation">
            <button type="button" className={activeTab === 'owners' ? 'active' : ''} onClick={() => setActiveTab('owners')}><span>Owners</span>{owners.length > 0 && <em>{owners.length}</em>}</button>
            <button type="button" className={activeTab === 'summary' ? 'active' : ''} onClick={() => setActiveTab('summary')}><span>Summary</span>{selectedOwners.size > 0 && <em>{selectedOwners.size}</em>}</button>
          </nav>

          <div className="lg-modal-content">
            {activeTab === 'owners' ? <section>
              <div className="lg-section-intro"><div><strong>Owner filters</strong><span>Select one or more owners to highlight every plot they own.</span></div><button type="button" onClick={selectAllVisible} disabled={!filteredOwners.length}>Select all</button></div>
              <div className="lg-search-wrap"><Search size={15} /><input value={ownerSearch} onChange={event => setOwnerSearch(event.target.value)} placeholder="Search owners" aria-label="Search owners" />{ownerSearch && <button type="button" aria-label="Clear owner search" onClick={() => setOwnerSearch('')}><X size={14} /></button>}</div>
              {selectedOwners.size > 0 && <div className="lg-selected-strip"><span>{selectedOwners.size} selected</span><div>{summaryOwners.map(owner => <button key={owner.id} type="button" onClick={() => toggleOwner(owner.id)}><i style={{ background: colorFor(owner, ownerIndex.get(owner.id) ?? 0) }} />{owner.name}<X size={11} /></button>)}</div></div>}
              <div className="lg-owner-list">{filteredOwners.map((owner, index) => {
                const active = selectedOwners.has(owner.id);
                const stats = ownerStats.get(owner.id) || { plots: 0, yards: 0 };
                return <button key={owner.id} type="button" className={`lg-owner-row ${active ? 'active' : ''}`} aria-pressed={active} onClick={() => toggleOwner(owner.id)}>
                  <i className="lg-dot" style={{ background: colorFor(owner, ownerIndex.get(owner.id) ?? index) }} />
                  <span><b>{owner.name}</b><small>{stats.plots} plots · {formatYards(stats.yards)} yd²</small></span>
                  <strong className="lg-check">{active ? <Check size={13} /> : null}</strong>
                </button>;
              })}{filteredOwners.length === 0 && <div className="lg-empty">No owners match “{ownerSearch}”.</div>}</div>
            </section> : <section>
              <div className="lg-section-intro"><div><strong>Owner summary</strong><span>Use the tabs below to see each selected owner's totals.</span></div></div>
              <div className="lg-summary-tabs" role="tablist" aria-label="Owner summary tabs">
                <button type="button" className={summaryOwner === 'all' ? 'active' : ''} onClick={() => setSummaryOwner('all')}>All selected</button>
                {summaryOwners.map(owner => <button key={owner.id} type="button" className={summaryOwner === owner.id ? 'active' : ''} onClick={() => setSummaryOwner(owner.id)}><i style={{ background: colorFor(owner, ownerIndex.get(owner.id) ?? 0) }} />{owner.name}</button>)}
              </div>
              <div className="lg-summary-card">
                <div className="lg-summary-title">{activeSummaryOwner ? <><i className="lg-dot" style={{ background: colorFor(activeSummaryOwner, ownerIndex.get(activeSummaryOwner.id) ?? 0) }} /><strong>{activeSummaryOwner.name}</strong></> : <><strong>All selected owners</strong></>}</div>
                <div className="lg-stat-grid"><div><b>{activeSummaryOwner ? 1 : selectedOwners.size}</b><span>Owners</span></div><div><b>{summaryLots.length}</b><span>Plots</span></div><div><b>{formatYards(summaryYards)}</b><span>Sq. yd</span></div></div>
              </div>
              {activeSummaryOwner ? <div className="lg-plot-list">{summaryLots.map(lot => <div key={lot.id}><span>Plot {lot.number}</span><b>{formatYards(Number(lot.area) || 0)} yd²</b></div>)}</div> : <div className="lg-owner-summary-list">{summaryOwners.length > 0 ? summaryOwners.map(owner => { const stats = ownerStats.get(owner.id) || { plots: 0, yards: 0 }; return <button key={owner.id} type="button" onClick={() => setSummaryOwner(owner.id)}><i className="lg-dot" style={{ background: colorFor(owner, ownerIndex.get(owner.id) ?? 0) }} /><span><b>{owner.name}</b><small>{stats.plots} plots</small></span><strong>{formatYards(stats.yards)} yd²</strong></button>; }) : <div className="lg-empty">Select owners to see their summary.</div>}</div>}
            </section>}
          </div>

          <footer className="lg-modal-footer"><div><b>{selectedLots.length}</b> plots highlighted · <b>{formatYards(selectedYards)}</b> yd²</div><button type="button" onClick={closeModal}>Done</button></footer>
        </aside>
      </div>}

      <style>{`
        .lg-shell-overlay{position:absolute;inset:0;z-index:1000;pointer-events:none;font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#172033}.lg-filter-trigger{position:absolute;left:12px;top:12px;z-index:2;pointer-events:auto;height:42px;display:flex;align-items:center;gap:8px;padding:0 12px;border:1px solid #dbe3ee;border-radius:11px;background:rgba(255,255,255,.98);box-shadow:0 7px 24px rgba(15,23,42,.16);color:#172033;cursor:pointer}.lg-filter-trigger strong{font-size:12px}.lg-filter-count{min-width:21px;height:21px;padding:0 6px;display:grid;place-items:center;border-radius:99px;background:#172554;color:#fff;font-size:10px;font-weight:900}.lg-modal-backdrop{position:fixed;inset:0;z-index:9999;pointer-events:auto;background:rgba(15,23,42,.28);display:flex;align-items:flex-start;justify-content:flex-start;padding:12px}.lg-filter-modal{width:min(420px,calc(100vw - 24px));height:min(720px,calc(100vh - 24px));background:#fff;border:1px solid #dbe3ee;border-radius:16px;box-shadow:0 20px 60px rgba(15,23,42,.28);display:flex;flex-direction:column;overflow:hidden}.lg-modal-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 16px;border-bottom:1px solid #e2e8f0}.lg-modal-header strong{display:block;font-size:16px;font-weight:900}.lg-modal-header span{display:block;margin-top:3px;color:#64748b;font-size:10px}.lg-header-actions{display:flex;align-items:center;gap:6px}.lg-clear{border:0;background:#f1f5f9;border-radius:7px;padding:7px 9px;color:#334155;font-size:10px;font-weight:800;cursor:pointer}.lg-close{width:32px;height:32px;display:grid;place-items:center;border:0;border-radius:8px;background:#f8fafc;color:#475569;cursor:pointer}.lg-tabs{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #e2e8f0}.lg-tabs button{position:relative;height:46px;border:0;background:#fff;color:#64748b;font-size:11px;font-weight:800;cursor:pointer}.lg-tabs button.active{color:#172033}.lg-tabs button.active:after{content:'';position:absolute;left:18px;right:18px;bottom:-1px;height:2px;background:#172554;border-radius:2px}.lg-tabs button em{display:inline-grid;place-items:center;min-width:18px;height:18px;margin-left:6px;padding:0 5px;border-radius:99px;background:#eef2ff;color:#312e81;font-size:9px;font-style:normal}.lg-modal-content{flex:1;min-height:0;overflow:auto;padding:14px 15px}.lg-section-intro{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.lg-section-intro strong{display:block;font-size:13px;font-weight:900}.lg-section-intro span{display:block;margin-top:3px;color:#64748b;font-size:10px;line-height:1.45}.lg-section-intro>button{border:0;background:none;color:#334155;font-size:10px;font-weight:800;cursor:pointer}.lg-section-intro>button:disabled{opacity:.4;cursor:default}.lg-search-wrap{height:40px;display:flex;align-items:center;gap:8px;padding:0 10px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#64748b}.lg-search-wrap input{min-width:0;flex:1;border:0;outline:0;background:transparent;font-size:11px}.lg-search-wrap button{display:grid;place-items:center;border:0;background:none;color:#64748b;cursor:pointer}.lg-selected-strip{margin:10px 0;padding:9px;border:1px solid #e0e7ff;border-radius:10px;background:#f8faff}.lg-selected-strip>span{display:block;color:#475569;font-size:9px;font-weight:800;margin-bottom:6px}.lg-selected-strip>div{display:flex;gap:5px;flex-wrap:wrap}.lg-selected-strip button{display:flex;align-items:center;gap:5px;border:1px solid #c7d2fe;background:#eef2ff;color:#312e81;border-radius:99px;padding:5px 7px;font-size:9px;font-weight:800;cursor:pointer}.lg-selected-strip i,.lg-summary-tabs i{width:8px;height:8px;border-radius:50%;display:inline-block}.lg-owner-list{display:grid;gap:3px}.lg-owner-row{width:100%;display:flex;align-items:center;gap:9px;padding:10px;border:1px solid transparent;border-radius:10px;background:#fff;text-align:left;color:#172033;cursor:pointer}.lg-owner-row:hover{background:#f8fafc}.lg-owner-row.active{background:#eef2ff;border-color:#dbe3ff}.lg-dot{width:9px;height:9px;min-width:9px;border-radius:50%;display:inline-block}.lg-owner-row>span{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}.lg-owner-row b{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lg-owner-row small{font-size:9px;color:#64748b}.lg-check{width:20px;height:20px;display:grid;place-items:center;border-radius:6px;background:#e2e8f0;color:#172554}.lg-owner-row.active .lg-check{background:#172554;color:#fff}.lg-empty{padding:18px 5px;color:#64748b;font-size:11px;text-align:center}.lg-summary-tabs{display:flex;gap:6px;overflow-x:auto;padding:2px 0 10px;scrollbar-width:none}.lg-summary-tabs::-webkit-scrollbar{display:none}.lg-summary-tabs button{flex:0 0 auto;display:flex;align-items:center;gap:5px;max-width:180px;border:1px solid #dbe3ee;border-radius:99px;padding:7px 10px;background:#fff;color:#475569;font-size:9px;font-weight:800;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lg-summary-tabs button.active{background:#172554;border-color:#172554;color:#fff}.lg-summary-card{padding:12px;border:1px solid #dbe3ee;border-radius:12px;background:#f8fafc}.lg-summary-title{display:flex;align-items:center;gap:7px;font-size:12px}.lg-stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:10px}.lg-stat-grid div{padding:9px 5px;background:#fff;border:1px solid #e2e8f0;border-radius:9px;text-align:center}.lg-stat-grid b{display:block;font-size:15px}.lg-stat-grid span{display:block;margin-top:2px;color:#64748b;font-size:9px}.lg-owner-summary-list{display:grid;gap:3px;margin-top:10px}.lg-owner-summary-list button{display:flex;align-items:center;gap:9px;width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:9px;background:#fff;text-align:left;cursor:pointer}.lg-owner-summary-list span{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}.lg-owner-summary-list b{font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lg-owner-summary-list small{font-size:9px;color:#64748b}.lg-owner-summary-list strong{font-size:9px;color:#475569}.lg-plot-list{display:grid;gap:3px;margin-top:10px}.lg-plot-list div{display:flex;justify-content:space-between;padding:8px 9px;border-bottom:1px solid #eef2f7;font-size:9px}.lg-plot-list b{color:#475569}.lg-modal-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 15px;border-top:1px solid #e2e8f0;background:#fff;color:#64748b;font-size:9px}.lg-modal-footer b{color:#172033}.lg-modal-footer button{border:0;background:#172554;color:#fff;border-radius:8px;padding:8px 14px;font-size:10px;font-weight:900;cursor:pointer}
        @media(max-width:767px){.lg-filter-trigger{left:10px;top:max(10px,env(safe-area-inset-top))}.lg-modal-backdrop{align-items:flex-start;justify-content:center;padding:0;background:rgba(15,23,42,.24)}.lg-filter-modal{width:100%;height:min(82dvh,680px);max-height:calc(100dvh - env(safe-area-inset-top) - 8px);border-radius:0 0 18px 18px;border-top:0;border-left:0;border-right:0;box-shadow:0 18px 50px rgba(15,23,42,.28)}.lg-modal-header{padding:13px 15px}.lg-tabs button{height:44px}.lg-modal-content{padding:13px 14px}.lg-modal-footer{padding-bottom:11px}}
      `}</style>
    </div>
  );
}
