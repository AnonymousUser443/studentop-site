import clipping from 'polygon-clipping';
import { isUV, pointInPolygon, signedArea, validatePolygon } from '../src/content/geometry.mjs';

export const STUDIO_MAP_ID='campus-v04-eaa124716c51375f';
export const SITE_FIELDS=Object.freeze(['name','subtitle','intro','verse','icon','physical','center','radiusM','geometry','photos']);
export const MAP_ASPECT=4958/4000;
export const clone=value=>JSON.parse(JSON.stringify(value));
const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
export const validId=value=>typeof value==='string'&&/^[a-z][a-z0-9_-]{0,47}$/.test(value);
const text=(value,max)=>typeof value==='string'&&value.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
export const ringGeometry=ring=>[[clone(ring)]];
export const primaryRing=geometry=>geometry?.[0]?.[0]??[];
export const allVertices=geometry=>geometry.flat(2);
export function geometryPath(geometry,width=4000,height=4958){return geometry.flatMap(polygon=>polygon.map(ring=>ring.map((p,i)=>`${i?'L':'M'}${p.u*width},${p.v*height}`).join(' ')+'Z')).join(' ');}
export function pointInGeometry(point,geometry){return geometry.some(polygon=>pointInPolygon(point,polygon[0])&&!polygon.slice(1).some(hole=>pointInPolygon(point,hole)));}
export function geometryArea(geometry){return geometry.reduce((total,polygon)=>total+Math.abs(signedArea(polygon[0]))-polygon.slice(1).reduce((n,hole)=>n+Math.abs(signedArea(hole)),0),0);}
const toClip=geometry=>geometry.map(polygon=>polygon.map(ring=>ring.map(p=>[p.u,p.v])));
const fromClip=geometry=>geometry.map(polygon=>polygon.map(ring=>{
 const open=ring.length>1&&ring[0][0]===ring.at(-1)[0]&&ring[0][1]===ring.at(-1)[1]?ring.slice(0,-1):ring;
 return open.map(([u,v])=>({u:Math.min(1,Math.max(0,u)),v:Math.min(1,Math.max(0,v))}));
})).filter(polygon=>polygon[0].length>=3&&Math.abs(signedArea(polygon[0]))>1e-12);
const union=geometries=>{const nonempty=geometries.filter(g=>g.length);return nonempty.length?fromClip(clipping.union(...nonempty.map(toClip))):[];};
const difference=(a,...b)=>a.length?fromClip(clipping.difference(toClip(a),...b.filter(g=>g.length).map(toClip))):[];
const intersection=(a,b)=>a.length&&b.length?fromClip(clipping.intersection(toClip(a),toClip(b))):[];

/** Bounded structural checks also permit incomplete/self-crossing drafts to be repaired. */
export function documentProblems(doc,{geometry=false,publish=false}={}){
 const errors=[];const add=(target,message)=>errors.push({target,message});
 if(!record(doc)||doc.schema!==2||doc.mapId!==STUDIO_MAP_ID)return[{target:'document',message:'地图版本或文档结构不匹配'}];
 if(!record(doc.boundary)||!text(doc.boundary.name,100)||!Array.isArray(doc.sites)||doc.sites.length<1||doc.sites.length>64)return[{target:'document',message:'需要校区范围与1–64个景点'}];
 let vertexCount=0;
 const shape=(value,target)=>{
  if(!Array.isArray(value)||value.length<1||value.length>32){add(target,'区域需要1–32块多边形');return;}
  for(const polygon of value){if(!Array.isArray(polygon)||polygon.length<1||polygon.length>16){add(target,'多边形结构无效');continue;}
   for(const ring of polygon){if(!Array.isArray(ring)||ring.length<3||ring.length>256||!ring.every(isUV)){add(target,'每个轮廓需要3–256个有效UV顶点');continue;}
    vertexCount+=ring.length;
    if(geometry)for(const issue of validatePolygon(ring))if(issue.code!=='zero-area'||Math.abs(signedArea(ring))<=1e-12)add(target,issue.message);
   }
  }
 };
 shape(doc.boundary.geometry,'boundary');
 if(!text(doc.notes??'',2000))add('document','备注过长');
 const ids=new Set();
 for(const site of doc.sites){
  if(!record(site)||!validId(site.id)){add('document','景点ID无效');continue;}
  const target=site.id;if(ids.has(site.id))add(target,'景点ID重复');ids.add(site.id);
  if(!text(site.name,100)||!text(site.subtitle,200)||!text(site.intro,6000)||!text(site.verse,300)||!['gate','book','lake','sport','star','leaf','flower','tower'].includes(site.icon)||typeof site.physical!=='boolean')add(target,'名称、介绍或图标格式不正确');
  if(publish&&!site.name.trim())add(target,'发布前请填写景点名称');
  if(site.id==='tower'&&site.physical!==false)add(target,'真理之塔保留为虚拟信标');
  if(publish&&!site.intro.trim())add(target,'发布前请填写景点介绍');
  if(!record(site.center)||!isUV(site.center.uv))add(target,'打卡中心需要有效UV');
  else if(site.center.wgs84!==undefined){const g=site.center.wgs84;if(!record(g)||!Number.isFinite(g.latitude)||Math.abs(g.latitude)>85||!Number.isFinite(g.longitude)||Math.abs(g.longitude)>180||g.source!=='manual-field')add(target,'现场坐标须使用合法WGS84');}
  if(!Number.isFinite(site.radiusM)||site.radiusM<5||site.radiusM>200)add(target,'打卡半径须为5–200米');
  if(!Array.isArray(site.photos)||site.photos.length>6||site.photos.some(photo=>!record(photo)||!(/^[a-f0-9]{64}$/.test(photo.id)||/^seed-(wencui|beihu|library|teaching|wenbo|sports|tower|park)$/.test(photo.id))||!text(photo.alt,300)))add(target,'每站最多6张已上传照片，每张需有效说明');
  shape(site.geometry,target);
 }
 if(vertexCount>4096)add('document','整个地图最多4096个顶点，请简化轮廓');
 if(geometry&&!errors.length){
  for(const site of doc.sites){if(!pointInGeometry(site.center.uv,doc.boundary.geometry))add(site.id,'打卡中心在校区范围之外');if(!pointInGeometry(site.center.uv,site.geometry))add(site.id,'打卡中心未被所属分区覆盖');}
 }
 return errors;
}
export function assertDocument(doc,options){const errors=documentProblems(doc,options);if(errors.length)throw Object.assign(Error(errors[0].message),{status:400,issues:errors});return doc;}
export function canonicalDocument(doc){
 assertDocument(doc);const shape=g=>g.map(p=>p.map(r=>r.map(({u,v})=>({u,v}))));
 return{schema:2,mapId:STUDIO_MAP_ID,boundary:{name:doc.boundary.name,geometry:shape(doc.boundary.geometry)},notes:doc.notes??'',sites:doc.sites.map(s=>({id:s.id,name:s.name,subtitle:s.subtitle,intro:s.intro,verse:s.verse,icon:s.icon,physical:s.physical,center:{uv:{u:s.center.uv.u,v:s.center.uv.v},...(s.center.wgs84?{wgs84:{latitude:s.center.wgs84.latitude,longitude:s.center.wgs84.longitude,source:'manual-field'}}:{})},radiusM:s.radiusM,geometry:shape(s.geometry),photos:s.photos.map(({id,alt})=>({id,alt}))}))};
}

export function coverageReport(doc){
 const errors=documentProblems(doc,{geometry:true});
 if(errors.some(e=>!['打卡中心在校区范围之外','打卡中心未被所属分区覆盖'].includes(e.message)))return{valid:false,errors,coverage:0,gap:[],overlap:[],outside:[],gapArea:0,overlapArea:0,outsideArea:0};
 try{
  const boundary=doc.boundary.geometry,regions=doc.sites.map(s=>s.geometry),whole=union(regions);
  const gap=difference(boundary,whole),outside=difference(whole,boundary),pairs=[];
  for(let i=0;i<regions.length;i++)for(let j=i+1;j<regions.length;j++){const common=intersection(regions[i],regions[j]);if(geometryArea(common)>1e-12)pairs.push(common);}
  const overlap=union(pairs),area=geometryArea(boundary),gapArea=geometryArea(gap),overlapArea=geometryArea(overlap),outsideArea=geometryArea(outside),tolerance=Math.max(1e-11,area*1e-8);
  return{valid:!errors.length&&gapArea<=tolerance&&overlapArea<=tolerance&&outsideArea<=tolerance,errors,coverage:area?Math.max(0,1-gapArea/area):0,gap,overlap,outside,gapArea,overlapArea,outsideArea};
 }catch{return{valid:false,errors:[{target:'document',message:'几何运算失败，请检查交叉或过密顶点'}],coverage:0,gap:[],overlap:[],outside:[],gapArea:0,overlapArea:0,outsideArea:0};}
}

function halfPlane(ring,a,b,c){
 const output=[];for(let i=0;i<ring.length;i++){
  const p=ring[i],q=ring[(i+1)%ring.length],dp=a*p.u+b*p.v-c,dq=a*q.u+b*q.v-c,insideP=dp<=1e-12,insideQ=dq<=1e-12;
  if(insideP)output.push(p);if(insideP!==insideQ){const t=dp/(dp-dq);output.push({u:p.u+(q.u-p.u)*t,v:p.v+(q.v-p.v)*t});}
 }return output.filter((p,i)=>i===0||Math.hypot(p.u-output[i-1].u,p.v-output[i-1].v)>1e-12);
}
function voronoi(doc){return doc.sites.map(site=>{
 let cell=[{u:0,v:0},{u:1,v:0},{u:1,v:1},{u:0,v:1}],p=site.center.uv;
 for(const other of doc.sites){if(other.id===site.id)continue;const q=other.center.uv;
  if(Math.hypot(p.u-q.u,p.v-q.v)<1e-7)throw Error('两个打卡中心重合，请先移开中心');
  const a=2*(q.u-p.u),b=2*(q.v-p.v)*MAP_ASPECT**2,c=q.u*q.u-p.u*p.u+(q.v*q.v-p.v*p.v)*MAP_ASPECT**2;
  cell=halfPlane(cell,a,b,c);if(cell.length<3)break;
 }return cell.length>=3?intersection(ringGeometry(cell),doc.boundary.geometry):[];
});}
/** Keep exclusive hand-drawn areas; allocate only overlaps/gaps by nearest site. */
export function repairCoverage(doc,{repartition=false}={}){
 assertDocument(doc);
 for(const site of doc.sites)if(!pointInGeometry(site.center.uv,doc.boundary.geometry))throw Error(`${site.name}中心在校区范围外，请先调整`);
 const cells=voronoi(doc),clipped=doc.sites.map(s=>intersection(s.geometry,doc.boundary.geometry));
 const unique=repartition?doc.sites.map(()=>[]):clipped.map((shape,i)=>difference(shape,...clipped.filter((_,j)=>i!==j)));
 const remainder=difference(doc.boundary.geometry,union(unique));
 const next=clone(doc);next.sites=next.sites.map((site,i)=>({...site,geometry:union([unique[i],intersection(remainder,cells[i])])}));
 const report=coverageReport(next);
 if(!report.valid)throw Error(report.errors[0]?.message??'整理后仍有空隙或重叠，未替换原稿');
 return next;
}

export function seedStudioDocument(legacy,landmarks=[]){
 return{schema:2,mapId:STUDIO_MAP_ID,boundary:{name:legacy.gameBoundary.name,geometry:ringGeometry(legacy.gameBoundary.polygon)},notes:'推荐初稿，边界与打卡范围待团队核对。',sites:legacy.checkInPoints.map(point=>{
  const region=legacy.regions.find(r=>r.id===point.regionId),landmark=landmarks.find(p=>p.id===point.id);
  return{id:point.id,name:point.name,subtitle:region.subtitle,intro:landmark?.description??region.story.body,verse:region.story.verse,icon:landmark?.icon??(point.id==='tower'?'tower':'gate'),physical:point.physical,center:{uv:clone(point.centerUv),...(point.wgs84?{wgs84:clone(point.wgs84)}:{})},radiusM:point.radiusM,geometry:ringGeometry(region.polygon),photos:[{id:'seed-'+point.id,alt:point.name+' · 概念占位插画'}]};
 })};
}
export function newSite(doc,uv,id){
 const center={u:Math.min(.98,Math.max(.02,uv.u)),v:Math.min(.98,Math.max(.02,uv.v))},d=.025;
 return{id,name:'新景点',subtitle:'校园新一站',intro:'',verse:'',icon:'gate',physical:true,center:{uv:center},radiusM:40,geometry:ringGeometry([{u:center.u-d,v:center.v-d},{u:center.u+d,v:center.v-d},{u:center.u+d,v:center.v+d},{u:center.u-d,v:center.v+d}]),photos:[]};
}
export const operationKey=op=>op.type==='set'?`${op.target}/${op.field}`:op.type==='photo'?`site:${op.siteId}/photo:${op.photo?.id}`:`site:${op.site?.id??op.id}/entity`;
export function applyOperations(document,operations,{optimistic=false}={}){
 const doc=clone(document);
 for(const op of operations){
  if(op.type==='add'){if(doc.sites.some(s=>s.id===op.site?.id)){if(optimistic)continue;throw Error('景点ID已存在');}doc.sites.push(clone(op.site));}
  else if(op.type==='delete'){const index=doc.sites.findIndex(s=>s.id===op.id);if(index<0){if(optimistic)continue;throw Error('景点已被删除');}doc.sites.splice(index,1);}
  else if(op.type==='photo'){
   const site=doc.sites.find(s=>s.id===op.siteId);if(!site){if(optimistic)continue;throw Error('景点已被删除');}
   const index=site.photos.findIndex(p=>p.id===op.photo?.id);
   if(op.action==='add'){if(index<0)site.photos.push(clone(op.photo));}
   else if(op.action==='remove'){if(index>=0)site.photos.splice(index,1);}
   else if(op.action==='caption'){if(index>=0)site.photos[index]=clone(op.photo);else if(!optimistic)throw Error('照片已被移除');}
   else throw Error('照片操作无效');
  }else if(op.type==='set'){
   if(op.target==='boundary'){if(!['name','geometry'].includes(op.field))throw Error('校区字段无效');doc.boundary[op.field]=clone(op.value);}
   else{const site=doc.sites.find(s=>'site:'+s.id===op.target);if(!site){if(optimistic)continue;throw Error('景点已被删除');}if(!SITE_FIELDS.includes(op.field))throw Error('景点字段无效');site[op.field]=clone(op.value);}
  }else throw Error('编辑操作无效');
 }
 return optimistic?doc:canonicalDocument(doc);
}
export function publicPhotoUrl(photo){return photo.id.startsWith('seed-')?'/api/content/seed-media/'+photo.id.slice(5)+'.webp':'/api/content/media/'+photo.id+'.webp';}
