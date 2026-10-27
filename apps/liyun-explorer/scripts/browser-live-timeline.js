(async()=>{
  const qa=()=>window.__LIYUN__;
  if(document.hidden)return {status:'not measured: page hidden'};
  const fog=document.querySelector('canvas[data-effect-layer=fog]');
  const light=document.querySelector('canvas[data-effect-layer=light]');
  if(!fog?.__liyunP5||!light?.__liyunP5)return {status:'not measured: effects not ready'};
  qa().flushSync(()=>qa().discover('tower'));
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
        const density=fog.__liyunP5.pixelDensity();
        const pixel=fog.getContext('2d').getImageData(Math.max(0,Math.min(fog.width-1,Math.round(target.x*density))),Math.max(0,Math.min(fog.height-1,Math.round(target.y*density))),1,1).data;
        samples.push({elapsedMs:Math.round(elapsed),playerDistanceToTarget:Math.round(Math.hypot(m.e-target.x,m.f-target.y)*100)/100,fogAlphaAtTarget:pixel[3],fogFrames:fog.__liyunP5.frameCount,lightFrames:light.__liyunP5.frameCount,animationActive:Boolean(document.querySelector('.is-newly-found'))});
      }
      if(samples.length===thresholds.length)resolve();else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    setTimeout(()=>{if(samples.length<thresholds.length){aborted=true;resolve();}},5000);
  });
  const passed=!aborted&&samples.length===5&&samples[0].playerDistanceToTarget>50&&samples.at(-1).playerDistanceToTarget<1&&samples[0].fogAlphaAtTarget>samples.at(-1).fogAlphaAtTarget&&!samples.at(-1).animationActive;
  return {timestamp:new Date().toISOString(),status:aborted?'interrupted':'measured',passed,method:'Live requestAnimationFrame sampling during an unfrozen discovery, visible desktop Chrome',ticks,samples,progress:document.querySelector('.game-stage').dataset.progress};
})()
