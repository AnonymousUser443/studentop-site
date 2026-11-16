/* 听潮: lazy native window host. Audio belongs to the desktop, not its views. */
(function(){
 'use strict';
 var modulePromise, musicModule, runtime, current, surfaceHandles=[],listeners=[],surfacesReady=false;
 var themeMode='auto';try{var saved=localStorage.getItem('aiden.music.theme');if(['auto','light','dark'].indexOf(saved)!==-1)themeMode=saved;}catch(_){}
 function publish(){listeners.slice().forEach(function(fn){fn();});if(runtime)paintSurfaces();}
 var host={
  theme:function(){return themeMode==='auto'?Win.effectiveTheme():themeMode;},themeMode:function(){return themeMode;},
  setThemeMode:function(mode){if(['auto','light','dark'].indexOf(mode)===-1)return;themeMode=mode;try{localStorage.setItem('aiden.music.theme',mode);}catch(_){}publish();},
  isLocked:function(){return Win.isLocked();},reducedMotion:function(){return Win.reduceMotion();},openMain:function(){if(!Win.isLocked())WM.launch('tingchao');},
  setTitle:function(title){if(current&&current.win.state!=='closed')current.ctx.setTitle(title);},
  notify:function(message){Win.notify({icon:'tingchao',title:'听潮',body:message});},onStateChange:function(callback){listeners.push(callback);return function(){listeners=listeners.filter(function(fn){return fn!==callback;});};}
 };
 function load(){
  if(!modulePromise){
   var fonts=document.createElement('link');fonts.rel='stylesheet';fonts.href='/assets/css/music-fonts.css';document.head.appendChild(fonts);
   var css=document.createElement('link');css.rel='stylesheet';css.href='/assets/css/music/tingchao.css';document.head.appendChild(css);
   modulePromise=import('/assets/js/music/entry.js').then(function(mod){musicModule=mod;runtime=mod.ensureMusicRuntime().runtime;ensureSurfaces();return mod;}).catch(function(error){modulePromise=null;css.remove();fonts.remove();throw error;});
  }return modulePromise;
 }
 function ensureSurfaces(){
  if(surfacesReady)return;surfacesReady=true;
  var mini=document.createElement('div');mini.id='musicDesktopSurface';mini.className='music-desktop-surface';document.getElementById('desktop').appendChild(mini);
  var lock=document.createElement('div');lock.id='lockMusicControls';lock.className='lock-music-controls';lock.dataset.musicControls='true';document.getElementById('gateClockView').appendChild(lock);
  var tray=document.createElement('div');tray.id='musicTray';tray.className='music-tray';document.getElementById('wallpaperTray').before(tray);
  surfaceHandles.push(musicModule.mountMusicSurface(mini,host,'mini'),musicModule.mountMusicSurface(lock,host,'lock'),musicModule.mountMusicSurface(tray,host,'tray'));
  runtime.subscribe(paintSurfaces);paintSurfaces();
 }
 function paintSurfaces(){
  if(!runtime)return;var state=runtime.getSnapshot(),has=!!state.currentTrack;
  var miniVisible=has&&!Win.isLocked()&&!(current&&current.win.state!=='min'&&current.win.state!=='closed');
  var mini=document.getElementById('musicDesktopSurface');if(mini)mini.hidden=!miniVisible;
  var lock=document.getElementById('lockMusicControls');if(lock)lock.hidden=!has;
  var tray=document.getElementById('musicTray');if(tray)tray.hidden=!has;
  var visible=[miniVisible,has&&Win.isLocked(),has&&!Win.isLocked()];surfaceHandles.forEach(function(handle,index){handle.setVisibility(visible[index]&&!document.hidden);});
 }
 var defs=window.__APP_DEFS=window.__APP_DEFS||[];
 defs.push({id:'tingchao',title:'听潮 · AidenOS Music',desktopLabel:'听潮',icon:'tingchao',single:true,width:1220,height:780,minWidth:720,minHeight:480,
  keywords:'听潮 音乐 网易云 music netease 播放 歌单 歌词',
  render:function(body,ctx){
   body.classList.add('tingchao-host');body.innerHTML='<div class="music-loading" role="status"><span>听潮</span><p>正在打开音乐世界…</p></div>';
   var disposed=false,handle,record={win:ctx.win,ctx:ctx};current=record;
   function visibility(){if(handle)handle.setVisibility(!Win.isLocked()&&!document.hidden&&ctx.win.state!=='min'&&ctx.win.state!=='closed');paintSurfaces();}
   var off=Win.bus.on('wm:change',visibility);document.addEventListener('visibilitychange',visibility);
   load().then(function(mod){if(disposed)return;body.replaceChildren();handle=mod.mountMusicApp(body,host);visibility();}).catch(function(){if(disposed)return;body.innerHTML='<div class="music-loading"><span>暂时没有接上潮声</span><p>音乐模块加载失败，请关闭窗口后重试。</p></div>';});
   ctx.win.dispose=function(){disposed=true;off();document.removeEventListener('visibilitychange',visibility);if(handle)handle.dispose();if(current===record)current=null;paintSurfaces();};
  }
 });
 function wire(){Win.bus.on('prefs',publish);Win.bus.on('unlock',function(){publish();if(runtime&&runtime.getSnapshot().currentTrack)void runtime.refreshLyrics();});Win.bus.on('lock:request-close-all',function(){if(current)WM.close(current.win);publish();});document.addEventListener('visibilitychange',publish);}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
 window.AidenMusic={load:load,open:function(){host.openMain();},getSnapshot:function(){return runtime?runtime.getSnapshot():null;}};
})();
