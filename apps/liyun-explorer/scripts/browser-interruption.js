(async()=>{
  if(document.hidden)return {status:'not measured: hidden'};
  const qa=()=>window.__LIYUN__;
  const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
  const player=()=>{const m=new DOMMatrix(getComputedStyle(document.querySelector('[data-testid=player-marker]')).transform);return {x:m.e,y:m.f};};
  qa().flushSync(()=>qa().discover('park'));
  const began=performance.now();while(performance.now()-began<300)await frame();
  const before=player(),eventBefore=qa().getEvent(),cameraBefore=qa().getCamera(),sampleTime=performance.now();
  qa().flushSync(()=>qa().discover('beihu'));
  const after=player(),cameraAtInterruption=qa().getCamera(),eventAfter=qa().getEvent();
  const switched=performance.now();while(performance.now()-switched<750)await frame();
  const cameraAfter=qa().getCamera(),saved=qa().getState();
  const pointerJump=Math.hypot(after.x-before.x,after.y-before.y),cameraDrift=Math.hypot(cameraAfter.x-cameraAtInterruption.x,cameraAfter.y-cameraAtInterruption.y);
  return {timestamp:new Date().toISOString(),method:'Live interruption of off-screen camera travel after 300ms',status:document.hidden?'interrupted':'measured',passed:!document.hidden&&pointerJump<12&&cameraDrift<12&&saved.discoveredIds.includes('park')&&saved.discoveredIds.includes('beihu'),pointerJump,cameraDrift,before,after,eventBefore,eventAfter,cameraBefore,cameraAtInterruption,sampleTime,discovered:saved.discoveredIds,progress:document.querySelector('.game-stage').dataset.progress};
})()
