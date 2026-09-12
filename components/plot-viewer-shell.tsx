'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useHeader } from '@/lib/header-context';

import LandGridFilters from './landgrid-filters';

const PlotViewer = dynamic(() => import('./plot-viewer'), {
  ssr: false,
  loading: () => <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#64748b' }}>Loading plan…</div>,
});

const OWNER_COLORS = ['#2563eb', '#a855f7', '#f97316', '#06b6d4', '#eab308', '#db2777', '#64748b', '#0891b2'];

function isStatusColor(value: string) {
  const v = value.trim().toLowerCase();
  if (!v) return false;
  const hex = v.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (r > 150 && r > g * 1.35 && r > b * 1.35) || (g > 130 && g > r * 1.25 && g > b * 1.15);
  }
  const rgb = v.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const [r, g, b] = rgb[1].split(',').slice(0, 3).map(Number);
    return (r > 150 && r > g * 1.35 && r > b * 1.35) || (g > 130 && g > r * 1.25 && g > b * 1.15);
  }
  return false;
}

export default function PlotViewerShell({ projectSlug, projectName, isLoggedIn = false }: { projectSlug: string; projectName: string; isLoggedIn?: boolean }) {
  const { setState } = useHeader();
  useEffect(() => { setState({ projectName, isLoggedIn }); }, [projectName, isLoggedIn, setState]);

  useEffect(() => {
    let cancelled = false;
    let lots: Array<{ number: string; status?: string; ownerId?: string | null }> = [];
    let ownerIndex = new Map<string, number>();
    fetch(`/api/projects/${encodeURIComponent(projectSlug)}/plan`, { cache: 'no-store' })
      .then(response => response.json())
      .then(data => {
        if (cancelled) return;
        const owners = Array.isArray(data?.owners) ? data.owners : [];
        ownerIndex = new Map(owners.map((owner: any, index: number) => [String(owner.id), index]));
        const rawLots = Array.isArray(data?.lots) ? data.lots : Array.isArray(data?.plots) ? data.plots : [];
        lots = rawLots.map((lot: any) => ({
          number: String(lot.number ?? lot.plot_number ?? ''),
          status: String(lot.status ?? lot.plotStatus ?? lot.plot_status ?? lot.saleStatus ?? lot.sale_status ?? '').trim().toLowerCase(),
          ownerId: lot.ownerId != null ? String(lot.ownerId) : lot.owner_id != null ? String(lot.owner_id) : null,
        }));
      })
      .catch(() => {});

    const applyStatusColors = () => {
      if (cancelled || !lots.length) return;
      const svg = document.querySelector<SVGSVGElement>('.lg-viewer-shell .pv-canvas svg');
      if (!svg) return;
      svg.querySelectorAll<SVGGElement>('g').forEach(group => {
        const texts = Array.from(group.querySelectorAll<SVGTextElement>('text'));
        const numberNode = texts.find(node => /^\d+(?:\.\d+)?$/.test((node.textContent || '').trim()));
        const number = numberNode?.textContent?.trim() || '';
        const lot = lots.find(item => item.number === number);
        if (!lot) return;
        const status = lot.status === 'sale' ? 'sold' : lot.status;
        if (numberNode) numberNode.style.setProperty('fill', status === 'sold' ? '#dc2626' : '#172033', 'important');
        group.querySelectorAll<SVGCircleElement>('circle').forEach(circle => {
          circle.style.setProperty('display', status === 'sold' ? 'none' : '');
        });
        const polygon = group.querySelector<SVGPolygonElement>('polygon');
        if (polygon) {
          const fill = polygon.style.getPropertyValue('fill') || '';
          if (isStatusColor(fill)) {
            const index = lot.ownerId ? ownerIndex.get(String(lot.ownerId)) ?? 0 : 0;
            const color = OWNER_COLORS[index % OWNER_COLORS.length];
            polygon.style.setProperty('fill', color, 'important');
            polygon.style.setProperty('filter', `drop-shadow(0 0 5px ${color})`, 'important');
          }
        }
      });
    };

    const timer = window.setInterval(applyStatusColors, 250);
    applyStatusColors();
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [projectSlug]);

  return (
    <div className="lg-viewer-shell">
      <PlotViewer projectSlug={projectSlug} />
      <LandGridFilters projectSlug={projectSlug} />
      <style jsx global>{`
        .lg-viewer-shell{position:relative;height:100%;min-height:0;overflow:hidden}
        /* Desktop: external filters occupy the left 280px; the native Plot Details panel stays on the right. */
        .lg-viewer-shell .pv{grid-template-columns:minmax(0,1fr) 320px!important;margin-left:280px!important;margin-right:0!important;width:calc(100% - 280px)!important}
        .lg-viewer-shell .pv-left{display:none!important}.lg-viewer-shell .pv-right{display:block!important;min-width:0!important;height:100%!important}
        .lg-viewer-shell .pv-canvas{position:relative;z-index:0!important;min-width:0;min-height:0;overflow:hidden}
        .lg-left-panel,.lg-right-panel{position:absolute!important;top:0!important;bottom:0!important;z-index:20!important;pointer-events:auto!important;box-sizing:border-box!important}
        .lg-left-panel{left:0!important;width:280px!important}.lg-right-panel{right:0!important;width:320px!important}
        .lg-left-panel button,.lg-left-panel input,.lg-right-panel button,.lg-right-panel input{pointer-events:auto!important;touch-action:manipulation!important}
        @media(max-width:1100px) and (min-width:768px){
          .lg-viewer-shell .pv{margin-left:250px!important;margin-right:0!important;width:calc(100% - 250px)!important;grid-template-columns:minmax(0,1fr)!important}
          .lg-left-panel{width:250px!important}.lg-right-panel{display:none!important}
        }
        @media(max-width:767px){
          .lg-viewer-shell{height:100%;min-height:0;overflow:hidden}
          .lg-viewer-shell .pv{margin:0!important;width:100%!important;height:100%!important;min-height:0!important;grid-template-columns:1fr!important}
          .lg-viewer-shell .pv-canvas{width:100%!important;height:100%!important;min-height:0!important;overflow:hidden!important}
          /* LandGridFilters is the single mobile filter entry point. */
          .lg-viewer-shell .pv-mobile-actions{display:none!important}
          .lg-viewer-shell .pv-canvas>svg{display:block!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;margin:0!important;touch-action:none!important}
          .lg-left-panel{left:8px!important;right:8px!important;top:auto!important;bottom:max(8px,env(safe-area-inset-bottom))!important;width:auto!important;height:58px!important;max-height:58px!important;overflow:hidden!important;border-radius:16px!important;z-index:30!important}
          .lg-left-panel.mobile-open{height:auto!important;max-height:min(72dvh,560px)!important;overflow:auto!important}
          .lg-right-panel{display:none!important}
          .lg-viewer-shell .pv-right{display:none!important}
        }
      `}</style>
    </div>
  );
}