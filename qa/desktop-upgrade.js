/* Evaluate in a NEW isolated local desktop session with ?skipLock=1.
   Synthetic DOM/API regression, not evidence of physical mouse/touch/drag performance. */
(async () => {
  if (!['127.0.0.1','localhost'].includes(location.hostname)) throw new Error('Desktop upgrade QA is local-only.');
  const checks=[];
  const check=(name,pass,detail)=>{ checks.push({name,pass:pass===true,detail}); if(pass!==true) throw new Error(JSON.stringify({checks})); };
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const q=selector=>{const el=document.querySelector(selector);if(!el)throw new Error('Missing: '+selector);return el;};
  const key=(el,name,extra={})=>el.dispatchEvent(new KeyboardEvent('keydown',{key:name,bubbles:true,cancelable:true,...extra}));
  check('public_APIs', !!(window.Win?.safeUrl && window.WM?.snapRect && window.Shell?.selectedApps));
  const prefs={...Win.prefs};
  const saved=Win.store.get('notepad.document',null);
  const confirmOriginal=window.confirm;
  try {
    check('unsafe_URL_blocked',Win.safeUrl('javascript:alert(1)')==='' && Win.safeUrl('http://u:p@localhost/')==='');
    check('local_project_destinations',Win.resolveProjectUrl('liyun-explorer','https://invalid.example/').startsWith('http://127.0.0.1:5174/') && Win.resolveProjectUrl('genshin-start','https://invalid.example/')==='http://127.0.0.1:8081/');
    check('invalid_pref_blocked',!Win.validPref('motion','false') && !Win.validPref('themeMode','invalid'));
    const probe='qa.upgrade.'+Date.now();
    Win.store.set(probe,{value:42});
    check('store_roundtrip',Win.store.get(probe)?.value===42); Win.store.del(probe);
    check('store_delete',Win.store.get(probe,null)===null);
    Win.setPref('motion',false); Win.setPref('themeMode','dark');
    check('dark_and_motion_pref',document.documentElement.dataset.theme==='dark' && document.documentElement.dataset.motion==='off');
    check('prefs_stored',Win.store.get('prefs',{}).themeMode==='dark');
    WM.closeAll(); await sleep(350);
    q('#startBtn').click(); await sleep(250);
    check('start_open',!!document.querySelector('[data-flyout="start"]'));
    q('[data-start-all]').click(); await sleep(100);
    check('all_apps_keeps_accessible_menu',!!document.querySelector('[data-flyout="start"] button'));
    const search=q('#startSearchInput');search.value='记事本';search.dispatchEvent(new Event('input',{bubbles:true}));await sleep(100);
    key(search,'ArrowDown');key(document.activeElement,'Enter');await sleep(350);
    check('start_keyboard_launch',WM.isRunning('notepad')===true);
    key(document,'Escape'); await sleep(250);
    const note=WM.byApp('notepad')[0];
    const editor=note.el.querySelector('#npEditor');
    check('notepad_textarea',editor?.tagName==='TEXTAREA');
    const text='QA <img src=x onerror=alert(1)>\n保存与重开';
    editor.value=text;editor.dispatchEvent(new Event('input',{bubbles:true}));
    let prompted=false;window.confirm=()=>{prompted=true;return false;};
    WM.close(note);await sleep(100);
    check('unsaved_close_cancelled',prompted && note.el.isConnected && WM.isRunning('notepad'));
    note.el.querySelector('#npSave').click(); await sleep(100);
    check('notepad_persisted_text',Win.store.get('notepad.document',{}).text===text);
    check('text_not_HTML',note.el.querySelectorAll('.np-editor img').length===0 && editor.value===text);
    WM.close(note); await sleep(350); const reopened=WM.launch('notepad');await sleep(250);
    check('notepad_reopen',reopened.el.querySelector('#npEditor').value===text);
    check('eight_resize_handles',reopened.el.querySelectorAll('.rs-handle').length===8);
    WM.minimize(reopened);WM.restore(reopened);await sleep(450);
    check('rapid_min_restore',reopened.state!=='min' && getComputedStyle(reopened.el).display!=='none' && !reopened.el.classList.contains('is-minimizing'));
    if (innerWidth > 900) {
      for(const type of ['left','right','tl','tr','bl','br']) {
        const rect=WM.snapRect({type}); WM.snap(reopened,type);
        check('snap_'+type,Math.abs(reopened.rect.x-rect.x)<1 && Math.abs(reopened.rect.y-rect.y)<1 && Math.abs(reopened.rect.w-rect.w)<1 && Math.abs(reopened.rect.h-rect.h)<1);
      }
      WM.restoreLayout(reopened);
    }
    check('invalid_snap_rejected',WM.snapRect({type:'invalid'})===null);
    WM.toggleMaximize(reopened);WM.toggleMaximize(reopened);await sleep(300);
    check('maximize_toggle_consistent',reopened.state!=='min' && reopened.el.classList.contains('is-maximized')===(reopened.state==='max'));
    const about=WM.launch('about');await sleep(250);WM.minimize(about);await sleep(350);
    WM.showDesktop(); await sleep(350);
    check('show_desktop_minimizes_visible',WM.isDesktopShown() && WM.list().every(w=>w.state==='min'));
    WM.showDesktop();await sleep(350);
    check('show_desktop_preserves_prior_minimized',!WM.isDesktopShown() && reopened.state!=='min' && about.state==='min');
    q('#startBtn').focus();q('#startBtn').click();await sleep(200);key(document,'Escape');await sleep(300);
    check('escape_returns_start_focus',document.activeElement===q('#startBtn'));
    Win.notify({title:'QA notification',body:'local check'});
    check('unread_badge_visible',getComputedStyle(q('#notifDot')).display!=='none');
    q('#trayClock').click();await sleep(200);
    const month=q('.cal-month').textContent;
    q('[data-cal="next"]').click();check('calendar_next_month',q('.cal-month').textContent!==month);
    q('[data-cal="today"]').click();check('calendar_today',q('.cal-month').textContent===month && !!document.querySelector('.cal-day.is-today'));
    check('opening_calendar_marks_read',Win.notifications.every(n=>!n.unread));
    q('#clearAllNotifs').click();check('notifications_clear',Win.notifications.length===0 && !!document.querySelector('.notif-empty'));
    key(document,'Escape');await sleep(250);
    for(const win of WM.list().filter(w=>w.state!=='min')) {
      const r=win.el.getBoundingClientRect();check('window_in_viewport_'+win.appId,r.left>=-1 && r.top>=-1 && r.right<=innerWidth+1 && r.bottom<=innerHeight+1,{x:r.x,y:r.y,w:r.width,h:r.height});
    }
    check('no_horizontal_overflow',document.documentElement.scrollWidth<=innerWidth);
    return {ok:true,checks,total:checks.length,passed:checks.length,viewport:{width:innerWidth,height:innerHeight},input:'synthetic DOM/API'};
  } finally {
    window.confirm=()=>true;WM.closeAll();window.confirm=confirmOriginal;
    if(saved===null)Win.store.del('notepad.document');else Win.store.set('notepad.document',saved);
    for(const [name,value] of Object.entries(prefs))Win.setPref(name,value);
  }
})()
