/* Real double-click test. Legacy positional URL retained; default tests only the two local apps. */
'use strict';
const {args,targetURL,matchesTarget,newSession,until,sleep,reportFailure} = require('./lib.js');
(async () => {
  const options = args();
  if (options.help) { console.log("node qa/shortcut-test.js [URL] [--targets JSON] [--port 0]"); return; }
  const url = targetURL(options.url || options._[0] || 'http://127.0.0.1:8899/?skipLock=1', options['allow-public']);
  const expected = options.targets ? JSON.parse(options.targets) : {
    'liyun-explorer': 'http://127.0.0.1:5174/', 'genshin-start': 'http://127.0.0.1:8081/',
  };
  const entries = Object.entries(expected);
  if (!entries.length) throw new Error('No shortcut targets configured.');
  for (const [id,value] of entries) { if (!/^[a-z0-9-]+$/.test(id)) throw new Error('Invalid app id.'); targetURL(value,options['allow-public']); }
  const s = await newSession({port:options.port,size:options.size,allowPublic:options['allow-public']});
  const result = {url,opened:[],errors:s.errors,checks:[]};
  try {
    await s.navigate(url); await sleep(1200);
    // Preserve real window.open, but prevent an incorrect shortcut from touching an unapproved origin.
    await s.evaluate('(() => { const original=window.open; const targets=' + JSON.stringify(expected) + '; window.__QA_BLOCKED_OPENS__=[]; window.open=function(url,...rest){const u=new URL(url,location.href); if(!Object.values(targets).some(t=>{const x=new URL(t); return x.origin===u.origin && x.pathname===u.pathname;})){window.__QA_BLOCKED_OPENS__.push(u.href);return null;} return original.call(window,url,...rest);}; return true; })()');
    for (const [appId,target] of entries) {
      const before = new Set((await s.call('Target.getTargets')).targetInfos.map(t=>t.targetId));
      await s.click('.desktop-icon[data-app="' + appId + '"]', 2);
      let fresh = [];
      try {
        await until(async () => {
          fresh = (await s.call('Target.getTargets')).targetInfos.filter(t=>t.type==='page' && !before.has(t.targetId));
          if (fresh.length > 1) throw new Error('Duplicate tabs for ' + appId);
          const blocked = await s.evaluate('window.__QA_BLOCKED_OPENS__');
          if (blocked.length) throw new Error('Unexpected shortcut destination: ' + JSON.stringify(blocked));
          return fresh.length === 1 && matchesTarget(fresh[0].url,target);
        },10000,'Shortcut ' + appId);
        result.opened.push({appId,url:fresh[0].url});
        result.checks.push({name:appId,pass:true});
      } finally {
        for (const item of fresh) await s.call('Target.closeTarget',{targetId:item.targetId});
      }
    }
    if (s.errors.length || result.checks.length !== entries.length) throw new Error('Shortcut test incomplete or browser errors: ' + JSON.stringify(s.errors));
    console.log(JSON.stringify({...result,ok:true}));
  } catch (error) { reportFailure(error,result); }
  finally { await s.close(); }
})().catch(reportFailure);
