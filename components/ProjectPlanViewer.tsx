'use client';

import { useEffect, useState } from 'react';

type Props = {
  projectName: string;
  projectSlug?: string;
  sitePlanUrl?: string | null;
  droneUrl?: string | null;
};

export default function ProjectPlanViewer({ projectName, projectSlug, sitePlanUrl, droneUrl }: Props) {
  const [view, setView] = useState<'map' | 'drone'>('map');
  const [assets, setAssets] = useState({ sitePlanUrl: sitePlanUrl || '', droneUrl: droneUrl || '' });

  useEffect(() => {
    setAssets({ sitePlanUrl: sitePlanUrl || '', droneUrl: droneUrl || '' });
  }, [sitePlanUrl, droneUrl]);

  useEffect(() => {
    if (!projectSlug) return;
    let active = true;
    fetch(`/api/projects/${encodeURIComponent(projectSlug)}/assets/current`, { cache: 'no-store', credentials: 'same-origin' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (active && data) setAssets({ sitePlanUrl: data.sitePlanUrl || '', droneUrl: data.droneUrl || '' });
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [projectSlug]);

  const url = view === 'map' ? assets.sitePlanUrl : assets.droneUrl;

  return (
    <div className="map-placeholder" style={{ minHeight: 520, position: 'relative', overflow: 'hidden' }}>
      <div className="map-toolbar" style={{ position: 'absolute', top: 12, left: 12, right: 12, zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div className="eyebrow">{view === 'map' ? 'MASTER PLAN' : 'DRONE VIEW'}</div>
        <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,.92)', padding: 4, borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,.08)' }}>
          <button type="button" onClick={() => setView('map')} style={{ border: 0, borderRadius: 7, padding: '8px 14px', fontSize: 14, fontWeight: 700, lineHeight: 1, color: view === 'map' ? '#fff' : '#1f2937', background: view === 'map' ? '#111827' : 'transparent', cursor: 'pointer' }}>Map</button>
          <button type="button" onClick={() => setView('drone')} style={{ border: 0, borderRadius: 7, padding: '8px 14px', fontSize: 14, fontWeight: 700, lineHeight: 1, color: view === 'drone' ? '#fff' : '#1f2937', background: view === 'drone' ? '#111827' : 'transparent', cursor: 'pointer' }}>Drone</button>
        </div>
      </div>
      {url ? (
        <img src={`${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(url)}`} alt={`${projectName} ${view === 'map' ? 'master plan' : 'drone view'}`} style={{ width: '100%', height: '100%', minHeight: 520, objectFit: 'contain', display: 'block', paddingTop: 52 }} />
      ) : (
        <div className="map-copy" style={{ minHeight: 520, display: 'grid', placeItems: 'center', padding: 32, textAlign: 'center' }}>
          {view === 'map' ? 'Add a master plan in Project Settings.' : 'Add a drone image in Project Settings.'}
        </div>
      )}
    </div>
  );
}
