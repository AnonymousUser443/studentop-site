/* Legacy CLI preserved: --url/--out/--wait/--eval/--eval-file/--size/--port. */
'use strict';
const fs = require('node:fs');
const {args,targetURL,evaluation,newSession,sleep,reportFailure} = require('./lib.js');
(async () => {
  const options = args();
  if (options.help) { console.log("node qa/cdp.js [--url URL] [--eval-file FILE --require-checks] [--out PNG] [--size WxH]"); return; }
  const url = targetURL(options.url || 'http://127.0.0.1:8899/', options['allow-public']);
  const wait = Number(options.wait ?? 1200);
  if (!Number.isFinite(wait) || wait < 0 || wait > 60000) throw new Error('Invalid --wait.');
  if (options.eval && options['eval-file']) throw new Error('Use only one of --eval and --eval-file.');
  const expression = options.eval || (options['eval-file'] ? fs.readFileSync(options['eval-file'], 'utf8') : '');
  const s = await newSession({port:options.port,size:options.size,allowPublic:options['allow-public']});
  let evalResult = null, assertions = 0;
  try {
    await s.navigate(url); await sleep(wait);
    if (expression) {
      const checked = evaluation(await s.evaluate(expression), !!options['require-checks']);
      evalResult = checked.value; assertions = checked.assertions;
    } else if (options['require-checks']) throw new Error('--require-checks needs --eval or --eval-file.');
    if (options.out) await s.screenshot(options.out);
    if (s.errors.length) throw new Error('Browser errors: ' + JSON.stringify(s.errors));
    console.log(JSON.stringify({ok:true,url,errors:s.errors,evalResult,assertions,out:options.out || null}));
  } catch (error) { reportFailure(error,{url,errors:s.errors,evalResult,assertions}); }
  finally { await s.close(); }
})().catch(reportFailure);
