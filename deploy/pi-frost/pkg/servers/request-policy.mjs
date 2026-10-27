import {isIP} from 'node:net';
import {readFileSync,statSync,statfsSync} from 'node:fs';
import path from 'node:path';
import {fail,HttpError} from './security.mjs';

export function positiveSetting(value,fallback,name) {
  if(value===undefined||value===null||value==='')return fallback;
  const parsed=Number(value);
  if(!Number.isSafeInteger(parsed)||parsed<1)throw new Error(`${name} must be a positive safe integer`);
  return parsed;
}
export function normalizeAddress(value) {
  if(typeof value!=='string')return null;
  const address=value.toLowerCase();
  const mapped=address.startsWith('::ffff:')?address.slice(7):address;
  if(isIP(mapped)===4)return mapped;
  if(isIP(address)===6){try{return new URL(`http://[${address}]/`).hostname.slice(1,-1);}catch{return null;}}
  return null;
}
function trustedAddresses(value) {
  const supplied=Array.isArray(value)?value:String(value??'127.0.0.1,::1').split(',');
  const result=supplied.map(item=>normalizeAddress(String(item).trim()));
  if(!result.length||result.some(item=>!item))throw new Error('FROST_TRUSTED_PROXIES must list exact IP addresses');
  return new Set(result);
}
export function createRequestPolicy({trustProxy=false,trustedProxies,publicOrigin=null,proxyClientHeader='x-forwarded-for'}={}) {
  const trusted=trustedAddresses(trustedProxies);
  if(!['x-forwarded-for','cf-connecting-ip'].includes(proxyClientHeader))throw new Error('FROST_PROXY_CLIENT_HEADER must be x-forwarded-for or cf-connecting-ip');
  const configuredHost=publicOrigin?new URL(publicOrigin).host:null;
  return req=>{
    const host=req.headers.host;
    const hostCount=req.rawHeaders?.filter((_,i)=>i%2===0&&req.rawHeaders[i].toLowerCase()==='host').length;
    if(typeof host!=='string'||hostCount!==1||host.length>255||/[\s\\/@#?,%]/.test(host))fail(400,'INVALID_HOST','请求主机格式不正确。');
    let parsed;
    try {parsed=new URL(`http://${host}/`);}catch{fail(400,'INVALID_HOST','请求主机格式不正确。');}
    if(parsed.host.toLowerCase()!==host.toLowerCase()||parsed.username||parsed.password||!parsed.hostname||parsed.pathname!=='/')fail(400,'INVALID_HOST','请求主机格式不正确。');
    const localHost=['localhost','127.0.0.1','[::1]'].includes(parsed.hostname.toLowerCase());
    if(configuredHost&&host.toLowerCase()!==configuredHost.toLowerCase()&&!localHost)fail(400,'INVALID_HOST','请求主机不匹配。');
    const peer=normalizeAddress(req.socket.remoteAddress)||'unknown';
    const proxy=trustProxy&&trusted.has(peer);
    let address=peer,scheme=req.socket.encrypted?'https':'http';
    if(proxy){
      const forwarded=req.headers[proxyClientHeader];
      if(forwarded!==undefined){
        const normalized=normalizeAddress(forwarded);
        if(!normalized)fail(400,'INVALID_PROXY_METADATA','代理网络信息不正确。');
        address=normalized;
      }
      const proto=req.headers['x-forwarded-proto'];
      if(proto!==undefined&&!['http','https'].includes(proto))fail(400,'INVALID_PROXY_METADATA','代理网络信息不正确。');
      if(proto)scheme=proto;
    }
    return {address,scheme,proxy,origin:publicOrigin||`${scheme}://${host}`};
  };
}

export function productionAssets(root) {
  let manifest;
  try {manifest=JSON.parse(readFileSync(path.join(root,'apps/map/resource-manifest.json'),'utf8'));}
  catch {throw new Error('Production requires a valid resource-manifest.json');}
  if(!Array.isArray(manifest.assets)||!manifest.assets.length||manifest.assets.length>2000)throw new Error('Production resource manifest is invalid');
  const allowed=new Set(['/','/index.html','/resource-manifest.json','/sw.js']);
  for(const asset of manifest.assets){
    const url=asset?.url;
    if(typeof url!=='string'||!url.startsWith('/')||url.startsWith('//')||/[\\\u0000?#%]/.test(url)||url.split('/').some(part=>part==='.'||part==='..'||part.startsWith('.'))||/^\/(?:api|admin|server-data)(?:\/|$)/i.test(url))throw new Error('Production manifest contains an invalid public path');
    allowed.add(url);
  }
  return allowed;
}
export function createStorageGuard({dataDir,minFreeBytes=268435456,maxDbBytes=8589934592}={}) {
  const size=file=>{try{return statSync(file).size;}catch(error){if(error.code==='ENOENT')return 0;throw error;}};
  return (additionalBytes=0)=>{
    try {
      const estimated=Math.max(0,additionalBytes)*3+65536;
      const info=statfsSync(dataDir,{bigint:true});
      const available=info.bavail*info.bsize;
      const database=size(path.join(dataDir,'frost.sqlite'))+size(path.join(dataDir,'frost.sqlite-wal'));
      if(available<BigInt(minFreeBytes)+BigInt(estimated)||database+estimated>maxDbBytes){
        const error=new HttpError(507,'STORAGE_CAPACITY','服务端存储暂时不足，资料仍保留在本机，请稍后重试或联系维护人员。');
        error.retryAfter=60;throw error;
      }
    }catch(error){
      if(error instanceof HttpError)throw error;
      const unavailable=new HttpError(503,'STORAGE_UNAVAILABLE','暂时无法确认存储状态，请稍后重试。');
      unavailable.retryAfter=30;throw unavailable;
    }
  };
}
