'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Users, X } from 'lucide-react';

type Owner = { id: string; name: string; plotNumbers: string[] };
type Palette = { base: string; light: string; dark: string };

const PALETTE: Palette[] = [
  { base: '#0ea5e9', light: '#bae6fd', dark: '#0369a1' },
  { base: '#8b5cf6', light: '#ddd6fe', dark: '#6d28d9' },
  { base: '#ec4899', light: '#fbcfe8', dark: '#be185d' },
  { base: '#f97316', light: '#fed7aa', dark: '#c2410c' },
  { base: '#10b981', light: '#a7f3d0', dark: '#047857' },
  { base: '#eab308', light: '#fef08a', dark: '#a16207' },
  { base: '#06b6d4', light: '#a5f3fc', dark: '#0e7490' },
  { base: '#ef4444', light: '#fecaca', dark: '#b91c1c' },
  { base: '#14b8a6', light: '#99f6e4', dark: '#0f766e' },
  { base: '#6366f1', light: '#c7d2fe', dark: '#4338ca' },
  { base: '#f43f5e', light: '#fecdd3', dark: '#be123c' },
  { base: '#84cc16', light: '#d9f99d', dark: '#4d7c0f' },
];

function paletteFor(index: number) { return PALETTE[index % PALETTE.length]; }
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
        const ownerById = new Map<string, string>();
        for (const owner of d.owners || []) ownerById.set(String(owner.id), String(owner.name || 'Unnamed owner'));
        for (const lot of d.lots || []) {
          if (!lot.ownerId) continue;
          const id = String(lot.ownerId);
          const name = ownerById.get(id);
          if (!name) continue;
          const current = ownerMap.get(id) || { id, name, plotNumbers: [] };
          current.plotNumbers.push(String(lot.number));
          ownerMap.set(id, current);
        }
        setOwners(Array.from(ownerMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => { if (!cancelled) setOwners([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectSlug]);

  const colorByOwner = useMemo(() => {
    const map = new Map<string, Palette>();
    owners.forEach((owner, index) => map.set(owner.id, paletteFor(index)));
    return map;
  }, [owners]);

  useEffect(() => {
    const apply = () => {
      const svg = document.querySelector('.pv-canvas svg') as SVGSVGElement | null;
      if (!svg) return;

      let defs = svg.querySelector('defs#landgrid-owner-defs') as SVGDefsElement | null;
      if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.setAttribute('id', 'landgrid-owner-defs');
        svg.prepend(defs);
      }

      colorByOwner.forEach((palette, ownerId) => {
        const id = slugId(ownerId);
        if (defs!.querySelector(`#${CSS.escape(id)}`)) return;
        const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        gradient.setAttribute('id', id);
        gradient.setAttribute('x1', '0'); gradient.setAttribute('y1', '0');
        gradient.setAttribute('x2', '1'); gradient.setAttribute('y2', '1');
        [['0%', '#ffffff', '0.88'], ['18%', palette.light, '0.9'], ['52%', palette.base, '0.82'], ['78%', palette.dark, '0.88'], ['100%', '#ffffff', '0.42']].forEach(([offset, color, opacity]) => {
          const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
          stop.setAttribute('offset', offset); stop.setAttribute('stop-color', color); stop.setAttribute('stop-opacity', opacity); gradient.appendChild(stop);
        });
        defs!.appendChild(gradient);
      });

      const active = selected.size > 0;
      const groups = Array.from(svg.querySelectorAll(':scope > g')) as SVGGElement[];
      groups.forEach(group => {
        const number = group.querySelector('text')?.textContent?.trim();
        const polygon = group.querySelector('polygon') as SVGPolygonElement | null;
        if (!number || !polygon) return;
        const owner = owners.find(o => o.plotNumbers.includes(number));
        const highlighted = Boolean(owner && selected.has(owner.id));

        if (highlighted) {
          const palette = colorByOwner.get(owner!.id)!;
          polygon.setAttribute('fill', `url(#${slugId(owner!.id)})`);
          polygon.setAttribute('stroke', palette.dark);
          polygon.setAttribute('stroke-width', '2.5');
          polygon.setAttribute('fill-opacity', '0.98');
          polygon.style.filter = `drop-shadow(0 2px 5px ${palette.base}66)`;
          group.style.opacity = '1';
          group.style.filter = `drop-shadow(0 1px 3px ${palette.base}55)`;
        } else if (active) {
          polygon.setAttribute('fill', 'rgba(255,255,255,.055)');
          polygon.setAttribute('stroke', 'transparent');
          polygon.setAttribute('stroke-width', '0');
          polygon.setAttribute('fill-opacity', '1');
          polygon.style.filter = '';
          group.style.opacity = '0.28';
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

    apply();
    const observer = new MutationObserver(() => apply());
    const timer = window.setTimeout(apply, 50);
    const interval = window.setInterval(apply, 250);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['points', 'viewBox'] });
    return () => { observer.disconnect(); window.clearTimeout(timer); window.clearInterval(interval); };
  }, [owners, colorByOwner, selected]);

  const toggle = (id: string) => setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const clear = () => setSelected(new Set());

  return (
    <div className="landgrid-owner-filter" style={{ position: 'absolute', top: 0, right: 0, width: 300, zIndex: 30, background: 'rgba(255,255,255,.98)', borderBottom: '1px solid #e2e8f0', boxShadow: '0 6px 20px rgba(15,23,42,.08)', backdropFilter: 'blur(12px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 10px' }}>
        <button onClick={() => setOpen(v => !v)} style={{ border: 0, background: 'transparent', padding: 0, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#172033' }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center', background: '#eff6ff', color: '#2563eb' }}><Users size={15} /></span>
          <span style={{ textAlign: 'left' }}><span style={{ display: 'block', fontSize: 11, letterSpacing: .8, fontWeight: 900, color: '#64748b' }}>OWNERS</span><span style={{ display: 'block', fontSize: 13, fontWeight: 850 }}>Highlight by owner</span></span>
          <ChevronDown size={15} style={{ marginLeft: 2, transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
        </button>
        {selected.size > 0 && <button onClick={clear} style={{ border: 0, background: '#f8fafc', color: '#475569', borderRadius: 7, padding: '5px 7px', cursor: 'pointer', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}><X size={12} /> Clear</button>}
      </div>
      {open && <div style={{ borderTop: '1px solid #f1f5f9', padding: '7px 10px 10px', maxHeight: 255, overflowY: 'auto' }}>
        {loading ? <div style={{ padding: 12, color: '#94a3b8', fontSize: 11 }}>Loading owners…</div> : owners.length === 0 ? <div style={{ padding: 12, color: '#94a3b8', fontSize: 11 }}>No plot owners assigned.</div> : owners.map(owner => {
          const palette = colorByOwner.get(owner.id)!;
          const checked = selected.has(owner.id);
          return <label key={owner.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px', borderRadius: 8, cursor: 'pointer', background: checked ? `${palette.light}66` : 'transparent', border: checked ? `1px solid ${palette.light}` : '1px solid transparent' }}>
            <input type="checkbox" checked={checked} onChange={() => toggle(owner.id)} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
            <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: 'grid', placeItems: 'center', border: `1.5px solid ${checked ? palette.dark : '#cbd5e1'}`, background: checked ? palette.base : '#fff', color: '#fff', boxShadow: checked ? `0 2px 6px ${palette.base}55` : 'none' }}>{checked && <Check size={12} strokeWidth={3} />}</span>
            <span style={{ width: 12, height: 12, borderRadius: 4, flexShrink: 0, background: `linear-gradient(135deg,#fff,${palette.base} 55%,${palette.dark})`, boxShadow: `0 1px 3px ${palette.base}55` }} />
            <span style={{ minWidth: 0, flex: 1, fontSize: 12, fontWeight: 750, color: '#243047', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{owner.name}</span>
            <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>{owner.plotNumbers.length}</span>
          </label>;
        })}
        {selected.size > 0 && <div style={{ marginTop: 7, padding: '7px 9px', borderRadius: 7, background: '#f8fafc', color: '#64748b', fontSize: 10, lineHeight: 1.4 }}>Selected owners are shown as glossy colored plots. Each owner keeps the same unique color across the map.</div>}
      </div>}
    </div>
  );
}
