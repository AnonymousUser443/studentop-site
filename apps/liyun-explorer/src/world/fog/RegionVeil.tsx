import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MAP_HEIGHT, MAP_WIDTH } from '../../data';
import { REGIONS, type Region } from '../../content/regions';
import type { MapCamera } from '../../types';
import { useSettings } from '../../app/stores/useSettings';
import { polygonPath } from './geometry';
import styles from './region-veil.module.css';
/** One bounded bitmap; camera changes only move the cached surface. */
export default function RegionVeil({ camera, unlockedIds, reducedMotion }: { camera: MapCamera; unlockedIds: string[]; reducedMotion?: boolean }) {
 const canvas=useRef<HTMLCanvasElement>(null), previous=useRef(unlockedIds);
 const layers=useSettings(state=>state.spec.inkLayers);
 const [departing,setDeparting]=useState<Region[]>([]);
 const unlockedKey=[...unlockedIds].sort().join(',');
 useLayoutEffect(()=>{
  const node=canvas.current!, resolution=Math.min(1,2048/Math.max(MAP_WIDTH,MAP_HEIGHT));
  node.width=Math.ceil(MAP_WIDTH*resolution);node.height=Math.ceil(MAP_HEIGHT*resolution);
  const ctx=node.getContext('2d')!;ctx.scale(resolution,resolution);
  const path=new Path2D(REGIONS.filter(r=>!unlockedIds.includes(r.id)).map(polygonPath).join(' '));
  ctx.fillStyle='#F5E6BD';ctx.fill(path);ctx.save();ctx.clip(path);
  if(layers>0)for(let i=0;i<(layers===2?64:42);i++){
   const x=((i*.61803398875)%1)*MAP_WIDTH,y=((i*.41421356237)%1)*MAP_HEIGHT,radius=Math.min(MAP_WIDTH,MAP_HEIGHT)*(.09+(i%5)*.018);
   const gradient=ctx.createRadialGradient(x,y,0,x,y,radius);
   gradient.addColorStop(0,i%3?'rgba(255,253,236,.24)':'rgba(170,148,95,.065)');gradient.addColorStop(1,'rgba(245,230,189,0)');
   ctx.fillStyle=gradient;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
  }
  ctx.restore();
 },[unlockedKey,layers]);
 useEffect(()=>{
  const added=REGIONS.filter(r=>unlockedIds.includes(r.id)&&!previous.current.includes(r.id));previous.current=[...unlockedIds];
  if(reducedMotion||!added.length)return;
  setDeparting(added);const timer=setTimeout(()=>setDeparting([]),650);return()=>clearTimeout(timer);
 },[unlockedKey,reducedMotion]);
 return <div className={styles.veil} data-testid="region-veil" aria-hidden="true">
  <div className={styles.world} style={{width:MAP_WIDTH,height:MAP_HEIGHT,transform:`translate3d(${camera.x}px,${camera.y}px,0) scale(${camera.scale})`}}>
   <canvas ref={canvas} className={styles.bitmap} data-testid="region-veil-base"/>
   <svg width={MAP_WIDTH} height={MAP_HEIGHT} className={styles.labels}>
    {!reducedMotion&&departing.map(r=><path key={r.id} d={polygonPath(r)} className={styles.departing}/>)}
    {REGIONS.filter(r=>!unlockedIds.includes(r.id)).map(r=><g key={r.id} data-region-id={r.id}/>)}
   </svg>
  </div>
 </div>;
}
