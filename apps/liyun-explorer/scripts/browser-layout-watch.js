(() => {
  const api=()=>window.__LIYUN__;
  window.__layoutResults={timestamp:new Date().toISOString(),beforePortrait:api().getCamera(),sizes:{},portrait:null};
  const capture=()=>{
    const w=innerWidth,h=innerHeight,key=w+'x'+h;
    const boxes=[...document.querySelectorAll('.game-hud button')].map(el=>({name:el.getAttribute('aria-label')||el.textContent.trim(),rect:el.getBoundingClientRect().toJSON()})).filter(x=>x.rect.width>0&&x.rect.height>0);
    const smallTargets=boxes.filter(x=>x.rect.width<43.9||x.rect.height<43.9).map(x=>({name:x.name,width:x.rect.width,height:x.rect.height}));
    const clipped=boxes.filter(x=>x.rect.left<-.1||x.rect.top<-.1||x.rect.right>w+.1||x.rect.bottom>h+.1).map(x=>x.name);
    const overlaps=[];
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
      const a=boxes[i].rect,b=boxes[j].rect;
      if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)overlaps.push([boxes[i].name,boxes[j].name]);
    }
    if(w>h)window.__layoutResults.sizes[key]={width:w,height:h,buttonCount:boxes.length,smallTargets,clipped,overlaps};
    const gate=document.querySelector('.orientation-gate');
    if(gate&&w<=h)window.__layoutResults.portrait={width:w,height:h,gate:gate.getAttribute('aria-label'),message:gate.textContent,hudInert:document.querySelector('.hud-layer').inert,mapDisabled:[...document.querySelectorAll('.map-marker')].every(x=>x.disabled),effectsPaused:[...document.querySelectorAll('canvas')].every(x=>x.__liyunP5&&!x.__liyunP5.isLooping())};
  };
  const resize=new ResizeObserver(capture);resize.observe(document.querySelector('.game-stage'));
  const mutations=new MutationObserver(capture);mutations.observe(document.querySelector('.game-stage'),{subtree:true,childList:true,attributes:true,attributeFilter:['inert','disabled']});
  window.__stopLayout=()=>{resize.disconnect();mutations.disconnect();};capture();
  return {watching:true,beforePortrait:window.__layoutResults.beforePortrait};
})()
