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
    <div style={{ height: '100%', minHeight: 0, position: 'relative', overflow: 'hidden' }}>
      <PlotViewer projectSlug={projectSlug} />
      <LandGridFilters projectSlug={projectSlug} />
      <style jsx global>{`
        .app-header,
        .app-header * {
          position: relative;
          z-index: 2147483647 !important;
          pointer-events: auto !important;
        }

        /* The viewer's original sidebars are replaced by LandGrid's
           dedicated filter/information panels. */
        .pv { grid-template-columns: 1fr !important; }
        .pv-left, .pv-right { display: none !important; }
        .pv-canvas { min-width: 0; z-index: 0 !important; }
        .pv-canvas > svg { z-index: 0 !important; }
        .pv-canvas,
        .pv-canvas * { z-index: 0; }

        @media (max-width: 767px) {
          .lg-left-panel {
            top: 64px !important;
            bottom: 58px !important;
          }
        }
      `}</style>
    </div>
  );
}
