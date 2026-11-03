import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { LANDMARKS, MAP_HEIGHT, MAP_WIDTH } from '../data';
import { CAMPUS_MAP_FALLBACK, CAMPUS_MAP_IMAGE, campusMap } from '../location/campus';
import modelArtifact from '../location/data/selected_model.json';
import { createRecommendedDraft, validateRegionDocument } from '../content/regions';
import type { RegionDocument } from '../content/regions';
import { pointInPolygon, polygonCentroid } from '../content/geometry.mjs';
import { CALIBRATION_STORAGE_KEY, confirmDocument, copyDocument, exportDraft, parseSelection, pointGeo, projectedRange, radiusFromUV, readDraft, selectedPolygon, selectionKey, updatePoint, updatePolygon } from './model';
import type { Selection } from './model';
import type { UV } from '../types';
import './calibration.css';

type Point = {x:number;y:number};
type Camera = Point & {scale:number};
type Tool = 'select' | 'draw' | 'pan';
type Drag = {kind:'pan';origin:Point;camera:Camera} | {kind:'pinch';distance:number;anchor:UV;camera:Camera} | {kind:'vertex';vertex:number;selection:Selection} | {kind:'point';id:string} | {kind:'radius';id:string};
const px = (uv:UV) => ({x:uv.u * MAP_WIDTH,y:uv.v * MAP_HEIGHT});
const pointsText = (polygon:readonly UV[]) => polygon.map(point => `${point.u * MAP_WIDTH},${point.v * MAP_HEIGHT}`).join(' ');
const clamp = (value:number,min=0,max=1) => Math.max(min,Math.min(max,value));
const supportLabel = {calibrated:'采样覆盖内 · 非独立精度验证',transition:'模型过渡带 · 需现场确认',extrapolated:'覆盖外推 · 尚未验证',baseline:'全局仿射参考 · 尚未验证'};
const cloneCamera = (camera:Camera) => ({...camera});

function useDraftHistory() {
  const [document,setDocument] = useState(createRecommendedDraft);
  const current = useRef(document), past = useRef<RegionDocument[]>([]), future = useRef<RegionDocument[]>([]);
  const [revision,setRevision] = useState(0);
  const replace = (next:RegionDocument) => {current.current=next;setDocument(next);setRevision(value=>value+1);};
  const checkpoint = () => {past.current=[...past.current.slice(-99),copyDocument(current.current)];future.current=[];setRevision(value=>value+1);};
  const commit = (next:RegionDocument) => {checkpoint();replace(next);};
  const undo = () => {const next=past.current.pop();if(next){future.current.push(copyDocument(current.current));replace(next);}};
  const redo = () => {const next=future.current.pop();if(next){past.current.push(copyDocument(current.current));replace(next);}};
  return {document,current,commit,replace,checkpoint,undo,redo,canUndo:past.current.length>0,canRedo:future.current.length>0,revision};
}

function NumberField({label,value,onChange,min=0,max=1,step=0.0001}:{label:string;value:number;onChange:(value:number)=>void;min?:number;max?:number;step?:number}) {
  return <label className="cal-number"><span>{label}</span><input type="number" value={Number(value.toFixed(7))} min={min} max={max} step={step} onChange={event=>{if(event.target.value==='')return;const next=Number(event.target.value);if(Number.isFinite(next))onChange(clamp(next,min,max));}}/></label>;
}

/** Lazy-loaded author surface. All edits stay in its own in-memory/local draft. */
export default function CalibrationScreen({onClose}:{onClose:()=>void}) {
  const history=useDraftHistory(), document=history.document;
  const [selection,setSelection]=useState<Selection>({kind:'boundary'}), [tool,setTool]=useState<Tool>('select');
  const [drawing,setDrawing]=useState<UV[]>([]), [selectedVertex,setSelectedVertex]=useState<number|null>(null);
  const [camera,setCameraState]=useState<Camera>({x:0,y:0,scale:0.1}), cameraRef=useRef(camera);
  const [viewport,setViewport]=useState({width:600,height:600}), [showHull,setShowHull]=useState(true);
  const [notice,setNotice]=useState('推荐初稿已载入。编辑仅影响草稿；请在现场核对后再交团队审查。');
  const [imageFailed,setImageFailed]=useState(false), [localAvailable,setLocalAvailable]=useState(false);
  const [manualLat,setManualLat]=useState(''), [manualLon,setManualLon]=useState('');
  const [restoreArmed,setRestoreArmed]=useState(false), [showHelp,setShowHelp]=useState(false);
  const surface=useRef<HTMLDivElement>(null), root=useRef<HTMLDivElement>(null), closeButton=useRef<HTMLButtonElement>(null), fileInput=useRef<HTMLInputElement>(null);
  const drag=useRef<Drag|null>(null), pointers=useRef(new Map<number,Point>()), moved=useRef(false), pointerOrigin=useRef<Point>({x:0,y:0});
  const callbacks=useRef({onClose,tool,drawing,history,selection}); callbacks.current={onClose,tool,drawing,history,selection};
  const initialized=useRef(false);
  const validation=useMemo(()=>validateRegionDocument(document),[document]);
  const polygon=selectedPolygon(document,selection);
  const selectedRegion=selection.kind==='boundary'?null:document.regions.find(region=>region.id===selection.id);
  const selectedPoint=selection.kind==='point'?document.checkInPoints.find(point=>point.id===selection.id):null;
  const selectedGeo=useMemo(()=>selectedPoint?pointGeo(selectedPoint):null,[selectedPoint]);
  const range=useMemo(()=>selectedPoint?projectedRange(selectedPoint):[],[selectedPoint]);
  const hull=modelArtifact.model.calibration_hull_uv.map(([u,v])=>({u,v}));
  const setCamera=(next:Camera)=>{cameraRef.current=next;setCameraState(next);};
  const local=(event:{clientX:number;clientY:number})=>{const rect=surface.current!.getBoundingClientRect();return{x:event.clientX-rect.left,y:event.clientY-rect.top};};
  const toUV=(point:Point):UV=>({u:clamp((point.x-cameraRef.current.x)/(MAP_WIDTH*cameraRef.current.scale)),v:clamp((point.y-cameraRef.current.y)/(MAP_HEIGHT*cameraRef.current.scale))});
  const fit=(shape:readonly UV[]=document.gameBoundary.polygon)=>{
    if(!shape.length)return;
    const us=shape.map(point=>point.u),vs=shape.map(point=>point.v),left=Math.min(...us),right=Math.max(...us),top=Math.min(...vs),bottom=Math.max(...vs);
    const bounds=surface.current?.getBoundingClientRect();const width=bounds?.width||viewport.width,height=bounds?.height||viewport.height;
    const scale=clamp(Math.min((width-64)/(Math.max(.04,right-left)*MAP_WIDTH),(height-54)/(Math.max(.04,bottom-top)*MAP_HEIGHT)),.025,1.5);
    setCamera({scale,x:width/2-(left+right)/2*MAP_WIDTH*scale,y:height/2-(top+bottom)/2*MAP_HEIGHT*scale});
  };
  const zoom=(factor:number,anchor?:Point)=>{
    const previous=cameraRef.current,at=anchor??{x:viewport.width/2,y:viewport.height/2},scale=clamp(previous.scale*factor,.025,1.5),ratio=scale/previous.scale;
    setCamera({scale,x:at.x-(at.x-previous.x)*ratio,y:at.y-(at.y-previous.y)*ratio});
  };
  const select=(next:Selection)=>{setSelection(next);setSelectedVertex(null);setDrawing([]);setTool('select');setRestoreArmed(false);root.current?.querySelector('.cal-inspector')?.scrollTo({top:0});};
  const commitPolygon=(next:UV[])=>history.commit(updatePolygon(history.current.current,selection,next));
  const updateVertex=(vertex:number,patch:Partial<UV>)=>{const shape=selectedPolygon(history.current.current,selection).map((point,index)=>index===vertex?{...point,...patch}:point);commitPolygon(shape);};
  const finishDrawing=()=>{
    if(drawing.length<3){setNotice('至少放置 3 个顶点后才能完成。');return;}
    history.commit(updatePolygon(history.current.current,selection,drawing));setDrawing([]);setTool('select');setSelectedVertex(0);setNotice('新多边形已写入草稿；请检查右侧校验结果。');
  };
  const finishRef=useRef(finishDrawing);finishRef.current=finishDrawing;

  useEffect(()=>{
    const previous=documentActiveElement();closeButton.current?.focus();
    try{setLocalAvailable(!!localStorage.getItem(CALIBRATION_STORAGE_KEY));}catch{/* Explicit save reports storage failure. */}
    const handle=(event:KeyboardEvent)=>{
      const state=callbacks.current,target=event.target as HTMLElement,editing=!!target.closest('input,textarea,select,[contenteditable="true"]');
      if(event.key==='Tab'){
        const focusable=[...(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select,textarea,summary,[tabindex="0"]')??[])].filter(element=>element.offsetParent!==null);
        const first=focusable[0],last=focusable[focusable.length-1];
        if(event.shiftKey&&(window.document.activeElement===first||!root.current?.contains(window.document.activeElement))){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&(window.document.activeElement===last||!root.current?.contains(window.document.activeElement))){event.preventDefault();first?.focus();}
      }
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();const menu=root.current?.querySelector<HTMLDetailsElement>('.cal-file-menu[open]');if(menu){menu.open=false;return;}if(state.drawing.length){setDrawing([]);setTool('select');setNotice('已取消本次绘制。');}else if(showHelp){setShowHelp(false);}else state.onClose();return;}
      if(editing)return;
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.stopPropagation();if(state.drawing.length&&!event.shiftKey)setDrawing(previous=>previous.slice(0,-1));else if(event.shiftKey)state.history.redo();else state.history.undo();return;}
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();state.history.redo();return;}
      if(!event.ctrlKey&&!event.metaKey&&!event.altKey){
        if(event.key.toLowerCase()==='v'){setTool('select');setDrawing([]);event.preventDefault();event.stopPropagation();}
        if(event.key.toLowerCase()==='p'){setTool('pan');event.preventDefault();event.stopPropagation();}
        if(event.key.toLowerCase()==='d'&&state.selection.kind!=='point'){setTool('draw');setDrawing([]);event.preventDefault();event.stopPropagation();}
        if(event.key==='Enter'&&state.tool==='draw'){event.preventDefault();finishRef.current();}
      }
    };
    window.document.addEventListener('keydown',handle,true);
    return()=>{window.document.removeEventListener('keydown',handle,true);if(previous?.isConnected)previous.focus();};
  },[showHelp]);
  useEffect(()=>{
    const element=surface.current;if(!element)return;
    const observer=new ResizeObserver(entries=>{const rect=entries[0].contentRect;setViewport({width:rect.width,height:rect.height});if(!initialized.current&&rect.width>0&&rect.height>0){initialized.current=true;fit();}});
    observer.observe(element);
    const wheel=(event:WheelEvent)=>{event.preventDefault();const rect=element.getBoundingClientRect(),at={x:event.clientX-rect.left,y:event.clientY-rect.top},previous=cameraRef.current,scale=clamp(previous.scale*Math.exp(-event.deltaY*.0015),.025,1.5),ratio=scale/previous.scale;setCamera({scale,x:at.x-(at.x-previous.x)*ratio,y:at.y-(at.y-previous.y)*ratio});};
    element.addEventListener('wheel',wheel,{passive:false});
    return()=>{observer.disconnect();element.removeEventListener('wheel',wheel);};
  },[]);
  useEffect(()=>{setManualLat(selectedGeo?.latitude.toFixed(7)??'');setManualLon(selectedGeo?.longitude.toFixed(7)??'');},[selectionKey(selection),selectedGeo?.latitude,selectedGeo?.longitude]);

  const beginHandle=(event:ReactPointerEvent,kind:'vertex'|'point'|'radius',vertex?:number)=>{
    if(event.pointerType==='mouse'&&event.button!==0)return;
    event.preventDefault();event.stopPropagation();setTool('select');history.checkpoint();moved.current=true;
    pointers.current.set(event.pointerId,local(event));
    if(kind==='vertex'){drag.current={kind,vertex:vertex!,selection};setSelectedVertex(vertex!);}
    else if(selection.kind==='point')drag.current={kind,id:selection.id};
    try{surface.current?.setPointerCapture(event.pointerId);}catch{/* A cancelled touch can release capture. */}
  };
  const down=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(event.pointerType==='mouse'&&event.button!==0)return;
    event.preventDefault();const at=local(event);pointers.current.set(event.pointerId,at);
    try{event.currentTarget.setPointerCapture(event.pointerId);}catch{/* Rotation can cancel a pointer. */}
    if(pointers.current.size>1){
      const [a,b]=[...pointers.current.values()],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
      drag.current={kind:'pinch',distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),anchor:toUV(mid),camera:cloneCamera(cameraRef.current)};moved.current=true;
    }else{pointerOrigin.current=at;moved.current=false;drag.current={kind:'pan',origin:at,camera:cloneCamera(cameraRef.current)};}
  };
  const move=(event:ReactPointerEvent<HTMLDivElement>)=>{
    const state=drag.current;if(!state)return;
    const at=local(event);
    if(state.kind==='vertex'){
      const shape=selectedPolygon(history.current.current,state.selection).map((point,index)=>index===state.vertex?toUV(at):point);
      history.replace(updatePolygon(history.current.current,state.selection,shape));return;
    }
    if(state.kind==='point'||state.kind==='radius'){
      const point=history.current.current.checkInPoints.find(item=>item.id===state.id);if(!point)return;
      history.replace(updatePoint(history.current.current,state.id,state.kind==='point'?{centerUv:toUV(at)}:{radiusM:radiusFromUV(point,toUV(at))}));return;
    }
    if(!pointers.current.has(event.pointerId))return;pointers.current.set(event.pointerId,at);
    if(state.kind==='pinch'){
      const [a,b]=[...pointers.current.values()];if(!a||!b)return;
      const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},scale=clamp(state.camera.scale*Math.hypot(a.x-b.x,a.y-b.y)/state.distance,.025,1.5);
      setCamera({scale,x:mid.x-state.anchor.u*MAP_WIDTH*scale,y:mid.y-state.anchor.v*MAP_HEIGHT*scale});return;
    }
    const dx=at.x-state.origin.x,dy=at.y-state.origin.y;
    if(Math.hypot(at.x-pointerOrigin.current.x,at.y-pointerOrigin.current.y)>4)moved.current=true;
    if(moved.current)setCamera({...state.camera,x:state.camera.x+dx,y:state.camera.y+dy});
  };
  const up=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(event.type!=='pointercancel'&&drag.current?.kind==='pan'&&!moved.current&&tool==='draw'&&selection.kind!=='point')setDrawing(previous=>previous.length<256?[...previous,toUV(local(event))]:previous);
    pointers.current.delete(event.pointerId);
    if(pointers.current.size===1){const at=[...pointers.current.values()][0];drag.current={kind:'pan',origin:at,camera:cloneCamera(cameraRef.current)};moved.current=true;}
    else if(!pointers.current.size)drag.current=null;
  };
  const handleVertexKey=(event:ReactKeyboardEvent,vertex:number)=>{
    const delta=event.shiftKey ? .001 : .0001,point=polygon[vertex];
    const patch=event.key==='ArrowLeft'?{u:clamp(point.u-delta)}:event.key==='ArrowRight'?{u:clamp(point.u+delta)}:event.key==='ArrowUp'?{v:clamp(point.v-delta)}:event.key==='ArrowDown'?{v:clamp(point.v+delta)}:null;
    if(patch){event.preventDefault();event.stopPropagation();updateVertex(vertex,patch);setSelectedVertex(vertex);}
    if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();event.stopPropagation();if(polygon.length>3){commitPolygon(polygon.filter((_,index)=>index!==vertex));setSelectedVertex(null);}}
  };
  const locateIssue=(target:string,vertex?:number)=>{
    const next=target==='boundary'?{kind:'boundary'} as const:target.startsWith('point:')?parseSelection(target):parseSelection(`region:${target}`);
    select(next);setSelectedVertex(vertex??null);
    const shape=next.kind==='point'?document.checkInPoints.find(point=>point.id===next.id)?.centerUv:null;
    fit(shape?[{u:shape.u-.06,v:shape.v-.06},{u:shape.u+.06,v:shape.v+.06}]:selectedPolygon(document,next));
  };
  const saveLocal=()=>{try{localStorage.setItem(CALIBRATION_STORAGE_KEY,JSON.stringify(exportDraft(document)));setLocalAvailable(true);setNotice('草稿已保存到当前浏览器，游戏存档和云端未改变。');}catch{setNotice('浏览器拒绝本机存储，请导出 JSON 保存草稿。');}};
  const restoreLocal=()=>{try{const raw=localStorage.getItem(CALIBRATION_STORAGE_KEY);if(!raw)throw new Error('没有找到本机草稿');history.commit(readDraft(raw));setDrawing([]);setNotice('已恢复本机草稿，请核对校验结果。');}catch(error){setNotice(`恢复失败：${error instanceof Error?error.message:'未知错误'}`);}};
  const restoreRecommended=()=>{if(!restoreArmed){setRestoreArmed(true);setNotice('再次点击“确认恢复推荐”，将替换当前草稿；仍可撤销。');return;}const next=createRecommendedDraft();history.commit(next);setDrawing([]);fit(next.gameBoundary.polygon);setRestoreArmed(false);setNotice('已恢复项目推荐初稿；可撤销，游戏和本机已存草稿未改变。');};
  const importFile=async(file:File)=>{
    try{if(file.size>1_000_000)throw new Error('草稿超过 1 MB');const next=readDraft(await file.text());history.commit(next);setDrawing([]);select({kind:'boundary'});fit(next.gameBoundary.polygon);setNotice(`已导入 ${file.name}；仅编辑此草稿，尚未应用到游戏。`);}catch(error){setNotice(`导入失败：${error instanceof Error?error.message:'未知错误'}`);}
    if(fileInput.current)fileInput.current.value='';
  };
  const download=()=>{
    if(drawing.length){setNotice('请先完成或取消正在绘制的多边形。');return;}
    if(document.review.confirmed&&!validateRegionDocument(document,{requireConfirmed:true}).valid){setNotice('确认稿存在错误，请先修正。');return;}
    const blob=new Blob([JSON.stringify(exportDraft(document),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=window.document.createElement('a');
    link.href=url;link.download=`liyun-calibration-${document.review.confirmed?'confirmed':'review'}-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    setNotice(document.review.confirmed?'确认稿已导出。团队仍需通过 import-calibration.mjs dry-run 审查并显式 --apply。':'审查草稿已导出，未确认的数据不会被导入脚本应用。');
  };
  const manualPlace=()=>{
    if(!selectedPoint)return;
    const latitude=Number(manualLat),longitude=Number(manualLon);
    if(!manualLat.trim()||!manualLon.trim()||!Number.isFinite(latitude)||Math.abs(latitude)>85||!Number.isFinite(longitude)||Math.abs(longitude)>180){setNotice('请填写合法 WGS84 纬度和经度，纬度在前；不要输入 GCJ-02 / 火星坐标。');return;}
    const mapped=campusMap.gpsToMap(latitude,longitude);
    if(!mapped.inside_image){setNotice('该 WGS84 不在地图画布内，未移动点位。');return;}
    history.commit(updatePoint(document,selectedPoint.id,{centerUv:{u:mapped.u,v:mapped.v},wgs84:{latitude,longitude,source:'manual-field'}}));setNotice('手填 WGS84 已保留为现场候选。移动 UV 中心时会清除这组手填坐标，避免误用旧值。');
  };
  const title=selection.kind==='boundary'?document.gameBoundary.name:selectedPoint?`${selectedPoint.name} · 打卡候选`:selectedRegion?.name??'分区';
  const selectedAnchor=selection.kind!=='boundary'?LANDMARKS.find(place=>place.id===selection.id):null;
  const validCoverage=selectedAnchor?pointInPolygon(selectedAnchor.uv,polygon):null;
  const coveredAnchors=LANDMARKS.filter(place=>pointInPolygon(place.uv,polygon));
  const screenScale=camera.scale,style={'--cal-scale':screenScale} as CSSProperties;

  return <div className="cal-screen" role="dialog" aria-modal="true" aria-labelledby="cal-title" ref={root} style={style} data-testid="calibration-screen">
    <header className="cal-header"><div><span className="cal-eyebrow">理韵寻踪 / CONTENT ATELIER</span><h1 id="cal-title">校园标定工坊 <small>团队审查工具</small></h1></div><div className="cal-header-actions"><span className={`cal-status ${document.review.confirmed?'is-confirmed':''}`}>{document.review.confirmed?'现场确认稿':'待现场确认'}</span><button type="button" onClick={()=>setShowHelp(value=>!value)} aria-expanded={showHelp}>操作说明</button><button type="button" ref={closeButton} onClick={onClose} aria-label="关闭标定工坊">返回地图 ↗</button></div></header>
    <div className="cal-toolbar" aria-label="标定工具栏">
      <div className="cal-tools">{([['select','选择 / 改点','V'],['draw','重新绘制','D'],['pan','拖动地图','P']] as const).map(([value,label,key])=><button key={value} type="button" aria-pressed={tool===value} disabled={value==='draw'&&selection.kind==='point'} onClick={()=>{setTool(value);if(value!=='draw')setDrawing([]);setNotice(value==='draw'?'依次点击放置新顶点；拖动空白或双指可移动地图，完成后替换当前多边形。':value==='pan'?'拖动地图或双指缩放；选择模式可拖动顶点。':'选择分区或拖动顶点。右侧数值框也可精确调整。');}}>{label}<kbd>{key}</kbd></button>)}</div>
      <div className="cal-history"><button type="button" onClick={history.undo} disabled={!history.canUndo} title="Ctrl+Z">↶ 撤销</button><button type="button" onClick={history.redo} disabled={!history.canRedo} title="Ctrl+Y">↷ 重做</button></div>
      <div className="cal-file-tools"><button type="button" onClick={()=>fileInput.current?.click()}>导入 JSON</button><button type="button" onClick={saveLocal}>存本机</button><button type="button" className="cal-primary" onClick={download}>导出审查稿 ↓</button><details className="cal-file-menu"><summary aria-label="更多草稿操作">⋯</summary><div><button type="button" onClick={restoreLocal} disabled={!localAvailable}>恢复本机草稿</button><button type="button" className={restoreArmed?'cal-danger':''} onClick={restoreRecommended}>{restoreArmed?'确认恢复推荐':'恢复推荐初稿'}</button></div></details><input type="file" accept=".json,application/json" ref={fileInput} hidden onChange={event=>{const file=event.target.files?.[0];if(file)void importFile(file);}}/></div>
    </div>
    {showHelp&&<aside className="cal-help"><strong>让推荐变成可核对的内容。</strong> 选择外边界或分区，拖动顶点；重新绘制会在“完成”后替换原图形。选择打卡点后拖动中心或金色半径手柄。滚轮 / 双指缩放，拖空白平移；顶点聚焦后方向键微调，Shift 加速，Delete 删除。Ctrl+Z / Y 撤销重做，Esc 取消绘制或返回。工具不读取实时 GPS，不上传位置，也不直接修改游戏。<button type="button" onClick={()=>setShowHelp(false)}>收起说明</button></aside>}
    <main className="cal-workspace">
      <aside className="cal-sidebar" aria-label="编辑对象"><p className="cal-section-title">一张地图，八段旅程</p><button type="button" className={`cal-boundary-choice ${selection.kind==='boundary'?'is-active':''}`} onClick={()=>select({kind:'boundary'})}><span>◈ 游戏外边界</span><small>内容覆盖范围 / 非校园行政边界</small></button><div className="cal-region-list">{document.regions.map(region=><div className={`cal-region-choice ${selection.kind!=='boundary'&&selection.id===region.id?'is-active':''}`} key={region.id}><button type="button" onClick={()=>select({kind:'region',id:region.id})}><span className="cal-region-dot" style={{background:region.art.palette[0]}}/><span>{region.name}<small>{region.id}</small></span></button><button type="button" className="cal-point-choice" aria-label={`编辑${region.name}打卡候选`} aria-pressed={selection.kind==='point'&&selection.id===region.id} onClick={()=>select({kind:'point',id:region.id})}>◎</button></div>)}</div><div className="cal-sidebar-note"><strong>推荐初稿</strong><p>定位凸包只覆盖北湖、综合楼等局部采样。它不能作为校界；外推坐标必须现场核对。</p><button type="button" onClick={restoreLocal} disabled={!localAvailable}>恢复本机草稿</button><button type="button" className={restoreArmed?'cal-danger':''} onClick={()=>{if(!restoreArmed){setRestoreArmed(true);setNotice('再次点击“确认恢复推荐”，将替换当前草稿；仍可撤销。');return;}const next=createRecommendedDraft();history.commit(next);setDrawing([]);fit(next.gameBoundary.polygon);setRestoreArmed(false);setNotice('已恢复项目推荐初稿；可撤销，游戏和本机已存草稿未改变。');}}>{restoreArmed?'确认恢复推荐':'恢复推荐初稿'}</button></div></aside>
      <section className="cal-map-column" aria-label="地图编辑画布">
        <div className="cal-mobile-selector"><label htmlFor="cal-object">编辑对象</label><select id="cal-object" value={selectionKey(selection)} onChange={event=>select(parseSelection(event.target.value))}><option value="boundary">◈ 游戏外边界</option>{document.regions.map(region=><optgroup key={region.id} label={region.name}><option value={`region:${region.id}`}>{region.name} · 分区</option><option value={`point:${region.id}`}>{region.name} · 打卡候选</option></optgroup>)}</select></div>
        <div className={`cal-map-surface is-${tool}`} ref={surface} tabIndex={0} role="application" aria-label="地图编辑画布。方向键平移，正负号缩放；可用右侧数值框替代拖动。" data-testid="calibration-canvas" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={event=>{
          if(event.target!==event.currentTarget)return;
          const delta=event.shiftKey?80:32;
          if(event.key.startsWith('Arrow')){event.preventDefault();setCamera({...cameraRef.current,x:cameraRef.current.x+(event.key==='ArrowLeft'?delta:event.key==='ArrowRight'?-delta:0),y:cameraRef.current.y+(event.key==='ArrowUp'?delta:event.key==='ArrowDown'?-delta:0)});}
          if(event.key==='+'||event.key==='='){event.preventDefault();zoom(1.25);}if(event.key==='-'){event.preventDefault();zoom(.8);}if(event.key==='0'){event.preventDefault();fit();}
        }}>
          <div className="cal-map-world" style={{width:MAP_WIDTH,height:MAP_HEIGHT,transform:`translate(${camera.x}px,${camera.y}px) scale(${camera.scale})`}}>
            <img className="cal-base-map" src={imageFailed?CAMPUS_MAP_FALLBACK:CAMPUS_MAP_IMAGE} alt="良乡校区无字底图" draggable={false} onError={()=>setImageFailed(true)}/>
            <svg className="cal-map-vectors" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} width={MAP_WIDTH} height={MAP_HEIGHT}>
              {document.regions.map(region=><polygon key={region.id} points={pointsText(region.polygon)} className={`cal-region-shape ${selection.kind!=='boundary'&&selection.id===region.id?'is-selected':''}`} style={{'--cal-region-color':region.art.palette[0]} as CSSProperties} onClick={()=>{if(tool==='select'&&!moved.current)select({kind:'region',id:region.id});}}/>) }
              <polygon points={pointsText(document.gameBoundary.polygon)} className={`cal-boundary-shape ${selection.kind==='boundary'?'is-selected':''}`} onClick={()=>{if(tool==='select'&&!moved.current)select({kind:'boundary'});}}/>
              {showHull&&<polygon points={pointsText(hull)} className="cal-hull-shape"><title>定位采样覆盖凸包，非游戏外边界 / 非校界</title></polygon>}
              {document.regions.map(region=>{const at=px(polygonCentroid(region.polygon));return <text key={region.id} x={at.x} y={at.y} className="cal-region-label" fontSize={12/screenScale} textAnchor="middle">{region.name}</text>;})}
              {LANDMARKS.map(place=>{const at=px(place.uv);return <g key={place.id} className="cal-reference-marker"><path d={`M${at.x-5/screenScale},${at.y}h${10/screenScale}M${at.x},${at.y-5/screenScale}v${10/screenScale}`} /><title>{place.name}：游戏原锚点（不随草稿移动）</title></g>;})}
              {document.checkInPoints.map(point=>{const at=px(point.centerUv),active=selection.kind==='point'&&selection.id===point.id;return <circle key={point.id} cx={at.x} cy={at.y} r={(active?7:4)/screenScale} className={`cal-checkin-marker ${active?'is-selected':''}`} onClick={()=>{if(tool!=='draw'&&!moved.current)select({kind:'point',id:point.id});}}><title>{point.name}：草稿打卡候选中心</title></circle>;})}
              {selectedPoint&&range.length>0&&<><polygon points={pointsText(range)} className="cal-range-shape"/><circle cx={px(selectedPoint.centerUv).x} cy={px(selectedPoint.centerUv).y} r={22/screenScale} className="cal-handle-hit" onPointerDown={event=>beginHandle(event,'point')}><title>拖动打卡中心；右侧 UV 输入可替代</title></circle><rect x={px(range[18]).x-6/screenScale} y={px(range[18]).y-6/screenScale} width={12/screenScale} height={12/screenScale} className="cal-radius-handle"/><circle cx={px(range[18]).x} cy={px(range[18]).y} r={22/screenScale} className="cal-handle-hit" onPointerDown={event=>beginHandle(event,'radius')}><title>拖动参考半径；右侧米数输入可替代</title></circle></>}
              {selection.kind!=='point'&&tool==='select'&&polygon.map((point,index)=>{const at=px(point);return <g key={index}><circle cx={at.x} cy={at.y} r={22/screenScale} className="cal-handle-hit" onPointerDown={event=>beginHandle(event,'vertex',index)}/><circle cx={at.x} cy={at.y} r={(selectedVertex===index?7:5)/screenScale} className={`cal-vertex ${selectedVertex===index?'is-selected':''}`} role="button" tabIndex={0} aria-label={`顶点 ${index+1}，U ${point.u.toFixed(4)}，V ${point.v.toFixed(4)}。方向键微调`} onFocus={()=>setSelectedVertex(index)} onPointerDown={event=>beginHandle(event,'vertex',index)} onKeyDown={event=>handleVertexKey(event,index)}/><text x={at.x+10/screenScale} y={at.y-9/screenScale} fontSize={10/screenScale} className="cal-vertex-label">{index+1}</text></g>;})}
              {drawing.length>0&&<><polyline points={pointsText(drawing)} className="cal-drawing-shape"/>{drawing.map((point,index)=><circle key={index} cx={px(point).x} cy={px(point).y} r={5/screenScale} className="cal-vertex is-selected"/>)}</>}
            </svg>
          </div>
          <div className="cal-map-badge"><span className="cal-map-north">↑</span><span>IMAGE UV<br/><b>WGS84 参考</b></span></div>
          <div className="cal-map-controls" onPointerDown={event=>event.stopPropagation()}><button type="button" aria-label="放大地图" onClick={()=>zoom(1.25)}>＋</button><button type="button" aria-label="缩小地图" onClick={()=>zoom(.8)}>−</button><button type="button" onClick={()=>fit()}>全图</button><button type="button" onClick={()=>fit(selectedPoint?range:polygon)}>居中所选</button></div>
          {tool==='draw'&&<div className="cal-draw-bar" onPointerDown={event=>event.stopPropagation()}><span>新轮廓 · {drawing.length} 点</span><button type="button" disabled={!drawing.length} onClick={()=>setDrawing(previous=>previous.slice(0,-1))}>退一点</button><button type="button" disabled={drawing.length<3} onClick={finishDrawing}>完成轮廓 ↵</button><button type="button" onClick={()=>{setDrawing([]);setTool('select');}}>取消</button></div>}
        </div>
        <div className="cal-map-legend"><span><i className="is-boundary"/>游戏外边界</span><span><i className="is-anchor"/>原地标锚点</span><span><i className="is-point"/>候选打卡中心</span><label><input type="checkbox" checked={showHull} onChange={event=>setShowHull(event.target.checked)}/>定位采样覆盖</label></div>
      </section>
      <aside className="cal-inspector" aria-label="对象属性与校验"><div className="cal-inspector-heading"><span className="cal-eyebrow">{selection.kind==='point'?'CHECK-IN CANDIDATE':selection.kind==='boundary'?'GAME ENVELOPE':'REGION GEOMETRY'}</span><h2>{title}</h2><p>{selection.kind==='point'?'拖动中心和金色手柄，或输入位置与半径。实际打卡使用此中心和米制半径。':'在底图上描出边界，拖动顶点精修。分区边界控制地图解锁后显露的范围。'}</p></div>
        {selectedRegion&&<div className="cal-edit-pair" role="group" aria-label={`${selectedRegion.name}的边界与打卡点`}><button type="button" aria-pressed={selection.kind==='region'} onClick={()=>select({kind:'region',id:selectedRegion.id})}>分区边界</button><button type="button" aria-pressed={selection.kind==='point'} onClick={()=>select({kind:'point',id:selectedRegion.id})}>打卡中心与范围</button></div>}
        {selectedPoint?<section className="cal-properties"><div className="cal-field-grid"><NumberField label="中心 U" value={selectedPoint.centerUv.u} onChange={u=>history.commit(updatePoint(document,selectedPoint.id,{centerUv:{...selectedPoint.centerUv,u}}))}/><NumberField label="中心 V" value={selectedPoint.centerUv.v} onChange={v=>history.commit(updatePoint(document,selectedPoint.id,{centerUv:{...selectedPoint.centerUv,v}}))}/></div><NumberField label="打卡半径 / 米" value={selectedPoint.radiusM} min={5} max={200} step={1} onChange={radiusM=>history.commit(updatePoint(document,selectedPoint.id,{radiusM}))}/><input className="cal-range-input" type="range" aria-label="打卡半径" min={5} max={200} step={1} value={selectedPoint.radiusM} onChange={event=>history.commit(updatePoint(document,selectedPoint.id,{radiusM:Number(event.target.value)}))}/><div className="cal-coordinate-card"><strong>{selectedPoint.wgs84?'手填现场 WGS84':'SDK 候选 WGS84'}</strong><code>{selectedGeo?.latitude.toFixed(7)} N<br/>{selectedGeo?.longitude.toFixed(7)} E</code><span>{selectedGeo?supportLabel[selectedGeo.support.mode]:''}</span></div><p className="cal-warning">{selectedPoint.physical?'实体点位参考；请确认室外安全可达的打卡中心。':'现有虚拟信标；不能宣称为已实测实体塔。'} 投影圈经 WGS84 采样后映射，可能变形，不是精确米圈。</p><details className="cal-manual-geo"><summary>填写现场 WGS84 坐标</summary><p>只接受纬度在前的 WGS84；不自动读取设备 GPS。</p><label>纬度<input type="number" step="0.0000001" value={manualLat} onChange={event=>setManualLat(event.target.value)}/></label><label>经度<input type="number" step="0.0000001" value={manualLon} onChange={event=>setManualLon(event.target.value)}/></label><button type="button" onClick={manualPlace}>按 WGS84 放置候选</button></details></section>:<section className="cal-properties"><div className="cal-coverage-status">{selectedAnchor?<><span className={validCoverage?'cal-good':'cal-error'}>{validCoverage?'✓ 原地标已覆盖':'! 原地标未覆盖'}</span><small>锚点 U {selectedAnchor.uv.u.toFixed(5)} / V {selectedAnchor.uv.v.toFixed(5)}</small></>:<span>覆盖全部地标的游戏内容范围</span>}</div><div className="cal-vertex-heading"><strong>{polygon.length} 个顶点</strong><span>点行可定位</span></div><ol className="cal-vertex-list">{polygon.map((point,index)=><li key={index} className={selectedVertex===index?'is-selected':''}><button type="button" className="cal-vertex-index" aria-label={`定位顶点 ${index+1}`} onClick={()=>{setSelectedVertex(index);const at=px(point);setCamera({...cameraRef.current,x:viewport.width/2-at.x*cameraRef.current.scale,y:viewport.height/2-at.y*cameraRef.current.scale});}}>{String(index+1).padStart(2,'0')}</button><NumberField label="U" value={point.u} onChange={u=>updateVertex(index,{u})}/><NumberField label="V" value={point.v} onChange={v=>updateVertex(index,{v})}/><button type="button" className="cal-delete-vertex" disabled={polygon.length<=3} aria-label={`删除顶点 ${index+1}`} onClick={()=>{commitPolygon(polygon.filter((_,current)=>current!==index));setSelectedVertex(null);}}>×</button></li>)}</ol><button type="button" className="cal-wide-button" onClick={()=>{if(polygon.length>=256)return;const index=selectedVertex??polygon.length-1,a=polygon[index],b=polygon[(index+1)%polygon.length];const next=[...polygon];next.splice(index+1,0,{u:(a.u+b.u)/2,v:(a.v+b.v)/2});commitPolygon(next);setSelectedVertex(index+1);}}>在所选顶点后插入中点 ＋</button>{selection.kind==='region'&&<button type="button" className="cal-wide-button" onClick={()=>select({kind:'point',id:selection.id})}>编辑这一站的打卡候选 ◎</button>}</section>}
        <section className="cal-covered-anchors" aria-label="轮廓内的原地标"><p className="cal-section-title">{selection.kind==='point'?'关联分区覆盖的地标':'当前轮廓内的地标'} <span>{coveredAnchors.length} / {LANDMARKS.length}</span></p>{coveredAnchors.length?<ul>{coveredAnchors.map(place=><li key={place.id} className={place.id===selectedAnchor?.id?'is-linked':''}>{place.id===selectedAnchor?.id?'◆ ':''}{place.name}</li>)}</ul>:<p>当前轮廓未覆盖原地标，请调整边界。</p>}<small>按游戏原地标锚点实时检查；拖动打卡中心不会移动这些参考点。</small></section>
        <section className="cal-validation"><div className="cal-section-title">几何与内容校验 <span className={validation.valid?'cal-good':'cal-error'}>{validation.valid?'通过':`${validation.errors.length} 项待修`}</span></div>{validation.errors.length>0?<ul>{validation.errors.map((error,index)=><li key={index}><button type="button" onClick={()=>locateIssue(error.target,error.vertex)}><strong>{error.target}</strong>{error.message}<span>定位问题 ↗</span></button></li>)}</ul>:<p>8 个分区与候选点 ID 合法；轮廓无自交，分区及原地标均被正确覆盖。</p>}<p className="cal-warning">校验通过只代表数据结构和几何成立，不代表校园边界、位置或打卡范围已经实测。</p></section>
        <section className="cal-review"><p className="cal-section-title">团队现场确认</p><label>核对人<input type="text" maxLength={100} value={document.review.reviewer} placeholder="填写核对人 / 团队" onChange={event=>history.commit({...document,review:{...document.review,reviewer:event.target.value,confirmed:false,reviewedAt:null},status:'draft'})}/></label><label>审查备注<textarea value={document.review.notes} maxLength={2000} rows={3} onChange={event=>history.commit({...document,review:{...document.review,notes:event.target.value}})}/></label><label className="cal-confirm"><input type="checkbox" disabled={!validation.valid||!document.review.reviewer.trim()} checked={document.review.confirmed} onChange={event=>history.commit(confirmDocument(document,event.target.checked))}/><span>我已现场核对外边界、全部分区、打卡中心与范围（含可达性）；允许导出团队确认稿。</span></label><small>再次改动几何或点位会撤销确认。导出仍需团队审查并显式应用。</small></section>
      </aside>
    </main>
    <footer className="cal-footer"><p role="status" aria-live="polite">{notice}</p><span>{Math.round(camera.scale*1000)/10}% · {document.map_id}</span></footer>
  </div>;
}

function documentActiveElement() {return window.document.activeElement instanceof HTMLElement?window.document.activeElement:null;}
