'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';

type Props = { projectName: string; projectSlug?: string; sitePlanUrl?: string | null; droneUrl?: string | null; editable?: boolean };
type Section = { id: string; name: string; sortOrder: number; masterPlanUrl?: string | null; droneUrl?: string | null };
type Lot = { id: string; number: string; status: string; owner: string; price: number | string | null; area: number | string | null; direction: string; model?: string; points: string; labelX: number; labelY: number; sectionId?: string | null };

function parsePoints(value: string) { return value.trim().split(/\s+/).map((p) => p.split(',').map(Number)).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])).map(([x, y]) => ({ x, y })); }
function bounds(lots: Lot[]) { const points = lots.flatMap((l) => parsePoints(l.points)); if (!points.length) return { minX: 0, minY: 0, maxX: 1600, maxY: 1000 }; return { minX: Math.min(...points.map((p) => p.x)), minY: Math.min(...points.map((p) => p.y)), maxX: Math.max(...points.map((p) => p.x)), maxY: Math.max(...points.map((p) => p.y)) }; }

export default function ProjectPlanViewer({ projectName, projectSlug, sitePlanUrl, droneUrl, editable = false }: Props) {
  const [view, setView] = useState<'map' | 'drone'>('map');
  const [sections, setSections] = useState<Section[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [sectionId, setSectionId] = useState('master_plan');
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(projectSlug));
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!projectSlug) { setLoading(false); return; }
    fetch(`/api/projects/${encodeURIComponent(projectSlug)}/plan`, { cache: 'no-store' }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Unable to load project plan'); return d; }).then((d) => {
      const loaded = d.sections || [];
      setSections(loaded); setLots(d.lots || []);
      setSectionId((prev) => loaded.some((s: Section) => s.id === prev) ? prev : loaded[0]?.id || 'master_plan');
    }).catch((e) => setError(e instanceof Error ? e.message : 'Unable to load project plan')).finally(() => setLoading(false));
  }, [projectSlug]);

  const current = sections.find((s) => s.id === sectionId) || sections[0];
  const currentId = current?.id || 'master_plan';
  const sectionLots = useMemo(() => lots.filter((l) => (l.sectionId || 'master_plan') === currentId), [lots, currentId]);
  const viewLots = sectionLots;
  const b = useMemo(() => bounds(viewLots), [viewLots]);
  const viewBox = `${b.minX - 100} ${b.minY - 100} ${Math.max(1, b.maxX - b.minX + 200)} ${Math.max(1, b.maxY - b.minY + 200)}`;
  const imageUrl = projectSlug && current ? (view === 'map' ? (current.masterPlanUrl ? `/api/projects/${encodeURIComponent(projectSlug)}/assets/file?kind=master-plan&planType=${encodeURIComponent(current.id)}` : '') : (current.droneUrl ? `/api/projects/${encodeURIComponent(projectSlug)}/assets/file?kind=drone&planType=${encodeURIComponent(current.id)}` : '')) : (view === 'map' ? sitePlanUrl || '' : droneUrl || '');

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file || !projectSlug || !current) return;
    setUploading(true); setError('');
    try {
      const form = new FormData(); form.append('file', file); form.append('planType', current.id); form.append('kind', view === 'map' ? 'master-plan' : 'drone');
      const response = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/assets`, { method: 'POST', body: form, credentials: 'same-origin' });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Upload failed');
      setSections((items) => items.map((s) => s.id === current.id ? { ...s, ...(view === 'map' ? { masterPlanUrl: data.savedValue } : { droneUrl: data.savedValue }) } : s));
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed'); }
    finally { setUploading(false); event.target.value = ''; }
  }

  if (loading) return <div className="map-placeholder" style={{ minHeight: 520, display: 'grid', placeItems: 'center' }}>Loading project plan…</div>;

  return <div style={{ display: 'grid', gap: 16 }}>
    <div className="map-placeholder" style={{ minHeight: 560, position: 'relative', overflow: 'hidden', background: '#eef0f3', borderRadius: 14 }}>
      {imageUrl ? <img src={imageUrl} alt={`${projectName} ${current?.name || 'plan'} ${view}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' }} /> : <div className="map-copy" style={{ height: '100%', display: 'grid', placeItems: 'center' }}>Add a {view === 'map' ? 'site plan' : 'drone image'} for {current?.name || 'Master'}.</div>}
      <div style={{ position: 'absolute', top: 14, left: 14, right: 14, zIndex: 5, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: 10, borderRadius: 12, background: 'rgba(255,255,255,.94)', boxShadow: '0 4px 18px rgba(0,0,0,.14)' }}>
        <label style={{ fontSize: 12, fontWeight: 800 }}>Plan <select value={currentId} onChange={(e) => { setSectionId(e.target.value); setSelected(null); }}>{sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <button type="button" onClick={() => setView('map')} style={{ padding: '7px 11px', fontWeight: 800 }}>Map</button><button type="button" onClick={() => setView('drone')} style={{ padding: '7px 11px', fontWeight: 800 }}>Drone</button>
        {editable && <><button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}><Upload size={15} /> {uploading ? 'Uploading…' : `Upload ${view}`}</button><input ref={fileRef} hidden type="file" accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp" onChange={upload} /></>}
        <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700 }}>{current?.name || 'Master'}</span>
      </div>
      <svg viewBox={viewBox} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>{viewLots.map((lot) => <g key={lot.id} onClick={() => setSelected(lot.id)} style={{ cursor: 'pointer' }}><polygon points={lot.points} fill={selected === lot.id ? 'rgba(37,99,235,.35)' : 'rgba(37,99,235,.12)'} stroke={selected === lot.id ? '#2457d6' : '#fff'} strokeWidth={selected === lot.id ? 4 : 2} /><text x={lot.labelX} y={lot.labelY} textAnchor="middle" dominantBaseline="middle" fontSize="24" fontWeight="800" fill="#172033" paintOrder="stroke" stroke="#fff" strokeWidth="5">{lot.number}</text></g>)}</svg>
      {error && <div style={{ position: 'absolute', left: 16, right: 16, bottom: 16, zIndex: 6, padding: 10, borderRadius: 8, background: '#fff1f2', color: '#991b1b', fontWeight: 600 }}>{error}</div>}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 8 }}>{viewLots.map((lot) => <button key={lot.id} onClick={() => setSelected(lot.id)} style={{ textAlign: 'left', padding: '10px 12px', border: '1px solid #e4e7ec', borderRadius: 9, background: selected === lot.id ? '#eef2ff' : '#fff' }}><b>Lot {lot.number}</b><div style={{ fontSize: 11, color: '#667085', marginTop: 3 }}>{lot.status}{lot.area != null ? ` · ${lot.area} area` : ''}</div></button>)}</div>
  </div>;
}
