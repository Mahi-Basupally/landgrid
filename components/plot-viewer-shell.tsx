'use client';
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useHeader } from '@/lib/header-context';

const PlotViewer = dynamic(() => import('./plot-viewer'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#64748b' }}>
      Loading plan…
    </div>
  ),
});

export default function PlotViewerShell({ projectSlug, projectName, isLoggedIn = false }: { projectSlug: string; projectName: string; isLoggedIn?: boolean }) {
  const { setState } = useHeader();
  useEffect(() => { setState({ projectName, isLoggedIn }); }, [projectName, isLoggedIn]);
  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <PlotViewer projectSlug={projectSlug} />
    </div>
  );
}
