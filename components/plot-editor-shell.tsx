'use client';
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useHeader } from '@/lib/header-context';

const PlotEditor = dynamic(() => import('./plot-editor'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#64748b' }}>
      Loading editor…
    </div>
  ),
});

export default function PlotEditorShell({ projectSlug }: { projectSlug: string }) {
  const { setState } = useHeader();

  useEffect(() => {
    let active = true;
    fetch(`/api/projects/${encodeURIComponent(projectSlug)}/plan`, { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; })
      .then(d => { if (active && d.project?.name) setState({ projectName: String(d.project.name) }); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [projectSlug]);

  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <PlotEditor
        projectSlug={projectSlug}
        onStatusChange={msg => setState({ message: msg })}
      />
    </div>
  );
}
