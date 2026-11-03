import {createCampusMap} from '../location/vendor/coordinates.mjs';
import metadata from '../location/data/map.json';
import model from '../location/data/selected_model.json';
import type {Site,UV} from '../../shared/authoring.mjs';
export const WIDTH=4000,HEIGHT=4958;
export const mapModel=createCampusMap(metadata,model);
export function centerGeo(site:Site){return site.center.wgs84??mapModel.uvToGeo(site.center.uv.u,site.center.uv.v);}
export function distanceM(a:{latitude:number;longitude:number},b:{latitude:number;longitude:number}){const rad=Math.PI/180,x=(b.latitude-a.latitude)*rad,y=(b.longitude-a.longitude)*rad,h=Math.sin(x/2)**2+Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin(y/2)**2;return 6378137*2*Math.asin(Math.min(1,Math.sqrt(h)));}
export function projectedRange(site:Site):UV[]{
 const p=centerGeo(site),lat=p.latitude*Math.PI/180,lon=p.longitude*Math.PI/180,d=site.radiusM/6378137;
 return Array.from({length:72},(_,i)=>{const b=i*Math.PI/36,nextLat=Math.asin(Math.sin(lat)*Math.cos(d)+Math.cos(lat)*Math.sin(d)*Math.cos(b)),nextLon=lon+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(lat),Math.cos(d)-Math.sin(lat)*Math.sin(nextLat)),uv=mapModel.gpsToMap(nextLat*180/Math.PI,nextLon*180/Math.PI);return{u:uv.u,v:uv.v};});
}
