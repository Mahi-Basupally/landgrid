'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Search, X } from 'lucide-react';

type Owner = { id: string; name: string; color?: string | null };
type Lot = { id: string; number: string; ownerId?: string | null; ownerName?: string; status: string; area?: number | null; price?: number | string | null; direction?: string };

type OpenState = { owner: boolean; status: boolean; plots: boolean; search: boolean };

const STATUS: Record<string, { label: string; dot: string }> = {
  available: { label: 'Available', dot: '#16a34a' },
  reserved: { label: 'Reserved', dot: '#ca8a04' },
  sold: { label: 'Sold', dot: '#dc2626' },
  hold: { label: 'Hold', dot: '#64748b' },
};

function ownerColor(owner: Owner, index: number) {
  return owner.color || `hsl(${Math.round((index * 137.508) % 360)} 78% 52%)`;
}

export default function LandGridFilters({ projectSlug }: { projectSlug: string }) {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [selectedOwners, setSelectedOwners] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [open, setOpen] = useState<OpenState>({ owner: true, status: false, plots: false, search: false });
  const [selectedPlot, setSelectedPlot] = useState<Lot | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/projects/${encodeURIComponent(projectSlug)}/plan`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (!alive) return;
        const rawOwners = Array.isArray(d.owners) ? d.owners : Array.isArray(d.project_owners) ? d.project_owners : [];
        const os: Owner[] = rawOwners.map((o: any) => ({ id: String(o.id), name: String(o.name || 'Unnamed owner'), color: o.color || null }));
        const ownerMap = new Map(os.map(o => [o.id, o.name]));
        const ls: Lot[] = (Array.isArray(d.lots) ? d.lots : Array.isArray(d.plots) ? d.plots : []).map((l: any) => {
          const ownerId = l.ownerId != null ? String(l.ownerId) : l.owner_id != null ? String(l.owner_id) : null;
          return {
            id: String(l.id), number: String(l.number ?? l.plot_number ?? ''), ownerId,
            ownerName: l.ownerName || l.owner_name || (ownerId ? ownerMap.get(ownerId) : '') || '',
            status: String(l.status || 'available').toLowerCase(),
            area: l.area != null ? Number(l.area) : l.area_sq_yards != null ? Number(l.area_sq_yards) : null,
            price: l.price ?? null, direction: l.direction || '',
          };
        });
        setOwners(os.filter(o => ls.some(l => l.ownerId === o.id)).sort((a, b) => a.name.localeCompare(b.name)));
        setLots(ls.sort((a, b) => Number(a.number) - Number(b.number)));
      })
      .catch(() => { if (alive) { setOwners([]); setLots([]); } });
    return () => { alive = false; };
  }, [projectSlug]);

  const ownerById = useMemo(() => new Map(owners.map(o => [o.id, o])), [owners]);
  const ownerListIndex = useMemo(() => new Map(owners.map((o, i) => [o.id, i])), [owners]);
  const filteredLots = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lots.filter(l => {
      const ownerName = (l.ownerName || ownerById.get(String(l.ownerId))?.name || '').toLowerCase();
      return (!q || l.number.toLowerCase().includes(q) || ownerName.includes(q)) && (status === 'all' || l.status === status);
    });
  }, [lots, search, status, ownerById]);

  const selectedOwnerLots = useMemo(() => lots.filter(l => l.ownerId && selectedOwners.has(l.ownerId)), [lots, selectedOwners]);
  const selectedYards = useMemo(() => selectedOwnerLots.reduce((sum, l) => sum + (Number.isFinite(Number(l.area)) ? Number(l.area) : 0), 0), [selectedOwnerLots]);

  function toggleOwner(id: string) {
    setSelectedOwners(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function focusLot(lot: Lot) {
    setSelectedPlot(lot);
    const svg = Array.from(document.querySelectorAll<SVGSVGElement>('.pv-canvas svg')).find(s => s.querySelector('polygon'));
    if (!svg) return;
    const group = Array.from(svg.querySelectorAll<SVGGElement>('g')).find(g => Array.from(g.querySelectorAll('text')).some(t => !t.hasAttribute('data-landgrid-yard') && (t.textContent || '').trim() === lot.number));
    if (group) group.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  useEffect(() => {
    const apply = () => {
      const svg = Array.from(document.querySelectorAll<SVGSVGElement>('.pv-canvas svg')).find(s => s.querySelector('polygon'));
      if (!svg) return;
      svg.querySelectorAll<SVGGElement>('g').forEach(group => {
        const label = Array.from(group.querySelectorAll('text')).find(t => !t.hasAttribute('data-landgrid-yard'))?.textContent?.trim();
        if (!label) return;
        const lot = lots.find(l => l.number === label);
        const poly = group.querySelector<SVGPolygonElement>('polygon');
        if (!lot || !poly) return;
        const active = Boolean(lot.ownerId && selectedOwners.has(lot.ownerId));
        const q = search.trim().toLowerCase();
        const ownerName = (lot.ownerName || ownerById.get(String(lot.ownerId))?.name || '').toLowerCase();
        const matchSearch = !q || lot.number.toLowerCase().includes(q) || ownerName.includes(q);
        const matchStatus = status === 'all' || lot.status === status;
        const filtered = Boolean(q || status !== 'all') && !(matchSearch && matchStatus);
        if (active) {
          const owner = ownerById.get(String(lot.ownerId));
          const color = owner ? ownerColor(owner, ownerListIndex.get(owner.id) ?? 0) : '#2563eb';
          poly.style.setProperty('fill', color, 'important');
          poly.style.setProperty('fill-opacity', '.88', 'important');
          poly.style.setProperty('stroke', '#fff', 'important');
          poly.style.setProperty('stroke-width', '5', 'important');
          poly.style.setProperty('filter', `drop-shadow(0 0 6px ${color})`, 'important');
        } else {
          poly.style.removeProperty('fill');
          poly.style.setProperty('fill-opacity', filtered ? '.12' : '', 'important');
          poly.style.removeProperty('stroke');
          poly.style.removeProperty('stroke-width');
          poly.style.removeProperty('filter');
        }
      });
    };
    const observer = new MutationObserver(() => requestAnimationFrame(apply));
    const canvas = document.querySelector('.pv-canvas');
    if (canvas) observer.observe(canvas, { childList: true, subtree: true });
    apply();
    return () => observer.disconnect();
  }, [lots, selectedOwners, search, status, ownerById, ownerListIndex]);

  const Section = ({ id, title, count, children }: { id: keyof OpenState; title: string; count?: number; children: React.ReactNode }) => (
    <section className="lg-section">
      <button type="button" className="lg-heading" onClick={() => setOpen(prev => ({ ...prev, [id]: !prev[id] }))}>
        <span className="lg-heading-left">{open[id] ? <ChevronDown size={15} /> : <ChevronRight size={15} />}<b>{title}</b></span>
        {count ? <span className="lg-count">{count}</span> : null}
      </button>
      {open[id] && <div className="lg-body">{children}</div>}
    </section>
  );

  return (
    <div className="lg-shell-overlay">
      <aside className="lg-left-panel" aria-label="Filters and find">
        <div className="lg-title"><strong>Filters & Find</strong><span>Select what you want to see on the map.</span></div>
        <Section id="owner" title="Filter by Owner" count={selectedOwners.size}>
          <div className="lg-owner-actions"><span>{selectedOwners.size ? `${selectedOwnerLots.length} plots selected` : 'Select one or more owners'}</span>{selectedOwners.size > 0 && <button type="button" onClick={() => setSelectedOwners(new Set())}>Clear</button>}</div>
          {owners.length === 0 ? <div className="lg-empty">No plot owners assigned.</div> : owners.map((o, i) => {
            const active = selectedOwners.has(o.id);
            return <button key={o.id} type="button" className={`lg-row lg-owner ${active ? 'active' : ''}`} onClick={() => toggleOwner(o.id)}>
              <span className="lg-dot" style={{ background: ownerColor(o, i) }} />
              <span>{o.name}</span><span className="lg-check">{active && <Check size={12} />}</span>
            </button>;
          })}
        </Section>

        <Section id="status" title="Plot Status">
          <div className="lg-status-grid">
            {([['all', 'All'], ...Object.entries(STATUS).map(([k, v]) => [k, v.label])] as [string, string][]).map(([k, label]) => <button key={k} type="button" className={`lg-status ${status === k ? 'active' : ''}`} onClick={() => setStatus(k)}>
              <span className="lg-dot" style={{ background: k === 'all' ? '#94a3b8' : STATUS[k].dot }} /> <span>{label}</span><em>{k === 'all' ? lots.length : lots.filter(l => l.status === k).length}</em>
            </button>)}
          </div>
        </Section>

        <Section id="plots" title="Plots" count={filteredLots.length}>
          <div className="lg-plot-list">
            {filteredLots.map(lot => <button key={lot.id} type="button" className={`lg-row lg-plot ${selectedPlot?.id === lot.id ? 'active' : ''}`} onClick={() => focusLot(lot)}>
              <span className="lg-dot" style={{ background: STATUS[lot.status]?.dot || '#64748b' }} />
              <span><b>Plot {lot.number}</b><small>{lot.ownerName || ownerById.get(String(lot.ownerId))?.name || 'No owner'}{lot.area != null ? ` · ${lot.area.toLocaleString()} sq.yd` : ''}</small></span>
            </button>)}
            {filteredLots.length === 0 && <div className="lg-empty">No plots match the current filters.</div>}
          </div>
        </Section>

        <Section id="search" title="Free Search" count={search ? 1 : 0}>
          <div className="lg-search-wrap"><Search size={14} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Plot number or owner name" aria-label="Search plot or owner" />{search && <button type="button" onClick={() => setSearch('')}><X size={13} /></button>}</div>
        </Section>
      </aside>

      <aside className="lg-right-panel" aria-label="Property information">
        <div className="lg-title"><strong>{selectedOwners.size ? 'Owner Plot Summary' : selectedPlot ? `Plot ${selectedPlot.number}` : 'Property Information'}</strong><span>{selectedOwners.size ? `${selectedOwnerLots.length} plots · ${selectedYards.toLocaleString(undefined, { maximumFractionDigits: 2 })} sq.yd` : selectedPlot ? 'Selected property' : 'Select an owner or plot to view details.'}</span></div>
        {selectedOwners.size > 0 ? <div className="lg-summary-list">
          {owners.filter(o => selectedOwners.has(o.id)).map((o, i) => {
            const ol = lots.filter(l => l.ownerId === o.id);
            const yards = ol.reduce((sum, l) => sum + (Number.isFinite(Number(l.area)) ? Number(l.area) : 0), 0);
            return <div className="lg-owner-card" key={o.id}>
              <div className="lg-owner-card-title"><span className="lg-dot" style={{ background: ownerColor(o, i) }} />{o.name}</div>
              <div className="lg-owner-total">{ol.length} plots</div>
              <div className="lg-owner-plots">{ol.map(l => <button key={l.id} type="button" onClick={() => focusLot(l)}>Plot {l.number}<span>{l.area != null ? `${l.area.toLocaleString()} yd²` : '—'}</span></button>)}</div>
              <div className="lg-owner-yards">{yards.toLocaleString(undefined, { maximumFractionDigits: 2 })} sq.yd total</div>
            </div>;
          })}
        </div> : selectedPlot ? <div className="lg-detail">
          <div className="lg-detail-stat"><small>Status</small><b>{STATUS[selectedPlot.status]?.label || selectedPlot.status}</b></div>
          <div className="lg-detail-stat"><small>Owner</small><b>{selectedPlot.ownerName || ownerById.get(String(selectedPlot.ownerId))?.name || 'Unassigned'}</b></div>
          {selectedPlot.area != null && <div className="lg-detail-stat"><small>Area</small><b>{selectedPlot.area.toLocaleString()} sq.yd</b></div>}
          {selectedPlot.price != null && <div className="lg-detail-stat"><small>Price</small><b>{String(selectedPlot.price)}</b></div>}
          {selectedPlot.direction && <div className="lg-detail-stat"><small>Direction</small><b>{selectedPlot.direction}</b></div>}
        </div> : <div className="lg-empty lg-empty-large">Use <b>Filter by Owner</b> to see an owner summary, or open <b>Plots</b> to select a property.</div>}
      </aside>

      <style>{`
        .lg-shell-overlay{position:absolute;inset:0;z-index:1000;pointer-events:none}
        .lg-left-panel,.lg-right-panel{position:absolute;top:0;bottom:0;pointer-events:auto;background:#fff;border:1px solid #dbe3ee;box-shadow:0 8px 28px rgba(15,23,42,.16);overflow:auto;font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#172033}
        .lg-left-panel{left:0;width:280px}.lg-right-panel{right:0;width:320px}
        .lg-left-panel *,.lg-right-panel *{box-sizing:border-box}
        .lg-title{padding:14px 15px;border-bottom:1px solid #e2e8f0}.lg-title strong{display:block;font-size:14px;font-weight:900}.lg-title span{display:block;margin-top:3px;font-size:10px;color:#64748b;line-height:1.45}
        .lg-section{border-bottom:1px solid #e2e8f0}.lg-heading{width:100%;padding:12px 14px;border:0;background:#fff;display:flex;align-items:center;justify-content:space-between;cursor:pointer;color:#172033;text-align:left}.lg-heading-left{display:flex;align-items:center;gap:5px}.lg-count{min-width:20px;padding:2px 6px;border-radius:99px;background:#172554;color:#fff;text-align:center;font-size:10px;font-weight:800}
        .lg-body{padding:0 10px 10px}.lg-owner-actions{display:flex;justify-content:space-between;align-items:center;padding:2px 3px 4px;color:#64748b;font-size:10px}.lg-owner-actions button{border:0;background:none;color:#334155;font-size:10px;font-weight:800;cursor:pointer}
        .lg-row,.lg-status{width:100%;border:1px solid #e2e8f0;background:#fff;border-radius:8px;margin-top:5px;cursor:pointer;text-align:left}.lg-row{display:flex;align-items:center;gap:8px;padding:8px 9px}.lg-row.active{background:#f0f4ff;border-color:#a5b4fc}.lg-owner span:nth-child(2){flex:1;font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lg-dot{width:10px;height:10px;border-radius:50%;flex:none}.lg-check{width:18px;height:18px;border-radius:5px;border:1px solid #cbd5e1;display:grid;place-items:center;color:#fff}.lg-owner.active .lg-check{background:#172554;border-color:#172554}
        .lg-status-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.lg-status{padding:8px 9px;display:flex;align-items:center;gap:7px;color:#243047}.lg-status.active{background:#172554;color:#fff;border-color:#172554}.lg-status em{margin-left:auto;font-style:normal;font-size:10px;opacity:.7}
        .lg-plot-list{max-height:330px;overflow:auto}.lg-plot small{display:block;margin-top:2px;color:#64748b;font-size:10px}.lg-plot b{font-size:12px}.lg-empty{padding:12px 3px;color:#94a3b8;font-size:11px}.lg-empty-large{padding:36px 24px;text-align:center;line-height:1.7}
        .lg-search-wrap{position:relative;display:flex;align-items:center}.lg-search-wrap>svg{position:absolute;left:9px;color:#94a3b8}.lg-search-wrap input{width:100%;border:1px solid #dbe2ea;border-radius:8px;padding:9px 30px;font-size:12px;outline:none}.lg-search-wrap button{position:absolute;right:4px;border:0;background:none;cursor:pointer;color:#64748b}
        .lg-summary-list{padding:2px 0 12px}.lg-owner-card{margin:10px 12px;border:1px solid #dbe3ee;border-radius:10px;padding:11px}.lg-owner-card-title{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:900}.lg-owner-total{margin-top:7px;font-size:19px;font-weight:900}.lg-owner-plots{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:7px;max-height:260px;overflow:auto}.lg-owner-plots button{border:1px solid #edf1f6;background:#f8fafc;border-radius:6px;padding:5px 6px;text-align:left;font-size:10px;cursor:pointer}.lg-owner-plots span{display:block;color:#64748b;margin-top:2px}.lg-owner-yards{margin-top:8px;padding-top:8px;border-top:1px solid #eef2f7;font-size:12px;font-weight:900;text-align:right}
        .lg-detail{padding:12px}.lg-detail-stat{padding:11px 12px;margin-bottom:8px;border:1px solid #e2e8f0;border-radius:9px;background:#f8fafc}.lg-detail-stat small{display:block;color:#64748b;font-size:9px;font-weight:800;text-transform:uppercase}.lg-detail-stat b{display:block;margin-top:3px;font-size:14px}
        @media(max-width:767px){.lg-shell-overlay{position:fixed;inset:0;z-index:1000;pointer-events:none}.lg-left-panel{width:min(88vw,320px);top:64px;bottom:58px;border-radius:0 14px 0 0}.lg-right-panel{display:none}.lg-left-panel{box-shadow:6px 0 24px rgba(15,23,42,.18)}}
      `}</style>
    </div>
  );
}
