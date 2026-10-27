import path from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {constants,mkdirSync,lstatSync,realpathSync,readdirSync,unlinkSync} from 'node:fs';
import {open} from 'node:fs/promises';
import {fail,HttpError} from './security.mjs';

const FILE=/^frost-download-([a-f0-9]{64})-(\d{13})\.png$/;
const TOKEN=/^[A-Za-z0-9_-]{43}$/;
const hash=value=>createHash('sha256').update(value).digest('hex');
const bounded=(value,fallback,maximum)=>{const number=value??fallback;if(!Number.isSafeInteger(number)||number<1||number>maximum)throw new Error('Invalid postcard download capacity');return number;};
const busy=()=>{const error=new HttpError(503,'DOWNLOAD_BUSY','临时下载正在处理中，请稍后重试。');error.retryAfter=3;throw error;};

// Tickets are intentionally process-local. A restart invalidates old links, and
// only SHA-256 digests of the 256-bit bearer tokens are retained in memory.
export function createPostcardDownloads({dataDir,isSessionValid,storageGuard,now=Date.now,ttlMs=600_000,maxBytes=256*1024*1024,maxTickets=512}={}){
  // The HTTP and LAN listeners are separate processes: each has half of the
  // deployment's 512 MiB / 1024 live-ticket allowance. Existing unexpired files
  // are also counted conservatively when either listener restarts.
  ttlMs=bounded(ttlMs,600_000,600_000);maxBytes=bounded(maxBytes,256*1024*1024,256*1024*1024);maxTickets=bounded(maxTickets,512,512);
  const parent=realpathSync(dataDir),directory=path.join(parent,'.postcard-downloads-v1');
  try{mkdirSync(directory,{mode:0o700});}catch(error){if(error.code!=='EEXIST')throw error;}
  function assertDirectory(){const info=lstatSync(directory);if(info.isSymbolicLink()||!info.isDirectory()||realpathSync(directory)!==directory)throw new Error('Unsafe postcard download directory');}
  assertDirectory();
  const files=new Map(),tickets=new Map(),owners=new Map(),pending=new Set();
  let fileBytes=0,pendingBytes=0,closed=false;
  const filePath=name=>{if(!FILE.test(name))throw new Error('Invalid temporary download filename');assertDirectory();return path.join(directory,name);};
  function removeFile(name){
    const entry=files.get(name);if(!entry)return;
    try{const target=filePath(name),info=lstatSync(target);if(info.isFile()&&!info.isSymbolicLink())unlinkSync(target);else return;}
    catch(error){if(error.code!=='ENOENT')return;}
    fileBytes-=entry.bytes;files.delete(name);
  }
  function discard(digest){const entry=tickets.get(digest);if(!entry)return;tickets.delete(digest);if(owners.get(entry.ownerKey)===digest)owners.delete(entry.ownerKey);removeFile(entry.name);}
  function sweep(){
    const at=now();
    for(const [digest,entry] of tickets)if(entry.expires<=at||!isSessionValid(entry.owner,entry.sessionHash))discard(digest);
    for(const [name,entry] of files)if(entry.expires<=at)removeFile(name);
  }
  for(const name of readdirSync(directory)){
    const match=FILE.exec(name);if(!match)continue;
    let info;try{info=lstatSync(filePath(name));}catch(error){if(error.code==='ENOENT')continue;throw error;}
    if(!info.isFile()||info.isSymbolicLink())continue;
    files.set(name,{bytes:info.size,expires:Number(match[2])});fileBytes+=info.size;
  }
  sweep();
  const timer=setInterval(()=>{try{sweep();}catch{}},30_000);timer.unref?.();
  return {
    async issue({owner,sessionHash,side,bytes}){
      if(!['front','back','both'].includes(side))fail(400,'INVALID_POSTCARD_SIDE','请选择霜信下载版式。');
      if(closed)busy();sweep();
      const ownerKey=owner+'\0'+side,previous=owners.get(ownerKey);
      if(pending.has(ownerKey)||(!previous&&tickets.size+pending.size>=maxTickets)||fileBytes+pendingBytes+bytes.length>maxBytes)busy();
      const expires=now()+ttlMs,token=randomBytes(32).toString('base64url'),digest=hash(token);
      const name=`frost-download-${randomBytes(32).toString('hex')}-${String(expires).padStart(13,'0')}.png`;
      pending.add(ownerKey);pendingBytes+=bytes.length;
      let handle,created=false,published=false;
      try{
        storageGuard(bytes.length);
        handle=await open(filePath(name),constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|(constants.O_NOFOLLOW||0),0o600);created=true;
        await handle.writeFile(bytes);await handle.close();handle=null;
        if(closed)busy();
        if(!isSessionValid(owner,sessionHash))fail(401,'AUTH_REQUIRED','登录已失效，请重新登录后生成下载链接。');
        files.set(name,{bytes:bytes.length,expires});fileBytes+=bytes.length;
        if(previous)discard(previous);
        tickets.set(digest,{name,owner,sessionHash,ownerKey,side,bytes:bytes.length,expires});owners.set(ownerKey,digest);published=true;
        return{url:'/api/postcard-downloads/'+token,expiresAt:new Date(expires).toISOString()};
      }finally{
        try{await handle?.close();}catch{}
        if(created&&!published){try{unlinkSync(filePath(name));}catch{}}
        pending.delete(ownerKey);pendingBytes-=bytes.length;
      }
    },
    lookup(token){
      if(closed||!TOKEN.test(token))return null;
      const digest=hash(token),entry=tickets.get(digest);
      if(!entry)return null;
      if(entry.expires<=now()||!isSessionValid(entry.owner,entry.sessionHash)){discard(digest);return null;}
      return {...entry,digest};
    },
    async read(entry){
      let handle;
      try{
        const target=filePath(entry.name),before=lstatSync(target);
        if(before.isSymbolicLink()||!before.isFile())fail(404,'NOT_FOUND','下载链接无效或已过期。');
        handle=await open(target,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
        const info=await handle.stat();
        if(!info.isFile()||info.size!==entry.bytes||info.nlink!==1||before.dev!==info.dev||before.ino!==info.ino)fail(404,'NOT_FOUND','下载链接无效或已过期。');
        const bytes=Buffer.alloc(entry.bytes);let offset=0;
        while(offset<bytes.length){const {bytesRead}=await handle.read(bytes,offset,bytes.length-offset,offset);if(!bytesRead)break;offset+=bytesRead;}
        if(offset!==entry.bytes||!this.lookupByDigest(entry.digest))fail(404,'NOT_FOUND','下载链接无效或已过期。');
        return bytes;
      }catch(error){if(error instanceof HttpError)throw error;fail(404,'NOT_FOUND','下载链接无效或已过期。');}
      finally{await handle?.close();}
    },
    lookupByDigest(digest){const entry=tickets.get(digest);if(!entry||closed)return false;if(entry.expires<=now()||!isSessionValid(entry.owner,entry.sessionHash)){discard(digest);return false;}return true;},
    close(){if(closed)return;closed=true;clearInterval(timer);for(const digest of tickets.keys())discard(digest);},
  };
}
