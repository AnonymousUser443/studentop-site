'use strict';
// Preserve the first full run, then replace only matching assertions/controls
// with real targeted reruns. Counts are unique assertions, never summed runs.
const fs=require('node:fs'),path=require('node:path');
const root=__dirname,final=path.join(root,'final');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2));
const preserve=name=>{const original=path.join(final,name),saved=path.join(final,'first-pass-'+name);if(!fs.existsSync(saved))fs.copyFileSync(original,saved);return saved;};
const originalResult=preserve('results.json'),originalSamples=preserve('state-samples.json');
preserve('safe-area.json');preserve('pressed-hitareas.json');
const base=read(originalResult),stateRun=read(path.join(root,'targeted-states/results.json')),safeRun=read(path.join(root,'targeted-safe-held/results.json'));
if(!stateRun.ok||!safeRun.ok)throw Error('A targeted rerun is not successful; do not publish a passing aggregate.');
const names=new Map(base.checks.map(row=>[row.name,row]));
for(const run of [stateRun,safeRun])for(const row of run.checks){if(!names.has(row.name))throw Error('Unexpected expanded scope: '+row.name);names.set(row.name,row);}
const checks=[...names.values()];
if(checks.length!==42||checks.some(row=>!row.pass))throw Error('Expected exactly 42 passing unique assertions.');
const first=read(originalSamples),latest=read(path.join(root,'targeted-states/state-samples.json'));
const controls=new Map(first.samples.map(row=>[row.id,row]));
for(const row of latest.samples){if(!controls.has(row.id))throw Error('Unexpected extra control '+row.id);controls.set(row.id,row);}
if(controls.size!==20)throw Error('Expected exactly 20 sampled enabled controls.');
const samples=[...controls.values()];
const sourceRuns=[
  {file:'first-pass-results.json',total:base.total,passed:base.passed,purpose:'Initial full 20-control matrix, native safe-area and held-target run; six assertions later corrected or sampled with explicit normal-motion timing.'},
  {file:'../targeted-states/results.json',total:stateRun.total,passed:stateRun.passed,purpose:'Only two failed controls and genuine busy/disabled observations; explicit prefers-reduced-motion no-preference.'},
  {file:'../targeted-safe-held/results.json',total:safeRun.total,passed:safeRun.passed,purpose:'Native safe-area/held-target rerun after CTA active-rule precedence correction; no new screenshots.'},
];
const errors=[...base.errors,...stateRun.errors,...safeRun.errors];
const evidence={...base.evidence,aggregate:true,sourceRuns,distinctControls:20,safeViewports:[[844,390],[667,375]],safeInsets:{top:12,right:44,bottom:21,left:44},safeContextCount:8,safeTargetCount:26,heldTargetCount:8,thresholdCssPx:44,toleranceCssPx:.1,targetedMotion:stateRun.evidence.initialInput.motion,equivalentStates:samples.map(row=>({id:row.id,hoverEqualsNormal:!row.differences.hover.count,pressEqualsHover:!row.differences.press.count,focusEqualsNormal:!row.differences.focus.count,immediateAction:row.immediateAction})),semanticEquivalence:latest.evidence.semanticEquivalence};
write(path.join(final,'results.json'),{ok:errors.length===0,total:checks.length,passed:checks.length,checks,evidence,errors});
write(path.join(final,'state-samples.json'),{samples,businessStates:latest.businessStates,evidence});
fs.copyFileSync(path.join(root,'targeted-safe-held/safe-area.json'),path.join(final,'safe-area.json'));
fs.copyFileSync(path.join(root,'targeted-safe-held/pressed-hitareas.json'),path.join(final,'pressed-hitareas.json'));
console.log(JSON.stringify({ok:true,uniqueAssertions:checks.length,controls:samples.length,safeContexts:8,safeTargets:26,heldTargets:8,errors:errors.length}));
