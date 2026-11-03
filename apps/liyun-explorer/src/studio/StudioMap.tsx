import {useEffect,useRef,useState} from 'react';
import type {CSSProperties,PointerEvent as ReactPointerEvent} from 'react';
import {allVertices,clone,geometryPath,pointInGeometry,ringGeometry} from '../../shared/authoring.mjs';
import type {StudioDocument,Geometry,UV,Coverage} from '../../shared/authoring.mjs';
import {WIDTH,HEIGHT,centerGeo,distanceM,mapModel,projectedRange} from './mapModel';
export type Tool='select'|'draw'|'add'|'pan';
export type Part={polygon:number;ring:number};
type Camera={x:number;y:number;scale:number};
const COLORS=['#32685c','#a07b35','#557991','#825970','#55733d','#a1624b','#4d6a85','#7b7841'];
const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
type Props={document:StudioDocument;selected:string;part:Part;vertex:number|null;setVertex:(value:number|null)=>void;tool:Tool;preview:boolean;unlocked:Set<string>;toggleUnlock:(id:string)=>void;showAreas:boolean;showRanges:boolean;report:Coverage;drawing:UV[];setDrawing:(points:UV[])=>void;finishDrawing:()=>void;onSelect:(id:string)=>void;onGeometry:(geometry:Geometry)=>void;onCenter:(id:string,uv:UV)=>void;onRadius:(id:string,radius:number)=>void;onAdd:(uv:UV)=>void};
export default function StudioMap(props:Props){
 const surface=useRef<HTMLDivElement>(null),latest=useRef(props);latest.current=props;
 const [camera,setCamera]=useState<Camera>({x:0,y:0,scale:.1}),cameraRef=useRef(camera),[size,setSize]=useState({width:600,height:600}),initialized=useRef(false),previousSize=useRef({width:0,height:0});
 const drag=useRef<{kind:'pan'|'vertex'|'center'|'radius'|'pinch';x:number;y:number;camera:Camera;index?:number;id?:string;middle?:boolean;distance?:number;anchor?:UV}|null>(null),moved=useRef(false),pointers=useRef(new Map<number,{x:number;y:number}>());
 const setView=(next:Camera)=>{cameraRef.current=next;setCamera(next);};
 const selected=props.document.sites.find(s=>s.id===props.selected),geometry=selected?.geometry??props.document.boundary.geometry,ring=geometry[props.part.polygon]?.[props.part.ring]??[];
 const local=(event:{clientX:number;clientY:number})=>{const r=surface.current!.getBoundingClientRect();return{x:event.clientX-r.left,y:event.clientY-r.top};};
 const uv=(p:{x:number;y:number}):UV=>({u:clamp((p.x-cameraRef.current.x)/(WIDTH*cameraRef.current.scale)),v:clamp((p.y-cameraRef.current.y)/(HEIGHT*cameraRef.current.scale))});
 const fit=(shape:Geometry)=>{const points=allVertices(shape);if(!points.length||!surface.current)return;const r=surface.current.getBoundingClientRect(),xs=points.map(p=>p.u),ys=points.map(p=>p.v),left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys),scale=clamp(Math.min((r.width-64)/(Math.max(.02,right-left)*WIDTH),(r.height-64)/(Math.max(.02,bottom-top)*HEIGHT)),.025,2);setView({scale,x:r.width/2-(left+right)/2*WIDTH*scale,y:r.height/2-(top+bottom)/2*HEIGHT*scale});};
 const zoom=(factor:number,at={x:size.width/2,y:size.height/2})=>{const previous=cameraRef.current,scale=clamp(previous.scale*factor,.025,2),ratio=scale/previous.scale;setView({scale,x:at.x-(at.x-previous.x)*ratio,y:at.y-(at.y-previous.y)*ratio});};
 useEffect(()=>{const element=surface.current!;const observer=new ResizeObserver(entries=>{const next={width:entries[0].contentRect.width,height:entries[0].contentRect.height};setSize(next);if(!initialized.current){initialized.current=true;fit(latest.current.document.boundary.geometry);}else setView({...cameraRef.current,x:cameraRef.current.x+(next.width-previousSize.current.width)/2,y:cameraRef.current.y+(next.height-previousSize.current.height)/2});previousSize.current=next;});observer.observe(element);const wheel=(e:WheelEvent)=>{e.preventDefault();zoom(Math.exp(-e.deltaY*.0015),local(e));};element.addEventListener('wheel',wheel,{passive:false});return()=>{observer.disconnect();element.removeEventListener('wheel',wheel);};},[]);
 const down=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(e.pointerType==='mouse'&&![0,1].includes(e.button))return;e.preventDefault();const at=local(e);pointers.current.set(e.pointerId,at);try{surface.current?.setPointerCapture(e.pointerId);}catch{/* A pointer may be cancelled during resize. */}moved.current=false;
  if(pointers.current.size===2){const[a,b]=[...pointers.current.values()],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};drag.current={kind:'pinch',x:mid.x,y:mid.y,camera:cameraRef.current,distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),anchor:uv(mid)};moved.current=true;}
  else drag.current={kind:'pan',...at,camera:cameraRef.current,middle:e.button===1};
 };
 const handle=(e:ReactPointerEvent,kind:'vertex'|'center'|'radius',index?:number,id?:string)=>{
  if(e.button!==0||props.preview||props.tool!=='select')return;e.preventDefault();e.stopPropagation();if(kind==='center'&&id)props.onSelect(id);const at=local(e);drag.current={kind,...at,camera:cameraRef.current,index,id};props.setVertex(index??null);try{surface.current?.setPointerCapture(e.pointerId);}catch{/* Pointer already cancelled. */}moved.current=true;
 };
 const move=(e:ReactPointerEvent<HTMLDivElement>)=>{
  const d=drag.current;if(!d)return;const at=local(e),p=latest.current;
  if(d.kind==='vertex'){
   const site=p.document.sites.find(s=>s.id===p.selected),shape=clone(site?.geometry??p.document.boundary.geometry),target=shape[p.part.polygon]?.[p.part.ring];
   if(target?.[d.index!]){target[d.index!]=uv(at);p.onGeometry(shape);}return;
  }
  if(d.kind==='center'){p.onCenter(d.id!,uv(at));return;}
  if(d.kind==='radius'){const site=p.document.sites.find(s=>s.id===d.id);if(site)p.onRadius(site.id,clamp(Math.round(distanceM(centerGeo(site),mapModel.uvToGeo(uv(at).u,uv(at).v))),5,200));return;}
  if(pointers.current.has(e.pointerId))pointers.current.set(e.pointerId,at);
  if(d.kind==='pinch'){const[a,b]=[...pointers.current.values()];if(!a||!b)return;const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},scale=clamp(d.camera.scale*Math.hypot(a.x-b.x,a.y-b.y)/d.distance!,.025,2);setView({scale,x:mid.x-d.anchor!.u*WIDTH*scale,y:mid.y-d.anchor!.v*HEIGHT*scale});return;}
  const dx=at.x-d.x,dy=at.y-d.y;if(Math.hypot(dx,dy)>4)moved.current=true;if(moved.current)setView({...d.camera,x:d.camera.x+dx,y:d.camera.y+dy});
 };
 const up=(e:ReactPointerEvent<HTMLDivElement>)=>{
  const d=drag.current,p=latest.current;
  if(e.type!=='pointercancel'&&d?.kind==='pan'&&!d.middle&&!moved.current&&!p.preview){const at=uv(local(e));if(p.tool==='draw')p.setDrawing([...p.drawing,at]);if(p.tool==='add')p.onAdd(at);}
  pointers.current.delete(e.pointerId);if(pointers.current.size===1){const at=[...pointers.current.values()][0];drag.current={kind:'pan',...at,camera:cameraRef.current};moved.current=true;}else if(!pointers.current.size)drag.current=null;
 };
 const markerRadius=7/camera.scale,handleRadius=22/camera.scale;
 return <div className={`studio-canvas tool-${props.tool}`} ref={surface} tabIndex={0} role="application" aria-label="校园地图编辑画布，可用鼠标中键拖动、滚轮缩放" data-testid="studio-canvas" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onAuxClick={e=>{if(e.button===1)e.preventDefault();}} onKeyDown={e=>{
  if(e.target!==e.currentTarget)return;const c=cameraRef.current;
  if(e.key.startsWith('Arrow')){e.preventDefault();setView({...c,x:c.x+(e.key==='ArrowLeft'?40:e.key==='ArrowRight'?-40:0),y:c.y+(e.key==='ArrowUp'?40:e.key==='ArrowDown'?-40:0)});}
  if(e.key==='+'||e.key==='='){e.preventDefault();zoom(1.25);}if(e.key==='-'){e.preventDefault();zoom(.8);}if(e.key==='0')fit(props.document.boundary.geometry);
  if(e.key==='Enter'&&props.drawing.length>=3){e.preventDefault();props.finishDrawing();}if(e.key==='Escape')props.setDrawing([]);
 }}>
  <div className="studio-world" style={{width:WIDTH,height:HEIGHT,transform:`translate(${camera.x}px,${camera.y}px) scale(${camera.scale})`}}>
   <img src="/api/content/map.webp" alt="良乡校区原始无字底图" draggable={false}/>
   <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width={WIDTH} height={HEIGHT}>
    <defs><pattern id="studio-gap-hatch" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M-3 3L3-3M0 14L14 0M11 17L17 11" stroke="#a8483f" strokeWidth="3"/></pattern></defs>
    {props.document.sites.map((site,i)=><path key={site.id} data-site-area={site.id} d={geometryPath(site.geometry)} fillRule="evenodd" className={`studio-area ${site.id===props.selected?'is-selected':''}`} style={{'--area-color':COLORS[i%COLORS.length]} as CSSProperties} fill={props.preview&&!props.unlocked.has(site.id)?'#f5ecd7':props.showAreas?COLORS[i%COLORS.length]:'transparent'} fillOpacity={props.preview&&!props.unlocked.has(site.id) ? .97 : props.showAreas ? .15 : 0} stroke={props.showAreas||site.id===props.selected?COLORS[i%COLORS.length]:'none'} strokeWidth={site.id===props.selected?2.5:1.25} onClick={()=>{if(!moved.current&&props.tool==='select'&&!props.preview)props.onSelect(site.id);}}/>)}
    {props.showRanges&&props.document.sites.map(site=><path key={site.id} d={geometryPath(ringGeometry(projectedRange(site)))} className="studio-radius" fillRule="evenodd"/>) }
    <path d={geometryPath(props.document.boundary.geometry)} className="studio-boundary" fillRule="evenodd"/>
    {props.report.gap.length>0&&<path data-testid="studio-gap" d={geometryPath(props.report.gap)} fill="url(#studio-gap-hatch)" fillRule="evenodd" className="studio-diagnostic"/>}
    {props.report.overlap.length>0&&<path data-testid="studio-overlap" d={geometryPath(props.report.overlap)} fill="#b84c43" fillOpacity=".4" fillRule="evenodd" className="studio-diagnostic"/>}
    {props.document.sites.map((site,i)=><g key={site.id} className="studio-pin" onClick={()=>{if(!moved.current){if(props.preview)props.toggleUnlock(site.id);else if(props.tool==='select')props.onSelect(site.id);}}}>
     <circle cx={site.center.uv.u*WIDTH} cy={site.center.uv.v*HEIGHT} r={markerRadius*(site.id===props.selected?1.3:1)} fill={COLORS[i%COLORS.length]} stroke="#fff9e9" strokeWidth="2"/>
     <text x={site.center.uv.u*WIDTH} y={site.center.uv.v*HEIGHT-18/camera.scale} fontSize={12/camera.scale} textAnchor="middle">{site.name||'未命名景点'}{props.preview?(props.unlocked.has(site.id)?' ✓':' · 未启'):''}</text>
     <circle cx={site.center.uv.u*WIDTH} cy={site.center.uv.v*HEIGHT} r={handleRadius} fill="transparent" onPointerDown={e=>handle(e,'center',undefined,site.id)}/>
    </g>)}
    {!props.preview&&props.tool==='select'&&ring.map((p,i)=><g key={i}><circle data-vertex={i} cx={p.u*WIDTH} cy={p.v*HEIGHT} r={handleRadius} fill="transparent" onPointerDown={e=>handle(e,'vertex',i)}/><circle cx={p.u*WIDTH} cy={p.v*HEIGHT} r={(props.vertex===i?6:4)/camera.scale} fill={props.vertex===i?'#c39743':'#fff9e9'} stroke="#244f46" strokeWidth="2" pointerEvents="none"/></g>)}
    {!props.preview&&props.tool==='select'&&selected&&(()=>{const p=projectedRange(selected)[18];return<g><rect x={p.u*WIDTH-6/camera.scale} y={p.v*HEIGHT-6/camera.scale} width={12/camera.scale} height={12/camera.scale} fill="#c39743" stroke="#244f46" strokeWidth="2"/><circle data-testid="studio-radius-handle" cx={p.u*WIDTH} cy={p.v*HEIGHT} r={handleRadius} fill="transparent" onPointerDown={e=>handle(e,'radius',undefined,selected.id)}/></g>;})()}
    {props.drawing.length>0&&<><path d={props.drawing.map((p,i)=>`${i?'L':'M'}${p.u*WIDTH},${p.v*HEIGHT}`).join(' ')} className="studio-drawing"/>{props.drawing.map((p,i)=><circle key={i} cx={p.u*WIDTH} cy={p.v*HEIGHT} r={(i===0?9:5)/camera.scale} fill={i===0?'#244f46':'#c39743'} stroke="#fff9e9" strokeWidth="2" onPointerDown={e=>{if(i===0&&props.drawing.length>=3&&e.button===0){e.preventDefault();e.stopPropagation();props.finishDrawing();}}}/>)}</>}
   </svg>
  </div>
  <div className="studio-map-actions" onPointerDown={e=>e.stopPropagation()}><button aria-label="放大地图" onClick={()=>zoom(1.25)}>＋</button><button aria-label="缩小地图" onClick={()=>zoom(.8)}>－</button><button onClick={()=>fit(props.document.boundary.geometry)}>全校</button><button onClick={()=>fit(geometry)}>所选</button></div>
  <div className="studio-map-hint">{props.tool==='add'?'点击校区内放置新景点':props.tool==='draw'?`已放置 ${props.drawing.length} 点 · 点首点或按Enter闭合`:'中键 / 空白拖动平移 · 滚轮 / 双指缩放'}</div>
 </div>;
}
