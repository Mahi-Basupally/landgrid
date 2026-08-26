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

export default function PlotViewerShell({ projectSlug, projectName }: { projectSlug: string; projectName: string }) {
  const { setState } = useHeader();
  useEffect(() => { setState({ projectName }); }, [projectName]);
  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <PlotViewer projectSlug={projectSlug} />
    </div>
  );
}
