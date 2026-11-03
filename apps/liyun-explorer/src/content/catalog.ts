import {LANDMARKS as BASE} from '../data';
import type {Landmark,UV} from '../types';
import type {Publication} from '../../shared/published.mjs';
import {photoURL,validPublication} from '../../shared/published.mjs';
import {createCampusMap} from '../location/vendor/coordinates.mjs';
import metadata from '../location/data/map.json';
import artifact from '../location/data/selected_model.json';

declare global{interface Window{__LIYUN_CONTENT__?:Publication}}
const candidate=typeof window==='undefined'?undefined:window.__LIYUN_CONTENT__;
export const PUBLICATION=validPublication(candidate)?candidate:null;
const original=new Map(BASE.map(p=>[p.id,p]));
export const KNOWN_ANCHORS:Record<string,UV>={...Object.fromEntries(BASE.map(p=>[p.id,p.uv])),...Object.fromEntries(Object.entries(PUBLICATION?.knownAnchors??{}).map(([id,uv])=>[id,original.get(id)?.uv??uv])),...Object.fromEntries(PUBLICATION?.document.sites.map(s=>[s.id,original.get(s.id)?.uv??s.center.uv])??[])};
export const LANDMARKS:Landmark[]=PUBLICATION?PUBLICATION.document.sites.map(site=>({id:site.id,name:site.name,subtitle:site.subtitle,uv:{...(original.get(site.id)?.uv??site.center.uv)},icon:site.icon as Landmark['icon'],regionId:site.id,description:site.intro,verse:site.verse,progress:100/PUBLICATION.document.sites.length,checkInRadius:site.radiusM,isBeacon:!site.physical,photos:site.photos.map(p=>({url:photoURL(p.id),alt:p.alt}))})):BASE;
const model=PUBLICATION?createCampusMap(metadata,artifact):null;
export function publishedOverride(id:string){
 const site=PUBLICATION?.document.sites.find(s=>s.id===id);if(!site||!model)return undefined;
 const geo=site.center.wgs84??model.uvToGeo(site.center.uv.u,site.center.uv.v);
 return{id,centerUv:{...site.center.uv},radiusM:site.radiusM,latitude:geo.latitude,longitude:geo.longitude,status:'confirmed' as const,fieldConfirmationRequired:false as const};
}
