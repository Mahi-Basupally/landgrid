'use client';
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useHeader } from '@/lib/header-context';
import LandGridFilters from './landgrid-filters';

const PlotViewer = dynamic(() => import('./plot-viewer'), { ssr: false, loading: () => <div style={{height:'100%',display:'grid',placeItems:'center',color:'#64748b'}}>Loading plan…</div> });

type BridgeLot={number:string;ownerId:string|null};
type BridgeOwner={id:string;name:string};
function NativeOwnerMapBridge({projectSlug}:{projectSlug:string}){
  useEffect(()=>{
    let lots:BridgeLot[]=[]; let owners:BridgeOwner[]=[]; let disposed=false;
    const load=async()=>{try{const r=await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/plan`,{cache:'no-store'});const d=await r.json();if(!disposed){lots=(d.lots||[]).map((l:any)=>({number:String(l.number??''),ownerId:l.ownerId==null?null:String(l.ownerId)}));owners=(d.owners||[]).map((o:any)=>({id:String(o.id),name:String(o.name||'')}));}}catch{}};
    void load();
    const ownerName=(id:string|null)=>owners.find(o=>o.id===id)?.name.toLowerCase()||'';
    const rowColor=(row:Element)=>getComputedStyle(row.querySelector('.lg-owner-dot,.lg-dot')||row).backgroundColor;
    const apply=()=>{
      const panel=document.querySelector('.lg-left-panel');
      const svg=Array.from(document.querySelectorAll<SVGSVGElement>('.pv-canvas svg')).find(s=>s.querySelector('polygon'));
      if(!panel||!svg||!lots.length)return;
      const active=new Map<string,string>();
      panel.querySelectorAll<HTMLButtonElement>('.lg-owner.active').forEach(row=>{const name=(row.querySelector('.lg-owner-name')?.textContent||row.textContent||'').replace('✓','').trim().toLowerCase();if(name)active.set(name,rowColor(row));});
      svg.querySelectorAll<SVGGElement>('g').forEach(group=>{
        const label=Array.from(group.querySelectorAll('text')).find(t=>!t.hasAttribute('data-landgrid-yard'))?.textContent?.trim();
        const poly=group.querySelector<SVGPolygonElement>('polygon'); if(!label||!poly)return;
        const lot=lots.find(l=>l.number===label); const color=active.get(ownerName(lot?.ownerId||null));
        if(color){poly.style.setProperty('fill',color,'important');poly.style.setProperty('fill-opacity','.9','important');poly.style.setProperty('stroke','#fff','important');poly.style.setProperty('stroke-width','5','important');poly.style.setProperty('filter',`drop-shadow(0 0 6px ${color})`,'important');}
        else{poly.style.removeProperty('fill');poly.style.removeProperty('stroke');poly.style.removeProperty('stroke-width');poly.style.removeProperty('filter');}
      });
    };
    const click=(e:Event)=>{const t=e.target;if(!(t instanceof Element))return;const row=t.closest<HTMLButtonElement>('.lg-owner');if(!row)return;const before=row.classList.contains('active');window.setTimeout(()=>{if(row.classList.contains('active')===before){const now=!before;row.classList.toggle('active',now);const check=row.querySelector('.lg-check');if(check)check.textContent=now?'✓':'';}apply();},100);};
    document.addEventListener('click',click,true);
    let observer:MutationObserver|undefined;
    const attach=()=>{const panel=document.querySelector('.lg-left-panel');if(panel&&!observer){observer=new MutationObserver(()=>apply());observer.observe(panel,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});}apply();};
    const timer=window.setInterval(attach,250); attach();
    return()=>{disposed=true;document.removeEventListener('click',click,true);observer?.disconnect();window.clearInterval(timer);};
  },[projectSlug]);
  return null;
}

export default function PlotViewerShell({projectSlug,projectName,isLoggedIn=false}:{projectSlug:string;projectName:string;isLoggedIn?:boolean}){
  const {setState}=useHeader();
  useEffect(()=>setState({projectName,isLoggedIn}),[projectName,isLoggedIn,setState]);
  return <div className="lg-viewer-shell"><PlotViewer projectSlug={projectSlug}/><LandGridFilters projectSlug={projectSlug}/><NativeOwnerMapBridge projectSlug={projectSlug}/><style jsx global>{`
    .lg-viewer-shell{position:relative;height:100%;min-height:0;overflow:hidden}
    .lg-viewer-shell .pv{grid-template-columns:minmax(0,1fr)!important;margin-left:280px!important;margin-right:320px!important;width:calc(100% - 600px)!important}
    .lg-viewer-shell .pv-left,.lg-viewer-shell .pv-right{display:none!important}
    .lg-viewer-shell .pv-canvas{position:relative;z-index:0!important;min-width:0;min-height:0}
    .lg-left-panel,.lg-right-panel{position:absolute!important;top:0!important;bottom:0!important;z-index:2147483647!important;pointer-events:auto!important}
    .lg-left-panel{left:0!important;width:280px!important}.lg-right-panel{right:0!important;width:320px!important}
    .lg-left-panel button,.lg-left-panel input,.lg-right-panel button,.lg-right-panel input{pointer-events:auto!important;touch-action:manipulation!important}
    @media(max-width:767px){.lg-viewer-shell .pv{margin:0!important;width:100%!important}.lg-left-panel{top:auto!important;bottom:58px!important;width:min(86vw,320px)!important;max-height:70vh!important}.lg-right-panel{display:none!important}}
  `}</style></div>;
}
