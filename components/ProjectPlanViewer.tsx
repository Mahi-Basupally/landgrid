'use client';
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';

type Props={projectName:string;projectSlug?:string;sitePlanUrl?:string|null;droneUrl?:string|null;editable?:boolean};
type Section={id:string;name:string;sortOrder:number;masterPlanUrl?:string|null;droneUrl?:string|null};
type Lot={id:string;number:string;status:string;owner:string;price:number|string|null;area:number|string|null;direction:string;model?:string;points:string;labelX:number;labelY:number;sectionId?:string|null};
type Point={x:number;y:number};

function parsePoints(v:string):Point[]{
  return v.trim().split(/\s+/).map(p=>p.split(',').map(Number)).filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1])).map(([x,y])=>({x,y}));
}
function bounds(lots:Lot[]){
  const pts=lots.flatMap(l=>parsePoints(l.points));
  if(!pts.length)return{minX:0,minY:0,maxX:1600,maxY:1000};
  return{minX:Math.min(...pts.map(p=>p.x)),minY:Math.min(...pts.map(p=>p.y)),maxX:Math.max(...pts.map(p=>p.x)),maxY:Math.max(...pts.map(p=>p.y))};
}

export default function ProjectPlanViewer({projectName,projectSlug,sitePlanUrl,droneUrl,editable=false}:Props){
  const [view,setView]=useState<'map'|'drone'>('map');
  const [sections,setSections]=useState<Section[]>([]);
  const [lots,setLots]=useState<Lot[]>([]);
  const [sectionId,setSectionId]=useState('');
  const [loading,setLoading]=useState(Boolean(projectSlug));
  const [error,setError]=useState('');
  const [selected,setSelected]=useState<string|null>(null);
  const [status,setStatus]=useState('all');
  const [minArea,setMinArea]=useState('');
  const [maxArea,setMaxArea]=useState('');
  const [model,setModel]=useState('all');
  const [direction,setDirection]=useState('all');
  const [minPrice,setMinPrice]=useState('');
  const [maxPrice,setMaxPrice]=useState('');
  const [uploading,setUploading]=useState(false);
  const fileRef=useRef<HTMLInputElement>(null);

  async function load(){
    if(!projectSlug){setLoading(false);return;}
    setLoading(true);setError('');
    try{
      const r=await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/plan`,{cache:'no-store'});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||'Unable to load project plan');
      const loaded=(d.sections||[]) as Section[];
      setSections(loaded);
      setLots(d.lots||[]);
      const master=loaded.find(s=>s.name.trim().toLowerCase()==='master');
      setSectionId(prev=>prev&&loaded.some(s=>s.id===prev)?prev:(master?.id||loaded[0]?.id||''));
    }catch(e){setError(e instanceof Error?e.message:'Unable to load project plan');}
    finally{setLoading(false);}
  }
  useEffect(()=>{load();},[projectSlug]);

  const current=sections.find(s=>s.id===sectionId)||sections.find(s=>s.name.trim().toLowerCase()==='master')||sections[0];
  const effectiveSectionId=current?.id||'';
  const sectionLots=useMemo(()=>lots.filter(l=>(l.sectionId||effectiveSectionId)===effectiveSectionId),[lots,effectiveSectionId]);
  const statuses=useMemo(()=>Array.from(new Set(sectionLots.map(l=>l.status).filter(Boolean))),[sectionLots]);
  const models=useMemo(()=>Array.from(new Set(sectionLots.map(l=>l.model).filter(Boolean))),[sectionLots]);
  const directions=useMemo(()=>Array.from(new Set(sectionLots.map(l=>l.direction).filter(Boolean))),[sectionLots]);
  const filtered=useMemo(()=>sectionLots
    .filter(l=>status==='all'||l.status===status)
    .filter(l=>{const a=Number(l.area);return !minArea||(Number.isFinite(a)&&a>=Number(minArea));})
    .filter(l=>{const a=Number(l.area);return !maxArea||(Number.isFinite(a)&&a<=Number(maxArea));})
    .filter(l=>model==='all'||l.model===model)
    .filter(l=>direction==='all'||l.direction===direction)
    .filter(l=>{const p=Number(l.price);return !minPrice||(Number.isFinite(p)&&p>=Number(minPrice));})
    .filter(l=>{const p=Number(l.price);return !maxPrice||(Number.isFinite(p)&&p<=Number(maxPrice));}),
    [sectionLots,status,minArea,maxArea,model,direction,minPrice,maxPrice]);
  const b=useMemo(()=>bounds(filtered.length?filtered:sectionLots),[filtered,sectionLots]);
  const viewBox=`${b.minX-100} ${b.minY-100} ${Math.max(1,b.maxX-b.minX+200)} ${Math.max(1,b.maxY-b.minY+200)}`;

  const imageUrl=projectSlug&&current
    ?(view==='map'
      ?(current.masterPlanUrl?`/api/projects/${encodeURIComponent(projectSlug)}/assets/file?kind=section-master-plan&section=${current.id}`:'')
      :(current.droneUrl?`/api/projects/${encodeURIComponent(projectSlug)}/assets/file?kind=section-drone&section=${current.id}`:''))
    :(view==='map'?sitePlanUrl||'':droneUrl||'');

  async function upload(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];
    if(!file||!projectSlug||!current)return;
    setUploading(true);setError('');
    try{
      const form=new FormData();
      form.append('file',file);form.append('sectionId',current.id);form.append('kind',view==='map'?'section-master-plan':'section-drone');
      const r=await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/assets`,{method:'POST',body:form});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||'Upload failed');
      setSections(p=>p.map(s=>s.id===current.id?{...s,...(view==='map'?{masterPlanUrl:d.savedValue}:{droneUrl:d.savedValue})}:s));
      setError('');
    }catch(e){setError(e instanceof Error?e.message:'Upload failed');}
    finally{setUploading(false);e.target.value='';}
  }

  if(loading)return <div className="map-placeholder" style={{minHeight:520,display:'grid',placeItems:'center'}}>Loading project plan…</div>;

  return <div style={{display:'grid',gap:16}}>
    <div className="map-placeholder" style={{minHeight:560,position:'relative',overflow:'hidden',background:'#eef0f3',borderRadius:14}}>
      {imageUrl
        ?<img src={imageUrl} alt={`${projectName} ${current?.name||'plan'} ${view}`} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'fill'}}/>
        :<div className="map-copy" style={{height:'100%',display:'grid',placeItems:'center'}}>Add a {view==='map'?'site plan':'drone image'} for {current?.name||'Master'}.</div>}

      <div style={{position:'absolute',top:14,left:14,right:14,zIndex:5,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',padding:10,borderRadius:12,background:'rgba(255,255,255,.94)',boxShadow:'0 4px 18px rgba(0,0,0,.14)',backdropFilter:'blur(8px)'}}>
        <label style={{fontSize:12,fontWeight:800,display:'flex',alignItems:'center',gap:6}}>
          Section
          <select value={effectiveSectionId} onChange={e=>{setSectionId(e.target.value);setSelected(null);}} style={{fontWeight:700}}>
            {sections.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <span style={{fontSize:12,fontWeight:800,padding:'7px 10px',borderRadius:8,background:'#f3f4f6'}}>Site Plan</span>
        <div style={{display:'flex',gap:4}}>
          <button type="button" onClick={()=>setView('map')} style={{padding:'7px 11px',fontWeight:800,background:view==='map'?'#111827':'#fff',color:view==='map'?'#fff':'#172033',border:'1px solid #dfe3ea',borderRadius:8}}>Map</button>
          <button type="button" onClick={()=>setView('drone')} style={{padding:'7px 11px',fontWeight:800,background:view==='drone'?'#111827':'#fff',color:view==='drone'?'#fff':'#172033',border:'1px solid #dfe3ea',borderRadius:8}}>Drone</button>
        </div>
        {editable&&<>
          <button type="button" onClick={()=>fileRef.current?.click()} disabled={uploading} style={{padding:'7px 11px',fontWeight:800,border:'1px solid #dfe3ea',borderRadius:8,background:'#fff'}}><Upload size={15}/>{uploading?' Uploading…':` Upload ${view}`}</button>
          <input ref={fileRef} hidden type="file" accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp" onChange={upload}/>
        </>}
        <span style={{marginLeft:'auto',fontSize:12,fontWeight:700,color:'#667085'}}>{current?.name||'Master'}</span>
      </div>

      <svg viewBox={viewBox} preserveAspectRatio="none" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
        {filtered.map(l=>{const active=selected===l.id;return <g key={l.id} onClick={()=>setSelected(l.id)} style={{cursor:'pointer'}}>
          <polygon points={l.points} fill={active?'rgba(37,99,235,.35)':'rgba(37,99,235,.12)'} stroke={active?'#2457d6':'#fff'} strokeWidth={active?4:2}/>
          <text x={l.labelX} y={l.labelY} textAnchor="middle" dominantBaseline="middle" fontSize="24" fontWeight="800" fill="#172033" paintOrder="stroke" stroke="#fff" strokeWidth="5">{l.number}</text>
        </g>})}
      </svg>
      {error&&<div style={{position:'absolute',left:16,right:16,bottom:16,zIndex:6,padding:10,borderRadius:8,background:'#fff1f2',color:'#991b1b',fontWeight:600}}>{error}</div>}
    </div>

    <div style={{display:'flex',gap:8,flexWrap:'wrap',padding:12,border:'1px solid #e4e7ec',borderRadius:10,background:'#fff'}}>
      <select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All status</option>{statuses.map(s=><option key={s} value={s}>{s}</option>)}</select>
      <input placeholder="Min area" value={minArea} onChange={e=>setMinArea(e.target.value)}/><input placeholder="Max area" value={maxArea} onChange={e=>setMaxArea(e.target.value)}/>
      <select value={model} onChange={e=>setModel(e.target.value)}><option value="all">All models</option>{models.map(s=><option key={s} value={s}>{s}</option>)}</select>
      <select value={direction} onChange={e=>setDirection(e.target.value)}><option value="all">All directions</option>{directions.map(s=><option key={s} value={s}>{s}</option>)}</select>
      <input placeholder="Min price" value={minPrice} onChange={e=>setMinPrice(e.target.value)}/><input placeholder="Max price" value={maxPrice} onChange={e=>setMaxPrice(e.target.value)}/>
      <button type="button" onClick={()=>{setStatus('all');setMinArea('');setMaxArea('');setModel('all');setDirection('all');setMinPrice('');setMaxPrice('');}}>Clear</button>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:8}}>
      {filtered.map(l=><button key={l.id} onClick={()=>setSelected(l.id)} style={{textAlign:'left',padding:'10px 12px',border:'1px solid #e4e7ec',borderRadius:9,background:selected===l.id?'#eef2ff':'#fff'}}><b>Lot {l.number}</b><div style={{fontSize:11,color:'#667085',marginTop:3,textTransform:'capitalize'}}>{l.status}{l.area!=null?` · ${l.area} area`:''}</div></button>)}
    </div>
  </div>;
}
