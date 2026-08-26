'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import AppHeader from './app-header';

const PlotEditor = dynamic(() => import('./plot-editor'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#64748b' }}>
      Loading editor…
    </div>
  ),
});

export default function PlotEditorShell({ projectSlug }: { projectSlug: string }) {
  const [projectName, setProjectName] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    let active = true;
    fetch(`/api/projects/${encodeURIComponent(projectSlug)}/plan`, { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; })
      .then(d => { if (active && d.project?.name) setProjectName(String(d.project.name)); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [projectSlug]);

  return (
    <div style={{ height: '100vh', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
      <AppHeader projectName={projectName} pageHeading="Map & Manage" showSave message={statusMessage} />
      <div style={{ minHeight: 0, overflow: 'hidden' }}>
        <PlotEditor projectSlug={projectSlug} onStatusChange={setStatusMessage} />
      </div>
    </div>
  );
}
