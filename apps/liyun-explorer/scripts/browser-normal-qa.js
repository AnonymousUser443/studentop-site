(async () => {
  const commit=()=>new Promise(resolve=>{const c=new MessageChannel();c.port1.onmessage=()=>{c.port1.close();c.port2.close();resolve();};c.port2.postMessage(0);});
  const button=(root,text)=>[...root.querySelectorAll('button')].find(x=>x.textContent.includes(text));
  const media = {events:window.__mediaEvents, source:window.__testAudio?.[0]?.currentSrc, error:window.__testAudio?.[0]?.error?.code};
  button(document.querySelector('.utility-nav'),'设置').click();await commit();
  const volume=document.querySelector('#music-volume');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(volume,'0.15');
  volume.dispatchEvent(new Event('input',{bubbles:true}));volume.dispatchEvent(new Event('change',{bubbles:true}));await commit();
  const music=document.querySelector('[role=switch][aria-label="校园配乐"]');
  if(music.getAttribute('aria-checked')==='true')music.click();await commit();
  const quality=document.querySelector('#scene-quality');quality.value='low';quality.dispatchEvent(new Event('change',{bubbles:true}));await commit();
  document.querySelector('.modal-close').click();await commit();
  document.querySelector('[data-testid=poi-tower]').click();await commit();
  button(document.querySelector('[role=dialog]'),'前往探索').click();await commit();
  const saved=JSON.parse(localStorage.getItem('liyun.exploration.v1'));
  const receipt={timestamp:new Date().toISOString(),media,entered:document.querySelector('.game-stage').dataset.entered,progress:document.querySelector('.game-stage').dataset.progress,animationActive:Boolean(document.querySelector('.is-newly-found')),saved};
  localStorage.setItem('liyun.qa.reload-receipt',JSON.stringify(receipt));
  return receipt;
})()
