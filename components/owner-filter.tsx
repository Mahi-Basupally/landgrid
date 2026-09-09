'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Users, X } from 'lucide-react';

type Owner = { id: string; name: string; plotNumbers: string[]; color?: string | null };
type Lot = { id: string; number: string; ownerId?: string | null; points: string };
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
  return {
    base: hex.toUpperCase(),
    light: `rgb(${Math.min(255, r + 90)},${Math.min(255, g + 90)},${Math.min(255, b + 90)})`,
    dark: `rgb(${Math.round(r * .65)},${Math.round(g * .65)},${Math.round(b * .65)})`,
  };
}

const parsePoints = (s: string) => s.trim().split(/\s+/).filter(Boolean).map(v => {
  const [x, y] = v.split(',').map(Number);
  return { x, y };
}).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));

function OwnerHighlightOverlay({ selected, owners, lots, colors }: {
  selected: Set<string>; owners: Owner[]; lots: Lot[]; colors: Map<string, Palette>;
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [viewBox, setViewBox] = useState('0 0 1600 1000');

  useEffect(() => {
    let disposed = false;
    let raf = 0;
    let timer = 0;
    const sync = () => {
      if (disposed) return;
      const canvas = document.querySelector('.pv-canvas') as HTMLElement | null;
      const svg = canvas?.querySelector('svg') as SVGSVGElement | null;
      if (!canvas || !svg) {
        timer = window.setTimeout(sync, 100);
        return;
      }
      setHost(canvas);
      const vb = svg.getAttribute('viewBox');
      if (vb) setViewBox(vb);
    };
    sync();
    const observer = new MutationObserver(() => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const svg = document.querySelector('.pv-canvas svg') as SVGSVGElement | null;
        const vb = svg?.getAttribute('viewBox');
        if (vb) setViewBox(vb);
        const canvas = document.querySelector('.pv-canvas') as HTMLElement | null;
        if (canvas) setHost(canvas);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['viewBox'] });
    return () => { disposed = true; observer.disconnect(); if (raf) cancelAnimationFrame(raf); if (timer) clearTimeout(timer); };
  }, []);

  if (!host || selected.size === 0) return null;
  const ownerById = new Map(owners.map(o => [o.id, o]));
  const highlighted = lots.filter(l => l.ownerId && selected.has(String(l.ownerId)) && l.points);

  return createPortal(
    <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 4, pointerEvents: 'none' }}>
      {highlighted.map(lot => {
        const owner = ownerById.get(String(lot.ownerId));
        if (!owner) return null;
        const q = parsePoints(lot.points);
        if (q.length < 3) return null;
        const palette = colors.get(owner.id) || paletteFor(0);
        return <polygon key={lot.id} points={q.map(p => `${p.x},${p.y}`).join(' ')}
          fill={palette.base} fillOpacity="0.68" stroke={palette.dark} strokeWidth="4"
          vectorEffect="non-scaling-stroke" />;
      })}
    </svg>, host
  );
}

export default function OwnerFilter({ projectSlug }: { projectSlug: string }) {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
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
        const rawOwners = d.owners || [];
        const ownerById = new Map<string, Owner>();
        rawOwners.forEach((o: any) => ownerById.set(String(o.id), {
          id: String(o.id), name: String(o.name || 'Unnamed owner'), plotNumbers: [], color: o.color || null,
        }));
        const rawLots: Lot[] = (d.lots || []).map((l: any) => ({ id: String(l.id), number: String(l.number), ownerId: l.ownerId ? String(l.ownerId) : null, points: l.points || '' }));
        const ownerMap = new Map<string, Owner>();
        rawLots.forEach(lot => {
          if (!lot.ownerId) return;
          const owner = ownerById.get(lot.ownerId);
          if (!owner) return;
          const current = ownerMap.get(owner.id) || { ...owner, plotNumbers: [] };
          current.plotNumbers.push(lot.number);
          ownerMap.set(owner.id, current);
        });
        setLots(rawLots);
        setOwners(Array.from(ownerMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => { if (!cancelled) { setOwners([]); setLots([]); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectSlug]);

  const paletteForOwner = (owner: Owner, index: number) => owner.color ? hexToPalette(owner.color) : paletteFor(index);
  const colorByOwner = useMemo(() => {
    const map = new Map<string, Palette>();
    owners.forEach((owner, index) => map.set(owner.id, paletteForOwner(owner, index)));
    return map;
  }, [owners]);

  const toggle = (id: string) => setSelected(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const clear = () => setSelected(new Set());

  async function changeColor(ownerId: string, color: string) {
    const normalized = /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : color;
    setOwners(current => current.map(o => o.id === ownerId ? { ...o, color: normalized } : o));
    try {
      const r = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/owners`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ownerId, color: normalized }),
      });
      if (!r.ok) throw new Error('Unable to save owner color');
    } catch { /* keep the new color visible for this session */ }
  }

  return (
    <>
      <OwnerHighlightOverlay selected={selected} owners={owners} lots={lots} colors={colorByOwner} />
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
          {selected.size > 0 && <div style={{ marginTop: 7, padding: '7px 9px', borderRadius: 7, background: '#f8fafc', color: '#64748b', fontSize: 10, lineHeight: 1.4 }}>Selected owners are highlighted directly on the map. Multiple owners can be selected at the same time.</div>}
        </div>}
      </div>
    </>
  );
}
