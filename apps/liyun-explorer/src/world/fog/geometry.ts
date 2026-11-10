import { MAP_HEIGHT, MAP_WIDTH } from '../../data';
import type { Region } from '../../content/regions';
/** Consistent winding keeps holes transparent and adjacent pieces seam-free. */
export function polygonPath(region: Region): string {
 return (region.geometry??[[region.polygon]]).flatMap(component=>component.map((ring,hole)=>{
  const area=ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p.u*q.v-q.u*p.v;},0);
  const points=(hole===0?area<0:area>0)?[...ring].reverse():ring;
  return points.map((p,i)=>`${i?'L':'M'}${p.u*MAP_WIDTH},${p.v*MAP_HEIGHT}`).join(' ')+' Z';
 })).join(' ');
}
