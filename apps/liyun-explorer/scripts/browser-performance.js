(async () => {
  const stage = document.querySelector('.game-stage');
  const samples = [];
  const wait = ms => new Promise(resolve => setTimeout(resolve,ms));
  for (const [width,height] of [[1920,1080],[844,390]]) {
    Object.assign(stage.style,{width:width+'px',height:height+'px'});
    await wait(150);
    if (document.hidden) { samples.push({width,height,status:'not measured: page hidden'}); break; }
    const layers = [...document.querySelectorAll('canvas')].map(canvas => ({name:canvas.dataset.effectLayer,p:canvas.__liyunP5}));
    if (layers.some(x => !x.p)) { samples.push({width,height,status:'not measured: effects not ready'}); break; }
    const before = layers.map(x=>x.p.frameCount);
    let ticks=0, elapsed=0, aborted=false;
    const began=performance.now();
    await new Promise(resolve => {
      const tick = now => {
        elapsed=now-began;
        if(document.hidden){aborted=true;resolve();return;}
        ticks++;
        if(elapsed>=2200)resolve(); else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      setTimeout(()=>{if(elapsed<2200){aborted=true;resolve();}},4000);
    });
    samples.push({width,height,status:aborted?'interrupted':'measured',durationMs:Math.round(elapsed),animationFrameFps:Number((ticks*1000/elapsed).toFixed(1)),effects:layers.map((x,i)=>({name:x.name,fps:Number(((x.p.frameCount-before[i])*1000/elapsed).toFixed(1)),density:x.p.pixelDensity()}))});
  }
  stage.style.removeProperty('width');stage.style.removeProperty('height');
  return {timestamp:new Date().toISOString(),method:'Visible desktop Chrome; canvas resized to target dimensions. Not physical mobile hardware.',devicePixelRatio,samples};
})()
