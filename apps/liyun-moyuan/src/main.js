import './style.css';
import * as THREE from 'three';
import { createRenderer,createMaterials,applySurfaceShaders } from './render.js';
import { buildRoom } from './room.js';
import { buildDecor } from './decor.js';

const $=selector=>document.querySelector(selector);
const views={
  overview:{n:'01',name:'全景模型',description:'一间屋子的记忆，<br>也可以捧在手心。',eye:[12.5,11.8,17],target:[0,.8,0],fov:47},
  interior:{n:'02',name:'入室 · 一室风雅',description:'木格筛光，茶器无声。<br>从一扇月洞，重访熟悉的相聚。',eye:[3.75,2.55,5.55],target:[-.5,1.35,-4.6],fov:59},
  tea:{n:'03',name:'月洞 · 茶香与留白',description:'一轮木月，半室茶香。<br>把日常收进博古架的格子里。',eye:[.65,1.9,-1.2],target:[0,1.55,-6],fov:58},
  desk:{n:'04',name:'书案 · 笔墨有归处',description:'纸上有山水，窗边有微光。<br>留一张书案，等下一次相聚。',eye:[-1.15,1.75,2.6],target:[-3.2,1.15,-.6],fov:57},
  stage:{n:'05',name:'讲堂 · 紫幕待启',description:'幕未开，故事已在。<br>每一张椅子，都记得来过的人。',eye:[-3.7,2.1,-4.1],target:[.4,1.5,6.7],fov:62}
};
try{
  await Promise.all([document.fonts.load('35px MoyuanSerif'),document.fonts.load('14px MoyuanSans')]);
  const engine=createRenderer($('#scene'));const M=createMaterials();
  const room=buildRoom(M),decor=buildDecor(M);engine.scene.add(room.group,decor.group);applySurfaceShaders(room.group);applySurfaceShaders(decor.group);
  // Photos face opposite ends: windows are on the right when facing the tea wall.
  room.group.scale.x=-1;decor.group.scale.x=-1;
  const mirroredTextures=new Set();
  decor.group.traverse(object=>{for(const material of object.material?(Array.isArray(object.material)?object.material:[object.material]):[]){if(material.map&&!mirroredTextures.has(material.map)){mirroredTextures.add(material.map);material.map.repeat.x=-1;material.map.offset.x=1;material.map.needsUpdate=true;}}});
  for(const view of Object.values(views)){view.eye[0]*=-1;view.target[0]*=-1;}
  const plinth=new THREE.Mesh(new THREE.BoxGeometry(9.9,.28,14.7),new THREE.MeshStandardMaterial({color:'#233c34',roughness:.7}));plinth.position.y=-.22;plinth.receiveShadow=true;engine.scene.add(plinth);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.MeshStandardMaterial({color:'#273c34',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.38;ground.receiveShadow=true;engine.scene.add(ground);
  const cutaway=[...(room.cutaway||[]),...(decor.cutaway||[])];
  let currentView='interior',transition=null,autoTour=false,night=false,detail=true,frame=0,active=true,fatal=false,disposed=false;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function selectView(id,immediate=false){const view=views[id];if(!view)return;currentView=id;
    cutaway.forEach(object=>object.visible=id!=='overview');
    engine.renderer.shadowMap.needsUpdate=true;
    engine.scene.fog.density=id==='overview'?.003:.008;
    engine.controls.autoRotate=false;autoTour=false;$('#tour-toggle').setAttribute('aria-pressed','false');
    const target=new THREE.Vector3(...view.target),eye=new THREE.Vector3(...view.eye);
    if(immediate||reducedMotion){engine.camera.position.copy(eye);engine.controls.target.copy(target);engine.camera.fov=view.fov;engine.camera.updateProjectionMatrix();}
    else transition={start:performance.now(),eye0:engine.camera.position.clone(),target0:engine.controls.target.clone(),fov0:engine.camera.fov,eye,target,fov:view.fov};
    $('#view-number').textContent=view.n;$('#view-name').textContent=view.name;$('#view-description').innerHTML=view.description;
    document.querySelectorAll('button[data-view]').forEach(button=>{const selected=button.dataset.view===id;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));});
    $('#scene').dataset.view=id;
  }
  selectView('interior',true);
  engine.controls.addEventListener('start',()=>{transition=null;});
  document.querySelectorAll('button[data-view]').forEach(button=>button.addEventListener('click',()=>selectView(button.dataset.view)));
  $('#light-toggle').addEventListener('click',()=>{night=!night;engine.setNight(night?1:0);$('#light-toggle').setAttribute('aria-pressed',String(night));$('#light-toggle span').textContent=night?'夜读':'日光';});
  $('#tour-toggle').addEventListener('click',()=>{autoTour=!autoTour;transition=null;engine.controls.autoRotate=autoTour;engine.controls.autoRotateSpeed=.25;$('#tour-toggle').setAttribute('aria-pressed',String(autoTour));});
  $('#detail-toggle').addEventListener('click',()=>{detail=!detail;engine.setDetail(detail);$('#detail-toggle').setAttribute('aria-pressed',String(detail));$('#detail-toggle span').textContent=detail?'精细':'清晰';});
  $('#fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();}catch{ $('#fullscreen').title='当前浏览器不支持全屏'; }});
  function about(open){$('#about-panel').hidden=!open;$('#about-toggle').setAttribute('aria-expanded',String(open));if(open)$('#about-close').focus();else $('#about-toggle').focus();}
  $('#about-toggle').addEventListener('click',()=>about($('#about-panel').hidden));$('#about-close').addEventListener('click',()=>about(false));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('#about-panel').hidden)about(false);});
  $('#home-link').href=['localhost','127.0.0.1','[::1]'].includes(location.hostname)?'http://127.0.0.1:8899/':'/';
  const objectCount=room.stats.voxelBlocks+decor.stats.voxelInstances;
  $('#scene-stats').textContent='细体素场景 · '+objectCount.toLocaleString()+' 个结构与陈设单元 · 六幅照片参考';
  const started=performance.now();
  function animate(now){if(!active)return;frame=requestAnimationFrame(animate);
    if(transition){const t=Math.min(1,(now-transition.start)/1500),s=t*t*(3-2*t);engine.camera.position.lerpVectors(transition.eye0,transition.eye,s);engine.controls.target.lerpVectors(transition.target0,transition.target,s);engine.camera.fov=THREE.MathUtils.lerp(transition.fov0,transition.fov,s);engine.camera.updateProjectionMatrix();if(t===1)transition=null;}
    engine.render(reducedMotion?0:(now-started)/1000);
  }
  animate(started);
  $('#loading').classList.add('is-ready');setTimeout(()=>$('#loading').hidden=true,900);
  $('#scene canvas').addEventListener('webglcontextlost',event=>{event.preventDefault();fatal=true;$('#error-text').textContent='图形上下文已中断，请重新进入以恢复场景。';$('#error').hidden=false;active=false;cancelAnimationFrame(frame);});
  document.addEventListener('visibilitychange',()=>{active=!document.hidden&&!fatal&&!disposed;cancelAnimationFrame(frame);if(active)animate(performance.now());});
  addEventListener('pagehide',event=>{active=false;cancelAnimationFrame(frame);if(!event.persisted){disposed=true;engine.dispose();} });
  addEventListener('pageshow',event=>{if(event.persisted&&!fatal&&!disposed){active=true;animate(performance.now());}});
  // Read-only QA observability: no scene controls, user input, or private data.
  window.__MOYUAN__={ready:true,referencePages:6,stats:{room:room.stats,decor:decor.stats},get view(){return currentView;},get night(){return night;},get detail(){return detail;},get draws(){return engine.renderer.info.render.calls;},get triangles(){return engine.renderer.info.render.triangles;}};
}catch(error){console.error(error);$('#loading').hidden=true;$('#error-text').textContent='请使用支持 WebGL 2 的现代浏览器，并开启硬件加速。'+(import.meta.env.DEV?' '+error.message:'');$('#error').hidden=false;}
