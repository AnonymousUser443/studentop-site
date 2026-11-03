// Lightweight player/API contract. Boolean geometry remains on the authoring side.
export const photoURL=id=>id.startsWith('seed-')?'/api/content/seed-media/'+id.slice(5)+'.webp':'/api/content/media/'+id+'.webp';
export function validPublication(value){
 const uv=p=>!!p&&Number.isFinite(p.u)&&Number.isFinite(p.v)&&p.u>=0&&p.u<=1&&p.v>=0&&p.v<=1;
 const id=s=>typeof s==='string'&&/^[a-z][a-z0-9_-]{0,47}$/.test(s);
 if(!value||!Number.isInteger(value.revision)||value.revision<0||value.document?.schema!==2||value.document.mapId!=='campus-v04-eaa124716c51375f')return false;
 const doc=value.document;if(!Array.isArray(doc.sites)||!doc.sites.length||doc.sites.length>64||new Set(doc.sites.map(s=>s?.id)).size!==doc.sites.length)return false;
 let vertices=0;const shape=g=>Array.isArray(g)&&g.length>0&&g.length<=32&&g.every(p=>Array.isArray(p)&&p.length>0&&p.length<=16&&p.every(r=>Array.isArray(r)&&r.length>=3&&r.length<=256&&(vertices+=r.length)<=4096&&r.every(uv)));
 if(!shape(doc.boundary?.geometry)||typeof doc.boundary.name!=='string')return false;
 for(const site of doc.sites){if(!id(site.id)||typeof site.name!=='string'||site.name.length>100||typeof site.intro!=='string'||site.intro.length>6000||typeof site.subtitle!=='string'||typeof site.verse!=='string'||typeof site.icon!=='string'||!['gate','book','lake','sport','star','leaf','flower','tower'].includes(site.icon)||typeof site.physical!=='boolean'||!uv(site.center?.uv)||!Number.isFinite(site.radiusM)||site.radiusM<5||site.radiusM>200||!shape(site.geometry)||!Array.isArray(site.photos)||site.photos.length>6||site.photos.some(p=>!p||!(/^[a-f0-9]{64}$/.test(p.id)||/^seed-(wencui|beihu|library|teaching|wenbo|sports|tower|park)$/.test(p.id))||typeof p.alt!=='string'||p.alt.length>300))return false;
  if(site.center.wgs84){const p=site.center.wgs84;if(p.source!=='manual-field'||!Number.isFinite(p.latitude)||Math.abs(p.latitude)>85||!Number.isFinite(p.longitude)||Math.abs(p.longitude)>180)return false;}
 }
 if(value.knownAnchors&&(typeof value.knownAnchors!=='object'||Object.keys(value.knownAnchors).length>4096||Object.entries(value.knownAnchors).some(([key,p])=>!id(key)||!uv(p))))return false;
 return true;
}
