'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useHeader } from '@/lib/header-context';
import LandGridFilters from './landgrid-filters';

const PlotViewer = dynamic(() => import('./plot-viewer'), {
  ssr: false,
  loading: () => <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#64748b' }}>Loading plan…</div>,
});

export default function PlotViewerShell({ projectSlug, projectName, isLoggedIn = false }: { projectSlug: string; projectName: string; isLoggedIn?: boolean }) {
  const { setState } = useHeader();
  useEffect(() => { setState({ projectName, isLoggedIn }); }, [projectName, isLoggedIn, setState]);

  return (
    <div className="lg-viewer-shell">
      <PlotViewer projectSlug={projectSlug} />
      <LandGridFilters projectSlug={projectSlug} />
      <style jsx global>{`
        .lg-viewer-shell{position:relative;height:100%;min-height:0;overflow:hidden}
        .lg-viewer-shell .pv{grid-template-columns:minmax(0,1fr)!important;margin-left:280px!important;margin-right:320px!important;width:calc(100% - 600px)!important}
        .lg-viewer-shell .pv-left,.lg-viewer-shell .pv-right{display:none!important}
        .lg-viewer-shell .pv-canvas{position:relative;z-index:0!important;min-width:0;min-height:0;overflow:hidden}
        .lg-left-panel,.lg-right-panel{position:absolute!important;top:0!important;bottom:0!important;z-index:20!important;pointer-events:auto!important;box-sizing:border-box!important}
        .lg-left-panel{left:0!important;width:280px!important}.lg-right-panel{right:0!important;width:320px!important}
        .lg-left-panel button,.lg-left-panel input,.lg-right-panel button,.lg-right-panel input{pointer-events:auto!important;touch-action:manipulation!important}
        @media(max-width:1100px) and (min-width:768px){
          .lg-viewer-shell .pv{margin-left:250px!important;margin-right:0!important;width:calc(100% - 250px)!important}
          .lg-left-panel{width:250px!important}.lg-right-panel{display:none!important}
        }
        @media(max-width:767px){
          .lg-viewer-shell{height:100%;min-height:0;overflow:hidden}
          .lg-viewer-shell .pv{margin:0!important;width:100%!important;height:100%!important;min-height:0!important}
          .lg-viewer-shell .pv-canvas{width:100%!important;height:100%!important;min-height:0!important;overflow:hidden!important}
          /* Let the SVG use the full mobile canvas. The viewer's own zoom/pan state controls its scale. */
          .lg-viewer-shell .pv-canvas>svg{display:block!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;margin:0!important;touch-action:none!important}
          .lg-left-panel{left:8px!important;right:8px!important;top:auto!important;bottom:max(8px,env(safe-area-inset-bottom))!important;width:auto!important;height:58px!important;max-height:58px!important;overflow:hidden!important;border-radius:16px!important;z-index:30!important}
          .lg-left-panel.mobile-open{height:auto!important;max-height:min(72dvh,560px)!important;overflow:auto!important}
          .lg-right-panel{display:none!important}
        }
      `}</style>
    </div>
  );
}
