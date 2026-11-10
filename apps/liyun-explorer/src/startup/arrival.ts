export function arrival(){
 const node=document.getElementById('arrival')!;
 const status=node.querySelector<HTMLElement>('[data-load-status]')!,number=node.querySelector<HTMLElement>('[data-load-number]')!,bar=node.querySelector<HTMLProgressElement>('progress')!;
 const began=performance.now();let failed=false;let skipped=matchMedia('(prefers-reduced-motion:reduce)').matches;
 const skip=node.querySelector<HTMLButtonElement>('[data-load-skip]')!;
 skip.onclick=()=>{skipped=true;node.classList.add('arrival-still');skip.hidden=true;};
 return {
  progress(fraction:number,label:string){if(failed)return;const value=Math.max(bar.value,Math.min(98,Math.round(fraction*98)));bar.value=value;number.textContent=String(value).padStart(2,'0');status.textContent=label;node.style.setProperty('--load',String(fraction));},
  async finish(warm=false){bar.value=100;number.textContent='100';status.textContent='一纸山水，邀你入境';node.classList.add('arrival-ready');const qa=new URLSearchParams(location.search).get('qa')==='1';await new Promise(r=>setTimeout(r,qa||skipped?0:Math.max(0,(new URLSearchParams(location.search).has('arrival-demo')?8000:warm?150:1800)-(performance.now()-began))));node.classList.add('arrival-leave');await new Promise(r=>setTimeout(r,qa||skipped?0:900));node.remove();},
  error(error:unknown){failed=true;status.textContent=error instanceof Error?error.message:'暂时无法展开校园地图';const retry=node.querySelector<HTMLButtonElement>('[data-load-retry]')!;retry.hidden=false;retry.onclick=()=>location.reload();skip.hidden=true;node.classList.add('arrival-still');}
 };
}
