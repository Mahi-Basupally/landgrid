'use client';

import { useState } from 'react';

type Props = {
  projectName: string;
  sitePlanUrl?: string | null;
  droneUrl?: string | null;
};

export default function ProjectPlanViewer({ projectName, sitePlanUrl, droneUrl }: Props) {
  const [view, setView] = useState<'map' | 'drone'>('map');
  const url = view === 'map' ? sitePlanUrl : droneUrl;

  return (
    <div className="map-placeholder" style={{ minHeight: 520, position: 'relative', overflow: 'hidden' }}>
      <div className="map-toolbar" style={{ position: 'absolute', top: 12, left: 12, right: 12, zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="eyebrow">{view === 'map' ? 'MASTER PLAN' : 'DRONE VIEW'}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className={`button ${view === 'map' ? 'primary' : 'secondary'}`} onClick={() => setView('map')}>Map</button>
          <button type="button" className={`button ${view === 'drone' ? 'primary' : 'secondary'}`} onClick={() => setView('drone')}>Drone</button>
        </div>
      </div>
      {url ? (
        <img src={url} alt={`${projectName} ${view === 'map' ? 'master plan' : 'drone view'}`} style={{ width: '100%', height: '100%', minHeight: 520, objectFit: 'contain', display: 'block', paddingTop: 52 }} />
      ) : (
        <div className="map-copy" style={{ minHeight: 520, display: 'grid', placeItems: 'center', padding: 32, textAlign: 'center' }}>
          {view === 'map' ? 'Add a master plan in Project Settings.' : 'Add a drone image in Project Settings.'}
        </div>
      )}
    </div>
  );
}
