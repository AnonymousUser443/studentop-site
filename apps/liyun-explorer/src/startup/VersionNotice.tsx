import { useEffect,useState } from 'react';
export default function VersionNotice(){
 const [available,setAvailable]=useState(false),[dismissed,setDismissed]=useState(false);
 useEffect(()=>{
  const current=document.querySelector<HTMLMetaElement>('meta[name=liyun-release]')?.content;
  if(!current||new URLSearchParams(location.search).has('contentPreview'))return;
  let alive=true,busy=false,found=false;
  const check=async()=>{
   if(document.hidden||busy||found||navigator.onLine===false)return;busy=true;
   try{const [release,content]=await Promise.all([fetch('/version.json',{cache:'no-store',signal:AbortSignal.timeout(8000)}).then(r=>r.ok?r.json():null),fetch('/api/content/published',{cache:'no-store',signal:AbortSignal.timeout(8000)}).then(r=>r.ok?r.json():null)]);
    const revision=content?.published?.revision;
    const changed=(release?.id&&release.id!==current)||(Number.isInteger(revision)&&revision!==window.__LIYUN_CONTENT__?.revision);
    if(alive&&changed){found=true;clearInterval(timer);setAvailable(true);}
   }catch{}finally{busy=false;}
  };
  // Navigation and startup already selected the latest release/publication. Check on
  // a normal interval or reconnection instead of immediately repeating both requests.
  const timer=setInterval(()=>void check(),60000);const visible=()=>{void check();};
  document.addEventListener('visibilitychange',visible);window.addEventListener('online',visible);
  return()=>{alive=false;clearInterval(timer);document.removeEventListener('visibilitychange',visible);window.removeEventListener('online',visible);};
 },[]);
 return available&&!dismissed?<aside className="version-notice" role="status" data-testid="version-notice"><span>新的校园篇章已抵达</span><button onClick={()=>location.reload()}>更新并展开</button><button onClick={()=>setDismissed(true)}>稍后</button></aside>:null;
}
