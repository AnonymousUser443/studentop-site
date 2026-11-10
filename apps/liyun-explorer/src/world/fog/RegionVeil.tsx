import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { REGIONS, type Region } from '../../content/regions';
import type { MapCamera } from '../../types';
import { useSettings } from '../../app/stores/useSettings';
import { FOG_RENDER } from '../../settings/spec';
import { polygonPath } from './geometry';
import { cloudTextures, fogScale, fogSize, paintVeil } from './paint';
import styles from './region-veil.module.css';
/** Cached, feathered coverage plus two composited cloud sprites. No fog draw loop. */
export default function RegionVeil({ camera, unlockedIds, reducedMotion, paused, fixedTime }: { camera: MapCamera; unlockedIds: string[]; reducedMotion?: boolean; paused?: boolean; fixedTime?: number }) {
 const canvas=useRef<HTMLCanvasElement>(null), previous=useRef(unlockedIds);
 const layers=useSettings(state=>state.spec.inkLayers);
 const [departing,setDeparting]=useState<Region[]>([]);
 const [mask,setMask]=useState('');
 const [hidden,setHidden]=useState(document.hidden);
 const sprites=cloudTextures();
 const unlockedKey=[...unlockedIds].sort().join(',');
 useLayoutEffect(()=>{
  setMask(paintVeil(canvas.current!,REGIONS.filter(r=>unlockedIds.includes(r.id))));
 },[unlockedKey]);
 useEffect(()=>{
  const visibility=()=>setHidden(document.hidden);
  document.addEventListener('visibilitychange',visibility);
  return()=>document.removeEventListener('visibilitychange',visibility);
 },[]);
 useEffect(()=>{
  const added=REGIONS.filter(r=>unlockedIds.includes(r.id)&&!previous.current.includes(r.id));previous.current=[...unlockedIds];
  if(reducedMotion||!added.length)return;
  setDeparting(added);const timer=setTimeout(()=>setDeparting([]),650);return()=>clearTimeout(timer);
 },[unlockedKey,reducedMotion]);
 const still=reducedMotion||layers===0;
 return <div className={styles.veil} data-testid="region-veil" data-fog-state={still?'still':paused||hidden||fixedTime!==undefined?'paused':'running'} aria-hidden="true">
  <div className={styles.world} style={{width:fogSize.width,height:fogSize.height,transform:`translate3d(${camera.x-FOG_RENDER.padding*camera.scale}px,${camera.y-FOG_RENDER.padding*camera.scale}px,0) scale(${camera.scale/fogScale})`}}>
   <canvas ref={canvas} className={styles.bitmap} data-testid="region-veil-base"/>
   {mask&&layers>0&&<div className={styles.cloudMask} style={{maskImage:`url(${mask})`,WebkitMaskImage:`url(${mask})`}} data-testid="region-veil-clouds">
    <div className={`${styles.cloud} ${styles.near}`} data-fog-cloud="near" style={{backgroundImage:`url(${sprites[0]})`,animationDelay:fixedTime===undefined?undefined:`${-fixedTime/1000}s`}}/>
    <div className={`${styles.cloud} ${styles.far}`} data-fog-cloud="far" style={{backgroundImage:`url(${sprites[1]})`,animationDelay:fixedTime===undefined?undefined:`${-fixedTime/1000-7}s`}}/>
   </div>}
   <svg width={fogSize.width} height={fogSize.height} className={styles.labels}>
    <defs><filter id="veil-unlock-feather" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={FOG_RENDER.feather}/></filter></defs>
    <g transform={`scale(${fogScale}) translate(${FOG_RENDER.padding},${FOG_RENDER.padding})`}>
    {!reducedMotion&&departing.map(r=><path key={r.id} d={polygonPath(r)} className={styles.departing}/>)}
    {REGIONS.filter(r=>!unlockedIds.includes(r.id)).map(r=><g key={r.id} data-region-id={r.id}/>)}
    </g>
   </svg>
  </div>
 </div>;
}
