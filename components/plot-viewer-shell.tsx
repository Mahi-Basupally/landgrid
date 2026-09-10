'use client';
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useHeader } from '@/lib/header-context';
import OwnerFilter from './owner-filter';

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
    <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <PlotViewer projectSlug={projectSlug} />
      <OwnerFilter projectSlug={projectSlug} />
      <style jsx global>{`
        /* Desktop: keep every filter/find control on the left and property/report information on the right. */
        .landgrid-owner-filter {
          left: 8px !important;
          right: auto !important;
          top: 320px !important;
          width: 244px !important;
          max-height: calc(100% - 328px) !important;
        }
        .landgrid-owner-filter > div:first-child > b {
          font-size: 0 !important;
        }
        .landgrid-owner-filter > div:first-child > b::after {
          content: 'Filters & Find';
          font-size: 13px;
        }
        .pv-right { padding-top: 0 !important; }
        @media (max-width: 767px) {
          .landgrid-owner-filter { display: none !important; }
          .pv-right { padding-top: 0 !important; }
        }
      `}</style>
    </div>
  );
}
