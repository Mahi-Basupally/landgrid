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
  const [loading, setLoading] = useState(Boolean(projectSlug));
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!projectSlug) {
      setAssets({ sitePlanUrl: sitePlanUrl || '', droneUrl: droneUrl || '' });
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setLoadError('');
    fetch(`/api/projects/${encodeURIComponent(projectSlug)}/assets/current`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || `Unable to load project assets (${response.status})`);
        return data;
      })
      .then((data) => {
        if (!active) return;
        setAssets({ sitePlanUrl: data.sitePlanUrl || '', droneUrl: data.droneUrl || '' });
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load project assets');
        setAssets({ sitePlanUrl: sitePlanUrl || '', droneUrl: droneUrl || '' });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [projectSlug, sitePlanUrl, droneUrl]);

  const assetKind = view === 'map' ? 'master-plan' : 'drone';
  const storageReference = view === 'map' ? assets.sitePlanUrl : assets.droneUrl;
  const imageUrl = projectSlug && storageReference
    ? `/api/projects/${encodeURIComponent(projectSlug)}/assets/file?kind=${assetKind}&v=1`
    : '';

  return (
    <div className="map-placeholder" style={{ minHeight: 520, position: 'relative', overflow: 'hidden' }}>
      <div className="map-toolbar" style={{ position: 'absolute', top: 12, left: 12, right: 12, zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div className="eyebrow">{view === 'map' ? 'MASTER PLAN' : 'DRONE VIEW'}</div>
        <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,.96)', padding: 4, borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,.08)' }}>
          <button type="button" onClick={() => setView('map')} style={{ border: 0, borderRadius: 7, padding: '8px 14px', fontSize: 14, fontWeight: 700, lineHeight: 1, color: view === 'map' ? '#fff' : '#1f2937', background: view === 'map' ? '#111827' : 'transparent', cursor: 'pointer' }}>Map</button>
          <button type="button" onClick={() => setView('drone')} style={{ border: 0, borderRadius: 7, padding: '8px 14px', fontSize: 14, fontWeight: 700, lineHeight: 1, color: view === 'drone' ? '#fff' : '#1f2937', background: view === 'drone' ? '#111827' : 'transparent', cursor: 'pointer' }}>Drone</button>
        </div>
      </div>

      {loading ? (
        <div className="map-copy" style={{ minHeight: 520, display: 'grid', placeItems: 'center', padding: 32 }}>Loading project plan…</div>
      ) : imageUrl ? (
        <img
          src={imageUrl}
          alt={`${projectName} ${view === 'map' ? 'master plan' : 'drone view'}`}
          style={{ width: '100%', height: '100%', minHeight: 520, objectFit: 'contain', display: 'block', paddingTop: 52 }}
          onError={() => setLoadError(`Unable to display the ${view === 'map' ? 'master plan' : 'drone image'}.`)}
        />
      ) : (
        <div className="map-copy" style={{ minHeight: 520, display: 'grid', placeItems: 'center', padding: 32, textAlign: 'center' }}>
          {view === 'map' ? 'Add a master plan in Project Settings.' : 'Add a drone image in Project Settings.'}
        </div>
      )}

      {loadError && <div style={{ position: 'absolute', left: 16, bottom: 16, right: 16, zIndex: 3, padding: '10px 12px', borderRadius: 8, background: '#fff1f2', color: '#991b1b', fontSize: 13 }}>{loadError}</div>}
    </div>
  );
}
