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
    <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative', isolation: 'isolate' }}>
      <PlotViewer projectSlug={projectSlug} />
      <LandGridFilters projectSlug={projectSlug} />
      <style jsx global>{`
        .pv { grid-template-columns: 1fr !important; pointer-events: none !important; }
        .pv-left, .pv-right { display: none !important; }
        .pv-canvas { min-width: 0; position: relative; z-index: 0 !important; pointer-events: auto !important; }

        /* Keep the map interactive while ensuring it can never sit above the filter UI. */
        .lg-filter-panel, .lg-info-panel {
          position: absolute !important;
          z-index: 2147483647 !important;
          pointer-events: auto !important;
          isolation: isolate;
          touch-action: auto !important;
        }
        .lg-filter-panel *, .lg-info-panel * {
          pointer-events: auto !important;
        }
        .lg-filter-heading, .lg-owner-row, .lg-status-row, .lg-plot-row, .lg-clear, .lg-search, .lg-search-wrap button {
          position: relative;
          z-index: 2147483647;
          pointer-events: auto !important;
          touch-action: manipulation;
        }
        .lg-filter-heading:active, .lg-owner-row:active, .lg-status-row:active, .lg-plot-row:active {
          transform: translateY(1px);
        }

        @media (max-width: 767px) {
          .lg-filter-panel { top: auto !important; bottom: 58px !important; height: auto !important; max-height: 70vh; border-right: 0; border-radius: 0 14px 0 0; box-shadow: 0 -4px 18px rgba(15,23,42,.12); }
          .lg-info-panel { display: none !important; }
        }
      `}</style>
    </div>
  );
}
