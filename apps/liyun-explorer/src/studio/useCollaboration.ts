import {useEffect,useMemo,useRef,useState} from 'react';
import {applyOperations,clone,operationKey} from '../../shared/authoring.mjs';
import type {Operation,StudioDocument} from '../../shared/authoring.mjs';

export type Snapshot={revision:number;document:StudioDocument;versions:Record<string,number>;publishedRevision:number|null};
type Queued={op:Operation;inverse:Operation};
type Flight={requestId:string;clientId:string;operations:Operation[];items:Queued[];baseVersions:Record<string,number>;kind:'normal'|'undo'|'redo'};
type Conflict={message:string;keys:string[];deleted:boolean;flight:Flight};
type History={forward:Operation[];inverse:Operation[];version:number};
const PENDING_KEY='liyun.studio.pending.v1';
export class StudioError extends Error{constructor(public status:number,public data:Record<string,unknown>){super(String(data.error??'协作请求失败'));}}
export async function studioRequest<T>(route:string,options:RequestInit&{json?:unknown}={}):Promise<T>{
 const {json,...init}=options,headers=new Headers(init.headers);if(json!==undefined)headers.set('Content-Type','application/json');
 const response=await fetch('/api/editor'+route,{...init,headers,body:json!==undefined?JSON.stringify(json):init.body,credentials:'same-origin',cache:'no-store',redirect:'error'});
 const data=await response.json().catch(()=>({error:'服务器返回格式无效'}));if(!response.ok)throw new StudioError(response.status,data);return data as T;
}
function inverseFor(doc:StudioDocument,op:Operation):Operation{
 if(op.type==='add')return{type:'delete',id:op.site.id};
 if(op.type==='delete'){const site=doc.sites.find(s=>s.id===op.id);if(!site)throw Error('景点已被删除');return{type:'add',site:clone(site)};}
 if(op.type==='photo'){const original=doc.sites.find(s=>s.id===op.siteId)?.photos.find(p=>p.id===op.photo.id);return op.action==='add'?{...op,action:'remove'}:op.action==='remove'?{...op,action:'add',photo:clone(original??op.photo)}:{...op,photo:clone(original??op.photo)};}
 const target=op.target==='boundary'?doc.boundary:doc.sites.find(s=>'site:'+s.id===op.target);
 if(!target)throw Error('景点已被删除');return{...op,value:clone((target as unknown as Record<string,unknown>)[op.field])};
}
export function useCollaboration(){
 const [,render]=useState(0),[user,setUser]=useState<{name:string}|null>(null),[checking,setChecking]=useState(true),[inviteRequired,setInviteRequired]=useState(true),[connected,setConnected]=useState(false),[people,setPeople]=useState<{id:string;name:string}[]>([]),[error,setError]=useState<string|null>(null),[conflict,setConflict]=useState<Conflict|null>(null);
 const state=useRef<{server:Snapshot|null;queue:Queued[];flight:Flight|null;blocked:Conflict|null;sending:boolean;kind:'normal'|'undo'|'redo';timer:ReturnType<typeof setTimeout>|null;retries:number;undo:History[];redo:History[];clientId:string;closed:boolean}>({server:null,queue:[],flight:null,blocked:null,sending:false,kind:'normal',timer:null,retries:0,undo:[],redo:[],clientId:crypto.randomUUID(),closed:false});
 const eventSource=useRef<EventSource|null>(null),drainRef=useRef<()=>Promise<void>>(async()=>{});
 const changed=()=>{if(state.current.closed)return;try{sessionStorage.setItem(PENDING_KEY,JSON.stringify({clientId:state.current.clientId,queue:state.current.queue,flight:state.current.flight}));}catch{}render(v=>v+1);};
 const accept=(snapshot:Snapshot)=>{if(!state.current.server||snapshot.revision>=state.current.server.revision){state.current.server=snapshot;changed();}};
 const view=()=>{
  const s=state.current;if(!s.server)return null;
  return applyOperations(s.server.document,[...(s.blocked?.flight.items??s.flight?.items??[]),...s.queue].map(x=>x.op),{optimistic:true});
 };
 const schedule=(delay=300)=>{if(state.current.timer||state.current.closed)return;state.current.timer=setTimeout(()=>{state.current.timer=null;void drainRef.current();},delay);};
 const drain=async()=>{
  const s=state.current;if(s.sending||s.blocked||!s.server||s.closed)return;
  if(!s.flight){if(!s.queue.length)return;const items=s.queue.splice(0);s.flight={requestId:crypto.randomUUID(),clientId:s.clientId,operations:items.map(i=>i.op),items,baseVersions:clone(s.server.versions),kind:s.kind};s.kind='normal';}
  const packet=s.flight;s.sending=true;changed();
  try{
   const result=await studioRequest<Snapshot&{appliedRevision:number}>('/ops',{method:'POST',json:{requestId:packet.requestId,clientId:packet.clientId,operations:packet.operations}});
   accept(result);const latest=s.server!,affected=new Set(packet.operations.map(operationKey));
   for(const op of packet.operations)if(op.type==='set'&&op.target.startsWith('site:'))affected.add(op.target+'/entity');
   for(const op of packet.operations)if(op.type==='photo')affected.add('site:'+op.siteId+'/entity');
   for(const item of s.queue){const key=operationKey(item.op);if(affected.has(key)&&(item.op.expected??0)===(packet.baseVersions[key]??0)&&latest.versions[key]===result.appliedRevision)item.op.expected=result.appliedRevision;}
   const entry={forward:packet.items.map(i=>clone(i.op)),inverse:packet.items.map(i=>clone(i.inverse)).reverse(),version:result.appliedRevision};
   if(packet.kind==='undo'){const prior=s.undo.pop();if(prior)s.redo.push({...prior,version:result.appliedRevision});}
   else if(packet.kind==='redo'){const prior=s.redo.pop();if(prior)s.undo.push({...prior,version:result.appliedRevision});}
   else{s.undo=[...s.undo.slice(-49),entry];s.redo=[];}
   s.flight=null;s.retries=0;setError(null);
  }catch(cause){
   if(cause instanceof StudioError&&cause.status===401){setUser(null);eventSource.current?.close();setConnected(false);setError(cause.message);}
   else if(cause instanceof StudioError&&cause.status<500){
    if(cause.data.snapshot)accept(cause.data.snapshot as Snapshot);
    const conflicts=(cause.data.conflicts??[]) as {key:string;deleted?:boolean}[];
    s.blocked={message:cause.message,keys:conflicts.length?conflicts.map(c=>c.key):packet.operations.map(operationKey),deleted:conflicts.some(c=>c.deleted),flight:packet};s.flight=null;setConflict(s.blocked);
   }else{setConnected(false);setError('网络暂不可用，改动保留在此标签页，恢复连接后自动重试');s.retries++;schedule(Math.min(15000,1000*2**Math.min(4,s.retries)));}
  }finally{s.sending=false;changed();if(s.queue.length&&!s.flight&&!s.blocked)schedule();}
 };
 drainRef.current=drain;
 const connect=async()=>{
  const initial=await studioRequest<Snapshot>('/snapshot');accept(initial);eventSource.current?.close();
  const source=new EventSource('/api/editor/events?clientId='+encodeURIComponent(state.current.clientId));eventSource.current=source;
  source.onopen=()=>{setConnected(true);setError(null);void drainRef.current();};
  source.addEventListener('snapshot',event=>{try{accept(JSON.parse((event as MessageEvent).data));setConnected(true);}catch{setError('同步数据格式异常，请重新连接');}});
  source.addEventListener('presence',event=>{try{setPeople(JSON.parse((event as MessageEvent).data));}catch{/* Ignore malformed presence; document transport remains independent. */}});
  source.onerror=()=>{setConnected(false);void studioRequest<{user:{name:string}|null}>('/session').then(value=>{if(!value.user){source.close();setUser(null);setError('协作会话已过期，请重新加入');}}).catch(()=>{});};
 };
 useEffect(()=>{
  state.current.closed=false;
  try{const saved=JSON.parse(sessionStorage.getItem(PENDING_KEY)??'null');if(saved&&Array.isArray(saved.queue)&&saved.queue.length<=1024){state.current.queue=saved.queue;state.current.flight=saved.flight??null;}}catch{/* Invalid local recovery state does not overwrite the server. */}
  void studioRequest<{user:{name:string}|null;inviteRequired:boolean}>('/session').then(async info=>{setInviteRequired(info.inviteRequired);setUser(info.user);if(info.user)await connect();}).catch(()=>setError('协作服务未连接，请先运行 npm run studio 或联系维护者')).finally(()=>setChecking(false));
  const online=()=>{if(eventSource.current)void drainRef.current();};const before=(event:BeforeUnloadEvent)=>{if(state.current.queue.length||state.current.flight||state.current.blocked){event.preventDefault();event.returnValue='';}};
  window.addEventListener('online',online);window.addEventListener('beforeunload',before);
  return()=>{state.current.closed=true;eventSource.current?.close();if(state.current.timer)clearTimeout(state.current.timer);state.current.timer=null;window.removeEventListener('online',online);window.removeEventListener('beforeunload',before);};
 },[]);
 const join=async(name:string,inviteCode:string)=>{setError(null);try{const info=await studioRequest<{user:{name:string}}>('/session',{method:'POST',json:{name,inviteCode}});setUser(info.user);await connect();}catch(e){setError(e instanceof Error?e.message:'加入失败');throw e;}};
 const enqueue=(operations:Operation[],kind:'normal'|'undo'|'redo'='normal')=>{
  const s=state.current;if(!s.server||s.blocked)throw Error('请先处理同步状态');let doc=view()!;
  for(const input of operations){const op=clone(input),key=operationKey(op);op.expected=s.server.versions[key]??0;
   const previous=s.queue.findIndex(i=>operationKey(i.op)===key);
   if(previous>=0&&op.type==='set'&&s.queue[previous].op.type==='set'){op.expected=s.queue[previous].op.expected;s.queue[previous].op=op;}
   else{s.queue.push({op,inverse:inverseFor(doc,op)});}
   doc=applyOperations(doc,[op],{optimistic:true});
  }
  s.kind=kind;changed();schedule();
 };
 const resolve=(mine:boolean)=>{
  const s=state.current,blocked=s.blocked;if(!blocked||!s.server)return;
  const items=[...blocked.flight.items,...s.queue],keys=new Set(blocked.keys);let doc=s.server.document;
  s.queue=items.filter(item=>{
   if(!mine&&keys.has(operationKey(item.op)))return false;
   const op=item.op;if(!mine&&blocked.deleted){const id=op.type==='set'&&op.target.startsWith('site:')?op.target.slice(5):op.type==='photo'?op.siteId:op.type==='delete'?op.id:null;if(id&&!s.server!.document.sites.some(site=>site.id===id))return false;}
   return true;
  }).map(item=>{
   const op=clone(item.op);if(mine&&keys.has(operationKey(op)))op.expected=s.server!.versions[operationKey(op)]??0;
   const inverse=inverseFor(doc,op);doc=applyOperations(doc,[op],{optimistic:true});return{op,inverse};
  });s.blocked=null;setConflict(null);setError(null);changed();schedule(0);
 };
 const undoRedo=(redo=false)=>{
  const s=state.current;if(s.queue.length||s.flight||s.blocked||!s.server)return;const entry=(redo?s.redo:s.undo).at(-1);if(!entry)return;
  const ops=redo?entry.forward:entry.inverse;
  if(ops.some(op=>(s.server!.versions[operationKey(op)]??0)!==entry.version)){setError('上次改动的字段已有他人更新，不能直接撤销；请在当前内容上修改');return;}
  enqueue(ops,redo?'redo':'undo');
 };
 const flush=async()=>{
  if(state.current.timer){clearTimeout(state.current.timer);state.current.timer=null;}void drainRef.current();
  const until=Date.now()+15000;while(state.current.queue.length||state.current.flight||state.current.blocked){if(state.current.blocked)throw Error('请先处理协作冲突');if(Date.now()>until)throw Error('改动尚未同步，请等待网络恢复');await new Promise(r=>setTimeout(r,50));}
  return state.current.server!;
 };
 const document=view();
 return{document,snapshot:state.current.server,user,checking,inviteRequired,connected,people,error,conflict,join,enqueue,resolve,flush,
  dirty:!!(state.current.queue.length||state.current.flight||state.current.blocked),busy:state.current.sending,canUndo:state.current.undo.length>0,canRedo:state.current.redo.length>0,
  undo:()=>undoRedo(),redo:()=>undoRedo(true),clearError:()=>setError(null),
  publish:async(revision:number)=>{const result=await studioRequest<Snapshot>('/publish',{method:'POST',json:{baseRevision:revision,confirmed:true}});accept(result);return result;},
 };
}
