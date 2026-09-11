'use client';
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useHeader } from '@/lib/header-context';
import LandGridFilters from './landgrid-filters';

const PlotViewer = dynamic(() => import('./plot-viewer'), { ssr: false, loading: () => <div style={{height:'100%',display:'grid',placeItems:'center',color:'#64748b'}}>Loading plan…</div> });

function NativeOwnerMapBridge() {
  useEffect(() => {
    let last = '';
    const apply = () => {
      const panel = document.querySelector('.lg-left-panel');
      const svg = Array.from(document.querySelectorAll<SVGSVGElement>('.pv-canvas svg')).find(s => s.querySelector('polygon'));
      if (!panel || !svg) return;
      const activeRows = Array.from(panel.querySelectorAll<HTMLButtonElement>('.lg-owner.active'));
      const owners = activeRows.map(row => ({
        name: (row.querySelector('.lg-owner-name')?.textContent || row.textContent || '').trim().toLowerCase(),
        color: getComputedStyle(row.querySelector('.lg-owner-dot') || row).backgroundColor,
      }));
      const key = owners.map(o => `${o.name}:${o.color}`).join('|');
      if (key !== last) last = key;
      const groups = Array.from(svg.querySelectorAll<SVGGElement>('g'));
      for (const group of groups) {
        const label = Array.from(group.querySelectorAll('text')).find(t => !t.hasAttribute('data-landgrid-yard'))?.textContent?.trim();
        const poly = group.querySelector<SVGPolygonElement>('polygon');
        if (!label || !poly) continue;
        const row = Array.from(panel.querySelectorAll<HTMLButtonElement>('.lg-owner.active')).find(r => (r.textContent || '').toLowerCase().includes(''));
        void row;
        const metaText = group.getAttribute('data-owner') || '';
        let match = owners.find(o => metaText && metaText.toLowerCase() === o.name);
        if (!match) {
          const ownerSpan = Array.from(panel.querySelectorAll('.lg-owner.active')).find(r => {
            const n = (r.querySelector('.lg-owner-name')?.textContent || '').trim().toLowerCase();
            return n && group.textContent?.toLowerCase().includes(n);
          });
          if (ownerSpan) match = { name: (ownerSpan.querySelector('.lg-owner-name')?.textContent || '').trim().toLowerCase(), color: getComputedStyle(ownerSpan.querySelector('.lg-owner-dot') || ownerSpan).backgroundColor };
        }
        if (match) {
          poly.style.setProperty('fill', match.color, 'important');
          poly.style.setProperty('fill-opacity', '.9', 'important');
          poly.style.setProperty('stroke', '#fff', 'important');
          poly.style.setProperty('stroke-width', '5', 'important');
        } else {
          poly.style.removeProperty('fill');
          poly.style.removeProperty('stroke');
          poly.style.removeProperty('stroke-width');
        }
      }
    };
    const click = (e: Event) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const row = target.closest<HTMLButtonElement>('.lg-owner');
      if (!row) return;
      window.setTimeout(() => {
        if (!row.classList.contains('active')) {
          row.classList.add('active');
          const check = row.querySelector('.lg-check');
          if (check) check.textContent = '✓';
        }
        apply();
      }, 50);
    };
    document.addEventListener('click', click, true);
    const observer = new MutationObserver(apply);
    const start = () => { const p = document.querySelector('.lg-left-panel'); if (p) observer.observe(p, {subtree:true, childList:true, attributes:true, attributeFilter:['class']}); apply(); };
    start();
    const timer = window.setInterval(start, 500);
    return () => { document.removeEventListener('click', click, true); observer.disconnect(); window.clearInterval(timer); };
  }, []);
  return null;
}

export default function PlotViewerShell({ projectSlug, projectName, isLoggedIn = false }: {projectSlug:string;projectName:string;isLoggedIn?:boolean}) {
  const { setState } = useHeader();
  useEffect(() => setState({projectName,isLoggedIn}), [projectName,isLoggedIn,setState]);
  return <div className="lg-viewer-shell"><PlotViewer projectSlug={projectSlug}/><LandGridFilters projectSlug={projectSlug}/><NativeOwnerMapBridge/><style jsx global>{`
    .lg-viewer-shell{position:relative;height:100%;min-height:0;overflow:hidden}
    .lg-viewer-shell .pv{grid-template-columns:minmax(0,1fr)!important;margin-left:280px!important;margin-right:320px!important;width:calc(100% - 600px)!important}
    .lg-viewer-shell .pv-left,.lg-viewer-shell .pv-right{display:none!important}
    .lg-viewer-shell .pv-canvas{position:relative;z-index:0!important;min-width:0;min-height:0}
    .lg-left-panel,.lg-right-panel{z-index:2147483647!important;pointer-events:auto!important;position:absolute!important;top:0!important;bottom:0!important}
    .lg-left-panel{left:0!important;width:280px!important}.lg-right-panel{right:0!important;width:320px!important}
    .lg-left-panel button,.lg-left-panel input,.lg-right-panel button,.lg-right-panel input{pointer-events:auto!important;touch-action:manipulation!important}
    @media(max-width:767px){.lg-viewer-shell .pv{margin:0!important;width:100%!important}.lg-left-panel{top:auto!important;bottom:58px!important;width:min(86vw,320px)!important;max-height:70vh!important}.lg-right-panel{display:none!important}}
  `}</style></div>;
}
