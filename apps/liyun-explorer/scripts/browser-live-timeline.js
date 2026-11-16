(async()=>{
  const qa=()=>window.__LIYUN__;
  if(document.hidden)return {status:'not measured: page hidden'};
  const paper=document.querySelector('[data-testid=region-paper]');
  const light=document.querySelector('canvas[data-effect-layer=light]');
  if(!paper||!light?.__liyunLight)return {status:'not measured: effects not ready'};
  qa().flushSync(()=>{qa().setPreset('locked');qa().setSettings({showCinematic:false,reducedMotion:false});});
  const towerCovered=()=>Boolean(paper.querySelector('path[data-region-id=tower]'));
  if(!towerCovered())return {status:'not measured: tower not covered'};
  qa().flushSync(()=>qa().discover('tower'));
  if(!qa().getEvent())return {status:'not measured: tower check-in requires an eligible mock location'};
  const began=performance.now(),samples=[],thresholds=[0,650,1400,2400,3450];
  let ticks=0,aborted=false;
  await new Promise(resolve=>{
    const tick=now=>{
      if(document.hidden){aborted=true;resolve();return;}
      ticks++;
      const elapsed=now-began;
      if(elapsed>=thresholds[samples.length]){
        const c=qa().getCamera(),uv=qa().getState().playerUV;
        const target={x:c.x+uv.u*4000*c.scale,y:c.y+uv.v*4958*c.scale};
        const m=new DOMMatrix(getComputedStyle(document.querySelector('[data-testid=player-marker]')).transform);
        const burn=paper.querySelector('canvas[data-region-id=tower]');
        samples.push({elapsedMs:Math.round(elapsed),playerDistanceToTarget:Math.round(Math.hypot(m.e-target.x,m.f-target.y)*100)/100,
          paperCovered:towerCovered(),paperProgress:burn?Number(burn.dataset.paperProgress):null,lightFrames:light.__liyunLight.frameCount,animationActive:Boolean(document.querySelector('.is-newly-found'))});
      }
      if(samples.length===thresholds.length)resolve();else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    setTimeout(()=>{if(samples.length<thresholds.length){aborted=true;resolve();}},5000);
  });
  const passed=!aborted&&samples.length===5&&samples[0].playerDistanceToTarget>50&&samples.at(-1).playerDistanceToTarget<1&&samples[0].paperCovered&&
    samples.some(x=>x.paperProgress>0&&x.paperProgress<1)&&!samples.at(-1).paperCovered&&samples.at(-1).paperProgress===null&&!samples.at(-1).animationActive;
  return {timestamp:new Date().toISOString(),status:aborted?'interrupted':'measured',passed,method:'Live requestAnimationFrame sampling during an unfrozen discovery, visible desktop Chrome',ticks,samples,progress:document.querySelector('.game-stage').dataset.progress};
})()
