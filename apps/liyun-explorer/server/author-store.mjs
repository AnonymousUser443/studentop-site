import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {canonicalDocument,applyOperations,operationKey,coverageReport,documentProblems,clone} from '../shared/authoring.mjs';

export const hash=value=>createHash('sha256').update(value).digest('hex');
const error=(status,message,extra={})=>Object.assign(Error(message),{status,...extra});
function atomicJSON(file,value){const temp=file+'.'+randomBytes(8).toString('hex')+'.tmp';try{fs.writeFileSync(temp,JSON.stringify(value),{mode:0o644,flag:'wx'});fs.chmodSync(temp,0o644);fs.renameSync(temp,file);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}}

export function openAuthorStore({dataDir,seed,now=Date.now,publishedFile=path.join(dataDir,'published.json')}){
 fs.mkdirSync(dataDir,{recursive:true,mode:0o755});fs.mkdirSync(path.join(dataDir,'media'),{recursive:true,mode:0o700});
 const dbFile=path.join(dataDir,'author.sqlite'),db=new DatabaseSync(dbFile);fs.chmodSync(dbFile,0o600);
 db.exec(`PRAGMA journal_mode=WAL;PRAGMA busy_timeout=5000;PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS workspace(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,document_json TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS versions(field TEXT PRIMARY KEY,revision INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS changes(revision INTEGER PRIMARY KEY,client_id TEXT NOT NULL,actor TEXT NOT NULL,request_id TEXT NOT NULL UNIQUE,operations_json TEXT NOT NULL,document_json TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,name TEXT NOT NULL,expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,bytes INTEGER NOT NULL,width INTEGER NOT NULL,height INTEGER NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS publications(revision INTEGER PRIMARY KEY,document_json TEXT NOT NULL,actor TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS public_media(id TEXT PRIMARY KEY);
 CREATE TABLE IF NOT EXISTS catalog_ids(id TEXT PRIMARY KEY,u REAL NOT NULL,v REAL NOT NULL);
 CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
 if(!db.prepare('SELECT 1 FROM workspace').get())db.prepare('INSERT INTO workspace VALUES(1,0,?)').run(JSON.stringify(canonicalDocument(seed)));
 const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value;}catch(e){db.exec('ROLLBACK');throw e;}};
 const published=()=>{const row=db.prepare('SELECT p.* FROM publications p JOIN metadata m ON m.key=\'published\' AND m.value=CAST(p.revision AS TEXT)').get();return row?{revision:row.revision,document:JSON.parse(row.document_json),knownAnchors:Object.fromEntries(db.prepare('SELECT id,u,v FROM catalog_ids').all().map(r=>[r.id,{u:r.u,v:r.v}])),reviewedBy:row.actor,publishedAt:row.created_at}:null;};
 const writePublic=()=>{const value=published();if(value){const known=db.prepare('SELECT id,u,v FROM catalog_ids').all();atomicJSON(publishedFile,{...value,knownAnchors:Object.fromEntries(known.map(r=>[r.id,{u:r.u,v:r.v}]))});}};
 writePublic();
 const snapshot=()=>{const row=db.prepare('SELECT * FROM workspace WHERE id=1').get();return{revision:row.revision,document:JSON.parse(row.document_json),versions:Object.fromEntries(db.prepare('SELECT * FROM versions').all().map(r=>[r.field,r.revision])),publishedRevision:published()?.revision??null};};
 const checkPhotos=doc=>{for(const site of doc.sites)for(const photo of site.photos)if(!photo.id.startsWith('seed-')&&!db.prepare('SELECT 1 FROM media WHERE id=?').get(photo.id))throw error(400,'照片尚未上传或已丢失，请重新选择');};
 const apply=({requestId,clientId,operations},actor)=>transaction(()=>{
  if(typeof requestId!=='string'||!/^[-a-zA-Z0-9_]{8,100}$/.test(requestId)||typeof clientId!=='string'||!/^[-a-zA-Z0-9_]{8,100}$/.test(clientId)||!Array.isArray(operations)||!operations.length||operations.length>1024)throw error(400,'编辑操作格式不正确');
  const existing=db.prepare('SELECT revision,client_id FROM changes WHERE request_id=?').get(requestId);
  if(existing){if(existing.client_id!==clientId)throw error(409,'请求编号冲突');return{...snapshot(),appliedRevision:existing.revision,replayed:true};}
  const before=snapshot(),conflicts=[],addedIds=new Set(operations.filter(op=>op?.type==='add').map(op=>op.site?.id));
  for(const op of operations){
   if(!op||typeof op!=='object'||!['set','add','delete','photo'].includes(op.type)||op.type==='set'&&(typeof op.target!=='string'||typeof op.field!=='string')||op.type==='add'&&!op.site||op.type==='delete'&&typeof op.id!=='string'||op.type==='photo'&&(typeof op.siteId!=='string'||!op.photo||typeof op.photo.id!=='string'))throw error(400,'编辑操作格式不正确');
   const key=operationKey(op);if(!Number.isInteger(op.expected)||op.expected<0)throw error(400,'操作缺少字段版本');
   const version=before.versions[key]??0;if(version!==op.expected)conflicts.push({key,expected:op.expected,actual:version});
   if(op.type==='delete'&&!before.document.sites.some(s=>s.id===op.id))conflicts.push({key,deleted:true});
   if(op.type==='set'&&op.target.startsWith('site:')&&!before.document.sites.some(s=>'site:'+s.id===op.target)&&!addedIds.has(op.target.slice(5)))conflicts.push({key,deleted:true});
   if(op.type==='photo'&&!before.document.sites.some(s=>s.id===op.siteId)&&!addedIds.has(op.siteId))conflicts.push({key,deleted:true});
  }
  if(conflicts.length)throw error(409,'同一内容已被其他成员修改，请选择保留哪一份',{conflicts,snapshot:before});
  let document;try{document=applyOperations(before.document,operations);}catch(e){throw error(400,e.message);}
  checkPhotos(document);const revision=before.revision+1;
  db.prepare('UPDATE workspace SET revision=?,document_json=? WHERE id=1').run(revision,JSON.stringify(document));
  const version=db.prepare('INSERT INTO versions VALUES(?,?) ON CONFLICT(field) DO UPDATE SET revision=excluded.revision');
  for(const op of operations){version.run(operationKey(op),revision);const id=op.type==='set'&&op.target.startsWith('site:')?op.target.slice(5):op.type==='add'?op.site.id:op.type==='delete'?op.id:op.type==='photo'?op.siteId:null;if(id)version.run('site:'+id+'/entity',revision);if(op.type==='photo')version.run('site:'+op.siteId+'/photos',revision);}
  db.prepare('INSERT INTO changes VALUES(?,?,?,?,?,?,?)').run(revision,clientId,actor,requestId,JSON.stringify(operations),JSON.stringify(document),new Date(now()).toISOString());
  db.prepare('DELETE FROM changes WHERE revision < ? AND revision NOT IN (SELECT revision FROM publications)').run(Math.max(0,revision-200));
  return{...snapshot(),appliedRevision:revision};
 });
 const publish=({baseRevision,confirmed},actor)=>{
  const before=snapshot();if(baseRevision!==before.revision)throw error(409,'草稿已有新改动，请重新预览后发布',{snapshot:before});
  if(confirmed!==true)throw error(400,'请先预览并明确确认发布');
  const issues=documentProblems(before.document,{geometry:true,publish:true}),report=coverageReport(before.document);
  if(issues.length||!report.valid)throw error(422,issues[0]?.message??'分区尚未完整覆盖校区，或存在重叠/越界',{issues,report});
  checkPhotos(before.document);
  const previous=published(),file=publishedFile,previousFile=fs.existsSync(file)?fs.readFileSync(file):null;
  try{return transaction(()=>{
   const at=new Date(now()).toISOString();db.prepare('INSERT INTO publications VALUES(?,?,?,?) ON CONFLICT(revision) DO NOTHING').run(before.revision,JSON.stringify(before.document),actor,at);
   db.prepare('INSERT INTO metadata VALUES(\'published\',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(String(before.revision));
   for(const site of before.document.sites)db.prepare('INSERT INTO catalog_ids VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET u=excluded.u,v=excluded.v').run(site.id,site.center.uv.u,site.center.uv.v);
   for(const site of before.document.sites)for(const photo of site.photos)if(!photo.id.startsWith('seed-'))db.prepare('INSERT OR IGNORE INTO public_media VALUES(?)').run(photo.id);
   writePublic();return{...snapshot(),published:published(),previousRevision:previous?.revision??null};
  });}catch(e){if(previousFile)fs.writeFileSync(file,previousFile,{mode:0o644});else if(fs.existsSync(file))fs.unlinkSync(file);throw e;}
 };
 const session=token=>{if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))return null;const row=db.prepare('SELECT * FROM sessions WHERE token_hash=?').get(hash(token));return row&&row.expires_at>now()?{id:hash(token),name:row.name}:null;};
 const createSession=name=>{db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now());const token=randomBytes(32).toString('base64url');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),name,now()+12*3600000);return token;};
 const preview=revision=>{const current=snapshot();if(revision===current.revision)return{revision,document:current.document,preview:true};const row=db.prepare('SELECT document_json FROM changes WHERE revision=?').get(revision);if(!row)throw error(404,'预览版本不存在或已过期');return{revision,document:JSON.parse(row.document_json),preview:true};};
 const addMedia=bytes=>{
  if(bytes.length<30||bytes.length>4*1024*1024||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP'||bytes.readUInt32LE(4)+8!==bytes.length)throw error(400,'只接受浏览器处理后的WebP照片（最多4MiB）');
  const kind=bytes.toString('ascii',12,16);let width,height;
  if(kind==='VP8X'){width=bytes.readUIntLE(24,3)+1;height=bytes.readUIntLE(27,3)+1;}
  else if(kind==='VP8 '&&bytes.toString('hex',23,26)==='9d012a'){width=bytes.readUInt16LE(26)&0x3fff;height=bytes.readUInt16LE(28)&0x3fff;}
  else if(kind==='VP8L'&&bytes[20]===0x2f){const bits=bytes.readUInt32LE(21);width=(bits&0x3fff)+1;height=((bits>>>14)&0x3fff)+1;}
  if(!width||!height||width>4096||height>4096||width*height>16000000)throw error(400,'照片尺寸无效或超过4096像素');
  const id=hash(bytes);if(!db.prepare('SELECT 1 FROM media WHERE id=?').get(id)){
   const total=db.prepare('SELECT COALESCE(sum(bytes),0) total FROM media').get().total;if(total+bytes.length>256*1024*1024)throw error(413,'团队照片空间已达256MiB，请联系维护者整理');
   const dest=path.join(dataDir,'media',id+'.webp');if(!fs.existsSync(dest))fs.writeFileSync(dest,bytes,{mode:0o600,flag:'wx'});
   db.prepare('INSERT INTO media VALUES(?,?,?,?,?)').run(id,bytes.length,width,height,new Date(now()).toISOString());
  }return{id,bytes:bytes.length,width,height};
 };
 return{db,snapshot,apply,publish,published,preview,session,createSession,deleteSession:token=>db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token??'')),addMedia,mediaPath:id=>path.join(dataDir,'media',id+'.webp'),isPublicMedia:id=>!!db.prepare('SELECT 1 FROM public_media WHERE id=?').get(id),history:()=>db.prepare('SELECT revision,actor,created_at FROM publications ORDER BY created_at DESC LIMIT 50').all(),close:()=>db.close()};
}
