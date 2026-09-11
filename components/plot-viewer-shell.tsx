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
    <div className="lg-viewer-shell">
      <PlotViewer projectSlug={projectSlug} />
      <LandGridFilters projectSlug={projectSlug} />
      <style jsx global>{`
        .lg-viewer-shell {
          position: relative;
          height: 100%;
          min-height: 0;
          overflow: hidden;
        }

        .app-header,
        .app-header * {
          position: relative;
          z-index: 2147483647 !important;
          pointer-events: auto !important;
        }

        /* Reserve the left and right navigation widths in the map itself.
           The map therefore starts after the filter panel instead of sitting
           underneath it. */
        .lg-viewer-shell .pv {
          grid-template-columns: minmax(0, 1fr) !important;
          margin-left: 280px !important;
          margin-right: 320px !important;
          width: calc(100% - 600px) !important;
        }

        .lg-viewer-shell .pv-left,
        .lg-viewer-shell .pv-right {
          display: none !important;
        }

        .lg-viewer-shell .pv-canvas {
          min-width: 0;
          min-height: 0;
          position: relative;
          z-index: 0 !important;
        }

        .lg-viewer-shell .pv-canvas > svg,
        .lg-viewer-shell .pv-canvas svg {
          z-index: 0 !important;
        }

        /* Fully isolate the filter/report UI from map pointer handling. */
        .lg-filter-panel,
        .lg-info-panel {
          position: fixed !important;
          z-index: 2147483647 !important;
          pointer-events: auto !important;
          isolation: isolate !important;
          user-select: auto !important;
        }

        .lg-filter-panel button,
        .lg-filter-panel input,
        .lg-info-panel button,
        .lg-info-panel input {
          pointer-events: auto !important;
          position: relative !important;
          z-index: 2 !important;
        }

        .lg-filter-panel button,
        .lg-info-panel button {
          touch-action: manipulation !important;
        }

        /* On desktop the filters own their full-height columns. */
        @media (min-width: 768px) {
          .lg-filter-panel {
            top: 64px !important;
            bottom: 0 !important;
            left: 0 !important;
            width: 280px !important;
            overflow-y: auto !important;
          }
          .lg-info-panel {
            top: 64px !important;
            bottom: 0 !important;
            right: 0 !important;
            width: 320px !important;
          }
        }

        @media (max-width: 767px) {
          .lg-viewer-shell .pv {
            margin-left: 0 !important;
            margin-right: 0 !important;
            width: 100% !important;
          }

          .lg-filter-panel {
            top: auto !important;
            bottom: 58px !important;
            left: 0 !important;
            width: min(86vw, 320px) !important;
            max-height: 70vh !important;
            overflow-y: auto !important;
            border-right: 0;
            border-radius: 0 14px 0 0;
          }

          .lg-info-panel {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
