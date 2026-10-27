import {brotliCompress,gzip,constants} from 'node:zlib';
import {promisify} from 'node:util';
const br=promisify(brotliCompress),gz=promisify(gzip);

export function acceptedEncoding(header='') {
 const preferences=new Map();
 for(const token of String(header).toLowerCase().split(',')){
  const [name,...params]=token.trim().split(';');if(!name)continue;
  let quality=1;for(const parameter of params){const m=parameter.trim().match(/^q=(0(?:\.\d+)?|1(?:\.0+)?)$/);if(m)quality=Number(m[1]);}
  preferences.set(name,quality);
 }
 const quality=name=>preferences.get(name)??preferences.get('*')??0;
 return ['br','gzip'].filter(name=>quality(name)>0).sort((a,b)=>quality(b)-quality(a))[0]||null;
}

export function createStaticEncoder({maxBytes=8*1024*1024}={}) {
 const cache=new Map();let total=0;
 return {
  async encode(bytes,{file,mtimeMs,contentType},accept){
   const encoding=acceptedEncoding(accept);
   if(!encoding||bytes.length<512||bytes.length>2*1024*1024||! /^(?:text\/|application\/(?:javascript|json)|image\/svg\+xml)/.test(contentType))return{bytes,encoding:null};
   const key=file+':'+mtimeMs+':'+bytes.length+':'+encoding;
   if(cache.has(key)){const value=cache.get(key);cache.delete(key);cache.set(key,value);return{bytes:value,encoding};}
   const result=encoding==='br'?await br(bytes,{params:{[constants.BROTLI_PARAM_QUALITY]:5}}):await gz(bytes,{level:6});
   if(result.length>=bytes.length)return{bytes,encoding:null};
   cache.set(key,result);total+=result.length;
   while(total>maxBytes&&cache.size){const oldest=cache.keys().next().value;total-=cache.get(oldest).length;cache.delete(oldest);}
   return{bytes:result,encoding};
  },
  clear(){cache.clear();total=0;}
 };
}
