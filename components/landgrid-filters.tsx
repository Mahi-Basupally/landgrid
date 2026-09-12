'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';

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

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${encodeURIComponent(projectSlug)}/plan`, { cache: 'no-store' })
      .then(response => {
        if (!response.ok) throw new Error(`Plan request failed: ${response.status}`);
        return response.json();
      })
      .then(data => {
        if (cancelled) return;
        const rawOwners = Array.isArray(data?.owners) ? data.owners : Array.isArray(data?.project_owners) ? data.project_owners : [];
        const parsedOwners: Owner[] = rawOwners.map((owner: any) => ({
          id: String(owner.id),
          name: String(owner.name || 'Unnamed owner'),
          color: owner.color || null,
        }));
        const ownerNames = new Map(parsedOwners.map(owner => [owner.id, owner.name]));
        const rawLots = Array.isArray(data?.lots) ? data.lots : Array.isArray(data?.plots) ? data.plots : [];
        const parsedLots: Lot[] = rawLots.map((lot: any) => {
          const ownerId = lot.ownerId != null ? String(lot.ownerId) : lot.owner_id != null ? String(lot.owner_id) : null;
          return {
            id: String(lot.id),
            number: String(lot.number ?? lot.plot_number ?? ''),
            ownerId,
            ownerName: String(lot.ownerName || lot.owner_name || (ownerId ? ownerNames.get(ownerId) : '') || ''),
            area: lot.area != null ? Number(lot.area) : lot.area_sq_yards != null ? Number(lot.area_sq_yards) : null,
          };
        });
        parsedOwners.sort((a, b) => a.name.localeCompare(b.name));
        parsedLots.sort((a, b) => Number(a.number) - Number(b.number));
        setOwners(parsedOwners.filter(owner => parsedLots.some(lot => lot.ownerId === owner.id)));
        setLots(parsedLots);
      })
      .catch(error => {
        console.error('[LandGrid] Failed to load plan', error);
        if (!cancelled) {
          setOwners([]);
          setLots([]);
        }
      });
    return () => { cancelled = true; };
  }, [projectSlug]);

  const ownerMap = useMemo(() => new Map(owners.map(owner => [owner.id, owner])), [owners]);
  const ownerIndex = useMemo(() => new Map(owners.map((owner, index) => [owner.id, index])), [owners]);
  const selectedLots = useMemo(
    () => lots.filter(lot => lot.ownerId != null && selectedOwners.has(String(lot.ownerId))),
    [lots, selectedOwners],
  );
  const selectedYards = useMemo(
    () => selectedLots.reduce((sum, lot) => sum + (Number.isFinite(Number(lot.area)) ? Number(lot.area) : 0), 0),
    [selectedLots],
  );

  const toggleOwner = (ownerId: string) => {
    setSelectedOwners(previous => {
      const next = new Set(previous);
      if (next.has(ownerId)) next.delete(ownerId);
      else next.add(ownerId);
      return next;
    });
  };

  const clearOwners = () => setSelectedOwners(new Set());

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
          polygon.style.removeProperty('fill');
          polygon.style.removeProperty('fill-opacity');
          polygon.style.removeProperty('stroke');
          polygon.style.removeProperty('stroke-width');
          polygon.style.removeProperty('filter');
        }
      });
    };

    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    };

    let attempts = 0;
    const retry = () => {
      if (cancelled || attempts++ >= 15) return;
      run();
      window.setTimeout(retry, 100);
    };
    retry();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [lots, selectedOwners, ownerMap, ownerIndex]);

  const summary = (
    <section className="lg-summary">
      <div className="lg-summary-head">
        <div>
          <strong>Summary</strong>
          <span>{selectedOwners.size ? `${selectedLots.length} plots · ${selectedYards.toLocaleString(undefined, { maximumFractionDigits: 2 })} sq.yd` : 'Select owners to see their plots'}</span>
        </div>
        {selectedOwners.size > 0 && <button type="button" onClick={clearOwners}>Clear</button>}
      </div>

      {selectedOwners.size > 0 && (
        <div className="lg-summary-owners">
          {owners.filter(owner => selectedOwners.has(owner.id)).map(owner => {
            const ownerLots = lots.filter(lot => lot.ownerId === owner.id);
            const yards = ownerLots.reduce((sum, lot) => sum + (Number.isFinite(Number(lot.area)) ? Number(lot.area) : 0), 0);
            const index = ownerIndex.get(owner.id) ?? 0;
            return (
              <div className="lg-owner-summary" key={owner.id}>
                <div className="lg-owner-summary-title">
                  <span className="lg-dot" style={{ background: colorFor(owner, index) }} />
                  <strong>{owner.name}</strong>
                  <span>{ownerLots.length} plots · {yards.toLocaleString(undefined, { maximumFractionDigits: 2 })} sq.yd</span>
                </div>
                <div className="lg-owner-plots">
                  {ownerLots.map(lot => <span key={lot.id}>Plot {lot.number}{lot.area != null ? ` · ${lot.area.toLocaleString()} yd²` : ''}</span>)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  return (
    <div className="lg-shell-overlay">
      <aside className={`lg-left-panel ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Owner filters and summary">
        <button
          type="button"
          className="lg-mobile-toggle"
          onClick={() => setMobileOpen(value => !value)}
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? 'Collapse filters' : 'Open filters'}
        >
          <span className="lg-mobile-handle" />
          <strong>Filters &amp; Summary</strong>
          <span>{mobileOpen ? '⌄' : '⌃'}</span>
        </button>

        <div className="lg-title">
          <strong>Filters &amp; Summary</strong>
          <span>Filter the map by owner and review the selected plots.</span>
        </div>

        <section className="lg-section">
          <button type="button" className="lg-heading" onClick={() => setOwnerOpen(value => !value)}>
            <span className="lg-heading-left">
              {ownerOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              <b>Filter by Owner</b>
            </span>
            {selectedOwners.size > 0 && <span className="lg-count">{selectedOwners.size}</span>}
          </button>

          {ownerOpen && (
            <div className="lg-body">
              <div className="lg-owner-actions">
                <span>{selectedOwners.size ? `${selectedLots.length} plots selected` : 'Select one or more owners'}</span>
                {selectedOwners.size > 0 && <button type="button" onClick={clearOwners}>Clear</button>}
              </div>

              {owners.map((owner, index) => {
                const active = selectedOwners.has(owner.id);
                return (
                  <button
                    key={owner.id}
                    type="button"
                    className={`lg-row lg-owner ${active ? 'active' : ''}`}
                    aria-pressed={active}
                    onClick={() => toggleOwner(owner.id)}
                  >
                    <span className="lg-dot" style={{ background: colorFor(owner, index) }} />
                    <span>{owner.name}</span>
                    <span className="lg-check" aria-hidden="true">{active ? <Check size={12} /> : null}</span>
                  </button>
                );
              })}

              {owners.length === 0 && <div className="lg-empty">No plot owners assigned.</div>}
            </div>
          )}
        </section>

        {summary}
      </aside>

      <style>{`
        .lg-shell-overlay{position:absolute;inset:0;z-index:1000;pointer-events:none}
        .lg-left-panel{position:absolute;left:0;top:0;bottom:0;width:280px;pointer-events:auto;background:#fff;border:1px solid #dbe3ee;box-shadow:0 8px 28px rgba(15,23,42,.16);overflow:auto;font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#172033}
        .lg-left-panel *{box-sizing:border-box}
        .lg-title{padding:14px 15px;border-bottom:1px solid #e2e8f0}
        .lg-title strong{display:block;font-size:14px;font-weight:900}
        .lg-title span{display:block;margin-top:3px;font-size:10px;color:#64748b;line-height:1.45}
        .lg-section,.lg-summary{border-bottom:1px solid #e2e8f0}
        .lg-heading{width:100%;padding:12px 14px;border:0;background:#fff;display:flex;align-items:center;justify-content:space-between;cursor:pointer;color:#172033;text-align:left}
        .lg-heading-left{display:flex;align-items:center;gap:5px}
        .lg-count{min-width:20px;padding:2px 6px;border-radius:99px;background:#172554;color:#fff;text-align:center;font-size:10px;font-weight:800}
        .lg-body{padding:0 10px 10px}
        .lg-owner-actions{display:flex;justify-content:space-between;align-items:center;padding:2px 3px 6px;color:#64748b;font-size:10px}
        .lg-owner-actions button,.lg-summary-head button{border:0;background:none;color:#334155;font-size:10px;font-weight:800;cursor:pointer}
        .lg-row{width:100%;border:0;background:#fff;display:flex;align-items:center;gap:8px;padding:9px 8px;border-radius:8px;cursor:pointer;text-align:left;color:#172033;font-size:12px}
        .lg-row:hover{background:#f8fafc}
        .lg-row.active{background:#eef2ff;font-weight:800}
        .lg-check{margin-left:auto;width:18px;height:18px;display:grid;place-items:center;border-radius:5px;background:#e2e8f0;color:#172554}
        .lg-row.active .lg-check{background:#172554;color:#fff}
        .lg-dot{width:9px;height:9px;min-width:9px;border-radius:50%;display:inline-block}
        .lg-summary{padding:12px}
        .lg-summary-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
        .lg-summary-head strong{display:block;font-size:13px;font-weight:900}
        .lg-summary-head span{display:block;margin-top:3px;color:#64748b;font-size:10px;line-height:1.4}
        .lg-summary-owners{margin-top:10px;display:grid;gap:8px}
        .lg-owner-summary{padding:9px;border:1px solid #e2e8f0;border-radius:9px;background:#f8fafc}
        .lg-owner-summary-title{display:flex;align-items:center;gap:6px;font-size:11px;flex-wrap:wrap}
        .lg-owner-summary-title>span:last-child{width:100%;margin-left:15px;color:#64748b;font-size:10px}
        .lg-owner-plots{display:flex;flex-wrap:wrap;gap:4px;margin-top:7px}
        .lg-owner-plots span{padding:3px 5px;border-radius:5px;background:#fff;border:1px solid #e2e8f0;color:#475569;font-size:9px}
        .lg-empty{padding:12px 5px;color:#64748b;font-size:11px}
        .lg-mobile-toggle{display:none}
        @media(max-width:1100px) and (min-width:768px){.lg-left-panel{width:250px}}
        @media(max-width:767px){
          .lg-left-panel{left:8px;right:8px;bottom:max(8px,env(safe-area-inset-bottom));top:auto;width:auto;height:58px;max-height:58px;overflow:hidden;border-radius:16px;z-index:30}
          .lg-left-panel.mobile-open{height:auto;max-height:min(72dvh,560px);overflow:auto}
          .lg-mobile-toggle{width:100%;height:58px;padding:0 14px;border:0;background:#fff;display:flex;align-items:center;gap:10px;color:#172033;text-align:left;cursor:pointer}
          .lg-mobile-toggle>strong{font-size:13px;flex:1}
          .lg-mobile-handle{width:28px;height:4px;border-radius:99px;background:#cbd5e1}
          .lg-title{display:none}
          .lg-section,.lg-summary{display:block}
        }
      `}</style>
    </div>
  );
}
