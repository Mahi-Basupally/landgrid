'use client';
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useHeader } from '@/lib/header-context';
import LandGridFilters from './landgrid-filters';

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
  useEffect(() => { setState({ projectName, isLoggedIn }); }, [projectName, isLoggedIn, setState]);
  return (
    <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <PlotViewer projectSlug={projectSlug} />
      <LandGridFilters projectSlug={projectSlug} />
      <style jsx global>{`
        .pv { grid-template-columns: 1fr !important; }
        .pv-left, .pv-right { display: none !important; }
        .pv-canvas { min-width: 0; }
        @media (max-width: 767px) {
          .lg-filter-panel { top: auto; bottom: 58px; height: auto; max-height: 70vh; border-right: 0; border-radius: 0 14px 0 0; box-shadow: 0 -4px 18px rgba(15,23,42,.12); }
          .lg-info-panel { display: none !important; }
        }
      `}</style>
    </div>
  );
}
