(async()=>{
  const qa=()=>window.__LIYUN__;
  const results=[];
  const check=(name,passed,detail)=>{results.push({name,passed:Boolean(passed),detail});if(!passed)throw new Error(name);};
  const commit=()=>new Promise(resolve=>{const c=new MessageChannel();c.port1.onmessage=()=>{c.port1.close();c.port2.close();resolve();};c.port2.postMessage(0);});
  const button=(root,text)=>[...root.querySelectorAll('button')].find(x=>x.textContent.includes(text));
  const act=fn=>qa().flushSync(fn);
  act(()=>qa().setPreset('fog'));
  act(()=>qa().showPanel('settings'));
  act(()=>document.querySelector('[role=switch][aria-label="减少动态效果"]').click());
  for(const track of [1,2,0]){
    const select=document.querySelector('#music-track');select.value=String(track);
    act(()=>select.dispatchEvent(new Event('change',{bubbles:true})));await commit();
    check('Track selection '+track,qa().getState().settings.track===track);
  }
  const all=[...document.querySelectorAll('[role=dialog] button,[role=dialog] input,[role=dialog] select')].filter(x=>!x.disabled);
  all.at(-1).focus();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
  check('Keyboard focus wraps forward',document.activeElement===all[0]);
  all[0].focus();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));
  check('Keyboard focus wraps backward',document.activeElement===all.at(-1));
  act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
  check('Escape closes modal',!document.querySelector('[role=dialog]'));
  const {LANDMARKS}=await import('/src/data.ts');
  for(const item of LANDMARKS)act(()=>qa().discover(item.id));
  check('Continuous discovery covers all first-version landmarks',qa().getState().discoveredIds.length===8&&document.querySelector('.game-stage').dataset.progress==='45',qa().getState().discoveredIds);
  const before=JSON.stringify(qa().getState());
  for(const item of LANDMARKS)act(()=>qa().discover(item.id));
  check('Repeated complete route is idempotent',before===JSON.stringify(qa().getState()));
  const park=LANDMARKS.find(x=>x.id==='park'),camera=qa().getCamera();
  const point={x:camera.x+park.uv.u*4000*camera.scale,y:camera.y+park.uv.v*4958*camera.scale};
  check('Off-screen target is brought into the safe view',point.x>innerWidth*.25&&point.x<innerWidth*.88&&point.y>innerHeight*.2&&point.y<innerHeight*.78,point);
  act(()=>qa().showPanel('collection'));
  check('Collection reflects all eight discoveries',document.querySelectorAll('.collection-item.is-known').length===8);
  act(()=>qa().showPanel('settings'));
  act(()=>button(document.querySelector('[role=dialog]'),'重置探索进度').click());
  act(()=>button(document.querySelector('[role=dialog]'),'确认重新出发').click());
  check('Confirmed reset returns to 3 percent and preserves settings',qa().getState().discoveredIds.length===1&&qa().getState().settings.reducedMotion&&document.querySelector('.game-stage').dataset.progress==='3');
  const stage=document.querySelector('.game-stage');
  stage.requestFullscreen=undefined;
  act(()=>document.querySelector('.fullscreen-control').click());
  check('Unsupported fullscreen keeps a usable landscape scene',document.querySelector('.game-toast')?.textContent.includes('当前浏览器不支持全屏')&&document.querySelector('[data-testid=poi-wencui]').disabled===false);
  delete stage.requestFullscreen;
  act(()=>qa().showPanel('settings'));
  window.__settingsScrollResult={};
  const observer=new ResizeObserver(()=>{
    if(innerWidth!==844||innerHeight!==390)return;
    const body=document.querySelector('.modal-body');if(!body)return;
    body.scrollTop=body.scrollHeight;
    const actions=document.querySelector('.settings-actions').getBoundingClientRect(),boundary=body.getBoundingClientRect();
    const touchActions=[];for(let el=body;el;el=el.parentElement)touchActions.push({className:el.className,touchAction:getComputedStyle(el).touchAction});
    window.__settingsScrollResult={width:innerWidth,height:innerHeight,scrollHeight:body.scrollHeight,clientHeight:body.clientHeight,scrollTop:body.scrollTop,actionsReachable:actions.bottom<=boundary.bottom+1&&actions.top>=boundary.top-1,nativeTouchScrollAllowed:touchActions.every(x=>x.touchAction!=='none'),touchActions};
  });observer.observe(stage);
  window.__stopSettingsScroll=()=>observer.disconnect();
  return {timestamp:new Date().toISOString(),results};
})()
