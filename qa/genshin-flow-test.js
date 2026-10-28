/* Legacy filename/options retained. Local campus entry defaults; target is configurable and exact-origin checked. */
'use strict';
const path = require('node:path');
const {args,targetURL,matchesTarget,newSession,until,sleep,reportFailure} = require('./lib.js');
(async () => {
  const options = args();
  if (options.help) { console.log("node qa/genshin-flow-test.js [--url URL] [--target URL] [--mode skip|flow|both] [--outdir DIR]"); return; }
  const base = targetURL(options.url || 'http://127.0.0.1:8081/',options['allow-public']);
  const target = targetURL(options.target || 'http://127.0.0.1:5174/',options['allow-public']);
  const mode = options.mode || 'both';
  if (!['skip','flow','both'].includes(mode)) throw new Error('Invalid --mode; expected skip|flow|both.');
  const results = {ok:false,url:base,target,errors:[],checks:[]};
  for (const current of mode === 'both' ? ['skip','flow'] : [mode]) {
    const s = await newSession({port:options.port,size:options.size || '1440x900',allowPublic:options['allow-public']});
    const began = Date.now();
    const details = {};
    try {
      const url = new URL(base);
      if (current === 'skip') url.searchParams.set('skip','1');
      await s.navigate(url.href);
      if (current === 'flow') {
        const start = options['start-selector'] || '[data-testid="campus-start"]';
        const door = options['door-selector'] || '[data-testid="campus-enter"]';
        const visible = selector => '(() => {const e=document.querySelector(' + JSON.stringify(selector) + ');return !!e && !e.disabled && e.getBoundingClientRect().width>0 && getComputedStyle(e).visibility!=="hidden";})()';
        await until(() => s.evaluate(visible(start)),30000,'Start button');
        if (options.outdir) await s.screenshot(path.join(options.outdir,'genshin-1-login.png'));
        await s.click(start);
        await until(() => s.evaluate(visible(door)),60000,'Arrival/entry button');
        if (!options['door-selector']) {
          details.arrivalPhase = await s.evaluate('document.querySelector("main[data-phase]")?.dataset.phase');
          if (details.arrivalPhase !== 'arrival') throw new Error('Flow reached a fallback instead of the arrival stage.');
        }
        if (options.outdir) await s.screenshot(path.join(options.outdir,'genshin-2-door.png'));
        await s.click(door);
      }
      await until(async () => { details.landed = await s.evaluate('location.href'); return matchesTarget(details.landed,target); },20000,'Exact destination');
      await until(() => s.evaluate('document.readyState === "complete"'),15000,'Destination load');
      await sleep(500);
      if (options.outdir && current === 'flow') await s.screenshot(path.join(options.outdir,'genshin-3-after.png'));
      if (s.errors.length) throw new Error('Browser errors: ' + JSON.stringify(s.errors));
      details.redirected = true; details.elapsedMs = Date.now()-began; details.events = s.nav;
      results[current] = details;
      results.checks.push({name:current,pass:true});
    } catch (error) {
      results[current] = {...details,redirected:false,error:String(error.message)};
      results.checks.push({name:current,pass:false});
      results.errors.push(String(error.message),...s.errors);
    } finally { await s.close(); }
  }
  results.ok = results.checks.length > 0 && results.checks.every(c=>c.pass) && results.errors.length===0;
  console.log(JSON.stringify(results));
  if (!results.ok) process.exitCode=1;
})().catch(reportFailure);
