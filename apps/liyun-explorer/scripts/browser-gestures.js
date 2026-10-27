(async () => {
  const api=()=>window.__LIYUN__;
  // Pointer moves use React's continuous-event lane. Yield to the scheduler and
  // observe the committed camera, rather than assuming outer flushSync changes
  // the event's priority. MessageChannel also works in a hidden browser tab.
  const commit=()=>new Promise(resolve=>{
    const channel=new MessageChannel();
    channel.port1.onmessage=()=>{channel.port1.close();channel.port2.close();resolve();};
    channel.port2.postMessage(0);
  });
  const waitFor=async(predicate,label)=>{
    const deadline=performance.now()+2000;
    while(!predicate()){
      if(performance.now()>deadline)throw new Error('Camera commit not observed: '+label);
      await commit();
    }
    await commit();
  };
  const root=document.querySelector('[data-testid=map-scene]');
  const pointer=(type,id,x,y)=>root.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',isPrimary:id===11,clientX:x,clientY:y,button:type==='pointermove'?-1:0,buttons:type==='pointerup'||type==='pointercancel'?0:1,width:1,height:1,pressure:type==='pointerup'||type==='pointercancel'?0:.5,bubbles:true,cancelable:true,composed:true}));
  const near=(a,b)=>Math.abs(a-b)<1e-8;
  const method='Synthetic touch PointerEvents through React handlers, awaiting actual camera commits; not physical multitouch hardware';
  const scenarios=[];
  let activeScenario='stepped';
  let result;
  try{
    // Clear only the pointer IDs owned by this repeatable QA script.
    pointer('pointercancel',11,500,300);pointer('pointercancel',12,700,300);
    api().flushSync(()=>{api().reset();api().setPreset('fog');});await commit();
    const before=api().getCamera(),uv={u:(600-before.x)/(4000*before.scale),v:(300-before.y)/(4958*before.scale)};
    pointer('pointerdown',11,500,300);await commit();
    pointer('pointerdown',12,700,300);await commit();
    pointer('pointermove',11,450,300);
    await waitFor(()=>near(api().getCamera().scale,before.scale*1.25),'first pinch movement');
    pointer('pointermove',12,750,300);
    await waitFor(()=>near(api().getCamera().scale,before.scale*1.5),'second pinch movement');
    const pinched=api().getCamera();
    const anchor={u:(600-pinched.x)/(4000*pinched.scale),v:(300-pinched.y)/(4958*pinched.scale)};
    pointer('pointerup',12,750,300);await commit();
    pointer('pointermove',11,470,320);
    await waitFor(()=>near(api().getCamera().x,pinched.x+20)&&near(api().getCamera().y,pinched.y+20),'one-finger continuation');
    const oneFinger=api().getCamera();pointer('pointerup',11,470,320);await commit();
    document.querySelector('[data-testid=poi-wencui]').click();await commit();
    const stepped={name:'stepped',pinchRatio:pinched.scale/before.scale,anchorError:Math.hypot(anchor.u-uv.u,anchor.v-uv.v),continuedDrag:{x:oneFinger.x-pinched.x,y:oneFinger.y-pinched.y},noAccidentalSelection:!document.querySelector('[role=dialog]')};
    stepped.passed=near(stepped.pinchRatio,1.5)&&stepped.anchorError<1e-8&&near(stepped.continuedDrag.x,20)&&near(stepped.continuedDrag.y,20)&&stepped.noAccidentalSelection;
    scenarios.push(stepped);

    activeScenario='rapid-transition';
    api().flushSync(()=>{api().reset();api().setPreset('fog');});await commit();
    const rapidBefore=api().getCamera();
    const rapidUV={u:(600-rapidBefore.x)/(4000*rapidBefore.scale),v:(300-rapidBefore.y)/(4958*rapidBefore.scale)};
    pointer('pointerdown',11,500,300);await commit();
    pointer('pointerdown',12,700,300);await commit();
    pointer('pointermove',11,450,300);
    await waitFor(()=>near(api().getCamera().scale,rapidBefore.scale*1.25),'rapid scenario first movement');
    const expectedScale=rapidBefore.scale*1.5;
    const expectedPinch={x:600-rapidUV.u*4000*expectedScale,y:300-rapidUV.v*4958*expectedScale};
    // Do not yield between these events: the last continuous move has not yet
    // committed when pointerup establishes the one-finger gesture's new base.
    pointer('pointermove',12,750,300);
    pointer('pointerup',12,750,300);
    pointer('pointermove',11,470,320);
    await waitFor(()=>near(api().getCamera().scale,expectedScale)&&near(api().getCamera().x,expectedPinch.x+20)&&near(api().getCamera().y,expectedPinch.y+20),'rapid pinch/up/drag final camera');
    const rapidFinal=api().getCamera();
    const continuedAnchor={u:(620-rapidFinal.x)/(4000*rapidFinal.scale),v:(320-rapidFinal.y)/(4958*rapidFinal.scale)};
    pointer('pointerup',11,470,320);await commit();
    document.querySelector('[data-testid=poi-wencui]').click();await commit();
    const rapid={name:'rapid-transition',sameTaskEvents:['last pinch move','second pointer up','remaining pointer move'],pinchRatio:rapidFinal.scale/rapidBefore.scale,anchorError:Math.hypot(continuedAnchor.u-rapidUV.u,continuedAnchor.v-rapidUV.v),continuedDrag:{x:rapidFinal.x-expectedPinch.x,y:rapidFinal.y-expectedPinch.y},noAccidentalSelection:!document.querySelector('[role=dialog]')};
    rapid.passed=near(rapid.pinchRatio,1.5)&&rapid.anchorError<1e-8&&near(rapid.continuedDrag.x,20)&&near(rapid.continuedDrag.y,20)&&rapid.noAccidentalSelection;
    scenarios.push(rapid);
    result={method,status:'measured',visibility:document.visibilityState,scenarios,passed:scenarios.every(x=>x.passed)};
  }catch(error){
    result={method,status:'not verified',passed:false,visibility:document.visibilityState,scenarios,failedScenario:activeScenario,error:String(error),camera:api().getCamera()};
  }finally{
    pointer('pointercancel',11,470,320);pointer('pointercancel',12,750,300);
    api().flushSync(()=>api().reset());await commit();
  }
  return result;
})()
