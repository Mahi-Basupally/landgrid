'use client';

import { useEffect, useMemo, useState } from 'react';
import ProjectAssetUpload from './ProjectAssetUpload';

type Plan = { id: string; plan_type: string; map_url: string | null; drone_url: string | null };

function label(type: string) {
  if (type === 'master_plan') return 'Master Plan';
  const match = type.match(/^section_(\d+)$/);
  return match ? `Section ${match[1]}` : type;
}

export default function ProjectPlansManager({ slug }: { slug: string }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState('master_plan');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  async function loadPlans() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(slug)}/plans`, { cache: 'no-store', credentials: 'same-origin' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load plans');
      const next = Array.isArray(data.plans) ? data.plans : [];
      setPlans(next);
      if (next.length && !next.some((p: Plan) => p.plan_type === selected)) setSelected(next[0].plan_type);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load plans');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadPlans(); }, [slug]);

  const current = useMemo(() => plans.find((p) => p.plan_type === selected) || null, [plans, selected]);

  async function addSection() {
    setAdding(true);
    setError('');
    try {
      const used = plans.map((p) => Number(p.plan_type.match(/^section_(\d+)$/)?.[1] || 0)).filter(Number.isFinite);
      const nextNumber = Math.max(0, ...used) + 1;
      const planType = `section_${nextNumber}`;
      const response = await fetch(`/api/projects/${encodeURIComponent(slug)}/plans`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ planType }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to add section');
      await loadPlans();
      setSelected(planType);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to add section');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
        <label style={{ minWidth: 220, flex: 1 }}>Plan type
          <select value={selected} onChange={(e) => setSelected(e.target.value)} disabled={loading}>
            {plans.map((plan) => <option key={plan.plan_type} value={plan.plan_type}>{label(plan.plan_type)}</option>)}
          </select>
        </label>
        <button type="button" className="button secondary" onClick={addSection} disabled={adding}>{adding ? 'Adding…' : '+ Add section'}</button>
      </div>
      {current && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>
        <div><label>Map</label><ProjectAssetUpload slug={slug} kind="master-plan" planType={current.plan_type} currentUrl={current.map_url} accept="image/svg+xml,image/png,image/jpeg,image/webp" /></div>
        <div><label>Drone</label><ProjectAssetUpload slug={slug} kind="drone" planType={current.plan_type} currentUrl={current.drone_url} accept="image/svg+xml,image/png,image/jpeg,image/webp" /></div>
      </div>}
      {error && <small style={{ color: '#b91c1c' }}>{error}</small>}
    </div>
  );
}
