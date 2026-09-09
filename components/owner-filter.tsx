'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Users, X } from 'lucide-react';

type Owner = { id: string; name: string; plotNumbers: string[]; color?: string | null };
type Palette = { base: string; light: string; dark: string };

function paletteFor(index: number): Palette {
  const hue = Math.round((index * 137.508) % 360);
  return { base: `hsl(${hue} 78% 52%)`, light: `hsl(${hue} 88% 82%)`, dark: `hsl(${hue} 82% 34%)` };
}

function hexToPalette(hex: string): Palette {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return { base: '#2563eb', light: '#bfdbfe', dark: '#1d4ed8' };
  const n = Number.parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return { base: hex.toUpperCase(), light: `rgb(${Math.min(255, r + 90)},${Math.min(255, g + 90)},${Math.min(255, b + 90)})`, dark: `rgb(${Math.round(r * .65)},${Math.round(g * .65)},${Math.round(b * .65)})` };
}

function slugId(value: string) { return `landgrid-owner-${value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'owner'}`; }

export default function OwnerFilter({ projectSlug }: { projectSlug: string }) {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/projects/${encodeURIComponent(projectSlug)}/plan`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        const ownerMap = new Map<string, Owner>();
        const ownerById = new Map<string, Owner>();
        for (const owner of d.owners || []) ownerById.set(String(owner.id), { id: String(owner.id), name: String(owner.name || 'Unnamed owner'), plotNumbers: [], color: owner.color || null });
        for (const lot of d.lots || []) {
          if (!lot.ownerId) continue;
          const owner = ownerById.get(String(lot.ownerId));
          if (!owner) continue;
          const current = ownerMap.get(owner.id) || { ...owner, plotNumbers: [] };
          current.plotNumbers.push(String(lot.number));
          ownerMap.set(owner.id, current);
        }
        setOwners(Array.from(ownerMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => { if (!cancelled) setOwners([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectSlug]);

  const paletteForOwner = (owner: Owner, index: number) => owner.color ? hexToPalette(owner.color) : paletteFor(index);
  const colorByOwner = useMemo(() => {
    const map = new Map<string, Palette>();
    owners.forEach((owner, index) => map.set(owner.id, paletteForOwner(owner, index)));
    return map;
  }, [owners]);

  useEffect(() => {
    let raf = 0;
    let disposed = false;

    const apply = () => {
      raf = 0;
      if (disposed) return;

      // The project viewer currently renders its lot SVG inside .map-placeholder.
      // Older viewer versions used .pv-canvas. Support both so owner highlighting
      // is not silently skipped when the viewer container changes.
      const svg = document.querySelector('.pv-canvas svg, .map-placeholder svg') as SVGSVGElement | null;
      if (!svg) return;

      let defs = svg.querySelector('defs#landgrid-owner-defs') as SVGDefsElement | null;
      if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.setAttribute('id', 'landgrid-owner-defs');
        svg.prepend(defs);
      }

      colorByOwner.forEach((palette, ownerId) => {
        const id = slugId(ownerId);
        let gradient = defs!.querySelector(`#${CSS.escape(id)}`) as SVGLinearGradientElement | null;
        if (!gradient) {
          gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
          gradient.setAttribute('id', id);
          gradient.setAttribute('x1', '0'); gradient.setAttribute('y1', '0'); gradient.setAttribute('x2', '1'); gradient.setAttribute('y2', '1');
          defs!.appendChild(gradient);
        }
        while (gradient.firstChild) gradient.removeChild(gradient.firstChild);
        [['0%', '#ffffff', '0.78'], ['18%', palette.light, '0.9'], ['52%', palette.base, '0.86'], ['78%', palette.dark, '0.9'], ['100%', '#ffffff', '0.35']].forEach(([offset, color, opacity]) => {
          const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
          stop.setAttribute('offset', offset); stop.setAttribute('stop-color', color); stop.setAttribute('stop-opacity', opacity); gradient!.appendChild(stop);
        });
      });

      const active = selected.size > 0;
      const ownerByPlot = new Map<string, Owner>();
      owners.forEach(owner => owner.plotNumbers.forEach(number => ownerByPlot.set(String(number), owner)));
      const groups = Array.from(svg.querySelectorAll(':scope > g')) as SVGGElement[];

      groups.forEach(group => {
        const polygon = group.querySelector('polygon') as SVGPolygonElement | null;
        if (!polygon) return;
        const texts = group.querySelectorAll('text');
        let owner: Owner | undefined;
        for (const text of Array.from(texts)) {
          const candidate = ownerByPlot.get(text.textContent?.trim() || '');
          if (candidate) { owner = candidate; break; }
        }
        const highlighted = Boolean(owner && selected.has(owner.id));
        if (highlighted) {
          const palette = colorByOwner.get(owner!.id)!;
          polygon.setAttribute('fill', `url(#${slugId(owner!.id)})`);
          polygon.setAttribute('stroke', palette.dark);
          polygon.setAttribute('stroke-width', '3');
          polygon.setAttribute('fill-opacity', '1');
          polygon.style.filter = `drop-shadow(0 2px 6px ${palette.base}99)`;
          group.style.opacity = '1';
          group.style.filter = `drop-shadow(0 1px 4px ${palette.base}66)`;
        } else if (active) {
          polygon.setAttribute('fill', 'rgba(255,255,255,.025)');
          polygon.setAttribute('stroke', 'rgba(148,163,184,.12)');
          polygon.setAttribute('stroke-width', '1');
          polygon.setAttribute('fill-opacity', '1');
          polygon.style.filter = '';
          group.style.opacity = '0.16';
          group.style.filter = '';
        } else {
          const isSelectedLot = group.querySelector('circle[fill="rgba(255,215,0,.9)"]') !== null;
          polygon.setAttribute('fill', isSelectedLot ? 'rgba(255,215,0,.22)' : 'rgba(255,255,255,.18)');
          polygon.setAttribute('stroke', isSelectedLot ? 'rgba(218,165,32,.85)' : 'transparent');
          polygon.setAttribute('stroke-width', isSelectedLot ? '3' : '0');
          polygon.setAttribute('fill-opacity', '1');
          polygon.style.filter = '';
          group.style.opacity = '';
          group.style.filter = '';
        }
      });
    };

    const schedule = () => {
      if (!raf && !disposed) raf = window.requestAnimationFrame(apply);
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setTimeout(schedule, 100);

    return () => {
      disposed = true;
      observer.disconnect();
      window.clearTimeout(timer);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [owners, colorByOwner, selected]);

  const toggle = (id: string) => setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const clear = () => setSelected(new Set());

  async function changeColor(ownerId: string, color: string) {
    const normalized = /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : color;
    setOwners(current => current.map(o => o.id === ownerId ? { ...o, color: normalized } : o));
    try {
      const r = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/owners`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ownerId, color: normalized }) });
      if (!r.ok) throw new Error('Unable to save owner color');
    } catch {
      // Keep the color visible for this session even if the current viewer is not an admin.
    }
  }

  return (
    <div className="landgrid-owner-filter" style={{ position: 'absolute', top: 0, right: 0, width: 330, zIndex: 30, background: 'rgba(255,255,255,.98)', borderBottom: '1px solid #e2e8f0', boxShadow: '0 6px 20px rgba(15,23,42,.08)', backdropFilter: 'blur(12px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 10px' }}>
        <button onClick={() => setOpen(v => !v)} style={{ border: 0, background: 'transparent', padding: 0, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#172033' }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center', background: '#eff6ff', color: '#2563eb' }}><Users size={15} /></span>
          <span style={{ textAlign: 'left' }}><span style={{ display: 'block', fontSize: 11, letterSpacing: .8, fontWeight: 900, color: '#64748b' }}>OWNERS</span><span style={{ display: 'block', fontSize: 13, fontWeight: 850 }}>Highlight by owner</span></span>
          <ChevronDown size={15} style={{ marginLeft: 2, transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
        </button>
        {selected.size > 0 && <button onClick={clear} style={{ border: 0, background: '#f8fafc', color: '#475569', borderRadius: 7, padding: '5px 7px', cursor: 'pointer', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}><X size={12} /> Clear</button>}
      </div>
      {open && <div style={{ borderTop: '1px solid #f1f5f9', padding: '7px 10px 10px', maxHeight: 310, overflowY: 'auto' }}>
        {loading ? <div style={{ padding: 12, color: '#94a3b8', fontSize: 11 }}>Loading owners…</div> : owners.length === 0 ? <div style={{ padding: 12, color: '#94a3b8', fontSize: 11 }}>No plot owners assigned.</div> : owners.map((owner, index) => {
          const palette = paletteForOwner(owner, index);
          const checked = selected.has(owner.id);
          const hex = /^#[0-9a-f]{6}$/i.test(owner.color || '') ? owner.color!.toUpperCase() : '#2563EB';
          return <div key={owner.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px', borderRadius: 8, background: checked ? `${palette.light}66` : 'transparent', border: checked ? `1px solid ${palette.light}` : '1px solid transparent' }}>
            <button type="button" onClick={() => toggle(owner.id)} aria-label={`Highlight ${owner.name}`} style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: 'grid', placeItems: 'center', border: `1.5px solid ${checked ? palette.dark : '#cbd5e1'}`, background: checked ? palette.base : '#fff', color: '#fff', boxShadow: checked ? `0 2px 6px ${palette.base}55` : 'none', cursor: 'pointer', padding: 0 }}>{checked && <Check size={12} strokeWidth={3} />}</button>
            <input aria-label={`Color for ${owner.name}`} type="color" value={hex} onChange={e => void changeColor(owner.id, e.target.value)} style={{ width: 24, height: 24, padding: 0, border: 0, borderRadius: 5, cursor: 'pointer', background: 'transparent' }} title="Choose owner color" />
            <span style={{ minWidth: 0, flex: 1, fontSize: 12, fontWeight: 750, color: '#243047', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{owner.name}</span>
            <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>{owner.plotNumbers.length}</span>
          </div>;
        })}
        {selected.size > 0 && <div style={{ marginTop: 7, padding: '7px 9px', borderRadius: 7, background: '#f8fafc', color: '#64748b', fontSize: 10, lineHeight: 1.4 }}>Selected owners are highlighted directly on the map. Each owner keeps the same chosen color.</div>}
      </div>}
    </div>
  );
}
