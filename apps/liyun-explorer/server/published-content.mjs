import fs from 'node:fs';
import {validPublication} from '../shared/published.mjs';
let file=null,stamp=null,cached={};
/** Only a local, explicitly configured author publication may extend the save whitelist. */
export function publishedAnchors(){
 const source=process.env.LIYUN_CONTENT_FILE;if(!source)return{};
 if(source!==file){file=source;stamp=null;cached={};}
 try{
  const stat=fs.statSync(source);if(!stat.isFile()||stat.size>2*1024*1024)return cached;
  const version=stat.mtimeMs+':'+stat.size;if(version===stamp)return cached;
  const value=JSON.parse(fs.readFileSync(source,'utf8'));if(!validPublication(value))return cached;
  cached={...(value.knownAnchors??{}),...Object.fromEntries(value.document.sites.map(s=>[s.id,s.center.uv]))};stamp=version;
 }catch{/* Keep the last valid catalog while the authoring service is unavailable. */}
 return cached;
}
