const {startFixture}=require('./fixture.cjs');const {newSession,until}=require('../lib.js');
(async()=>{const f=await startFixture(),s=await newSession();try{
 await s.call('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("aiden.desktop.bootSeen","1")'});await s.navigate(f.origin+'/');await until(()=>s.evaluate('lockScreen.dataset.gateStatus==="ready"'),5000,'ready');
 await s.evaluate('window.probe=[];["keydown","keypress","keyup","click"].forEach(t=>document.addEventListener(t,e=>probe.push({type:e.type,key:e.key,target:e.target.id,prevented:e.defaultPrevented}),true));gateLogin.focus();true');
 for(const type of ['keyDown','keyUp'])await s.call('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 const without=await s.evaluate('({phase:lockScreen.dataset.gatePhase,events:probe.slice()})');
 await s.evaluate('probe=[];true');await s.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});await s.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 console.log(JSON.stringify({withoutText:without,withText:await s.evaluate('({phase:lockScreen.dataset.gatePhase,events:probe.slice()})')},null,2));
 }finally{await s.close();await f.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
