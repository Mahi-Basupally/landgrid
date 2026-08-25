'use client';

import { useEffect, useMemo, useState } from 'react';

type Plan = { planType: string; mapUrl: string | null; droneUrl: string | null };

type Props = { projectName: string; projectSlug?: string; sitePlanUrl?: string | null; droneUrl?: string | null };

function planLabel(planType: string) {
  if (planType === 'master_plan') return 'Master Plan';
  const match = planType.match(/^section_(\d+)$/);
  return match ? `Section ${match[1]}` : planType.replace(/_/g, ' ');
}

export default function ProjectPlanViewer({ projectName, projectSlug, sitePlanUrl, droneUrl }: Props) {
  const [view, setView] = useState<'map' | 'drone'>('map');
  const [planType, setPlanType] = useState('master_plan');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [fallback, setFallback] = useState({ sitePlanUrl: sitePlanUrl || '', droneUrl: droneUrl || '' });
  const [loading, setLoading] = useState(Boolean(projectSlug));
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!projectSlug) {
      setFallback({ sitePlanUrl: sitePlanUrl || '', droneUrl: droneUrl || '' });
      setPlans([{ planType: 'master_plan', mapUrl: sitePlanUrl || null, droneUrl: droneUrl || null }]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    fetch(`/api/projects/${encodeURIComponent(projectSlug)}/assets/current`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || `Unable to load project plans (${response.status})`);
        return data;
      })
      .then((data) => {
        if (!active) return;
        const nextPlans: Plan[] = Array.isArray(data?.plans) ? data.plans : [];
        setPlans(nextPlans);
        setFallback({ sitePlanUrl: data.sitePlanUrl || '', droneUrl: data.droneUrl || '' });
        if (nextPlans.length && !nextPlans.some((p) => p.planType === planType)) setPlanType(nextPlans[0].planType);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load project plans');
        setFallback({ sitePlanUrl: sitePlanUrl || '', droneUrl: droneUrl || '' });
      })
      .finally(() => active && setLoading(false));

    return () => { active = false; };
  }, [projectSlug, sitePlanUrl, droneUrl]);

  const selectedPlan = useMemo(() => plans.find((p) => p.planType === planType) || plans[0], [plans, planType]);
  const storageReference = view === 'map' ? selectedPlan?.mapUrl || fallback.sitePlanUrl : selectedPlan?.droneUrl || fallback.droneUrl;
  const imageUrl = storageReference || '';

  return (
    <div className="map-placeholder" style={{ minHeight: 520, position: 'relative', overflow: 'hidden' }}>
      <div className="map-toolbar" style={{ position: 'absolute', top: 12, left: 12, right: 12, zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="eyebrow">{view === 'map' ? 'SITE PLAN' : 'DRONE VIEW'}</div>
          {plans.length > 0 && <select value={selectedPlan?.planType || planType} onChange={(e) => setPlanType(e.target.value)} aria-label="Plan type">
            {plans.map((plan) => <option key={plan.planType} value={plan.planType}>{planLabel(plan.planType)}</option>)}
          </select>}
        </div>
        <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,.96)', padding: 4, borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,.08)' }}>
          <button type="button" onClick={() => setView('map')} style={{ border: 0, borderRadius: 7, padding: '8px 14px', fontSize: 14, fontWeight: 700, lineHeight: 1, color: view === 'map' ? '#fff' : '#1f2937', background: view === 'map' ? '#111827' : 'transparent', cursor: 'pointer' }}>Map</button>
          <button type="button" onClick={() => setView('drone')} style={{ border: 0, borderRadius: 7, padding: '8px 14px', fontSize: 14, fontWeight: 700, lineHeight: 1, color: view === 'drone' ? '#fff' : '#1f2937', background: view === 'drone' ? '#111827' : 'transparent', cursor: 'pointer' }}>Drone</button>
        </div>
      </div>

      {loading ? (
        <div className="map-copy" style={{ minHeight: 520, display: 'grid', placeItems: 'center', padding: 32 }}>Loading project plan…</div>
      ) : imageUrl ? (
        <img src={imageUrl} alt={`${projectName} ${planLabel(selectedPlan?.planType || planType)} ${view === 'map' ? 'map' : 'drone view'}`} style={{ width: '100%', height: '100%', minHeight: 520, objectFit: 'contain', display: 'block', paddingTop: 52 }} onError={() => setLoadError(`Unable to display the ${view === 'map' ? 'map' : 'drone image'}.`)} />
      ) : (
        <div className="map-copy" style={{ minHeight: 520, display: 'grid', placeItems: 'center', padding: 32, textAlign: 'center' }}>Add a {planLabel(selectedPlan?.planType || planType).toLowerCase()} map or drone image.</div>
      )}

      {loadError && <div style={{ position: 'absolute', left: 16, bottom: 16, right: 16, zIndex: 3, padding: '10px 12px', borderRadius: 8, background: '#fff1f2', color: '#991b1b', fontSize: 13 }}>{loadError}</div>}
    </div>
  );
}
