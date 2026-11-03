'use strict';
// Records the live application's actual painted frames; original paint timestamps determine video timing.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {newSession,until,sleep}=require('../../lib.js');
const out=path.join(__dirname,'poc'),evidence=[];
(async()=>{let s;try{
  fs.mkdirSync(out,{recursive:true});s=await newSession({size:'844x390',hardwareRendering:true});await s.call('Emulation.setFocusEmulationEnabled',{enabled:true});
  await s.navigate('http://127.0.0.1:5176/?qa=1&preset=fog');await until(()=>s.evaluate('Boolean(window.__LIYUN__)'),15000,'QA bridge');
  await s.evaluate('window.__LIYUN__.setSettings({autoDegrade:false,music:false,uiSound:false,reducedMotion:false,reduceFlash:false});true');
  for(const quality of ['low','high']){
    const directory=path.join(out,quality);fs.mkdirSync(directory,{recursive:true});
    await s.evaluate(`window.__LIYUN__.setPreset('fog');window.__LIYUN__.setQualityPreset('${quality}');window.__LIYUN__.setCamera({scale:.5,x:422-.35779963220596467*4000*.5,y:195-.37007771543334456*4958*.5});true`);await sleep(650);
    const frames=[];
    const handle=event=>{const index=frames.length,file=`frame-${String(index).padStart(5,'0')}.jpg`;fs.writeFileSync(path.join(directory,file),Buffer.from(event.data,'base64'));frames.push({file,timestamp:event.metadata.timestamp});void s.call('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});};
    s.client.on('Page.screencastFrame',handle);
    await s.call('Page.startScreencast',{format:'jpeg',quality:88,maxWidth:844,maxHeight:390,everyNthFrame:1});
    await sleep(850);const unlockAt=Date.now();await s.evaluate('window.__LIYUN__.unlockRegion("beihu");true');await sleep(2350);
    await s.call('Page.stopScreencast');s.client.off('Page.screencastFrame',handle);
    if(frames.length<5)throw Error('Not enough real painted frames');
    const concat=['ffconcat version 1.0'];for(let i=0;i<frames.length;i++){concat.push(`file '${frames[i].file}'`);concat.push('option framerate 1000');concat.push('duration '+(i+1<frames.length?Math.max(.001,frames[i+1].timestamp-frames[i].timestamp):.15));}concat.push(`file '${frames.at(-1).file}'`);concat.push('option framerate 1000');
    fs.writeFileSync(path.join(directory,'frames.ffconcat'),concat.join('\n')+'\n');
    const video=path.join(out,`ink-reveal-${quality}-844x390.mp4`);
    cp.execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-safe','0','-i',path.join(directory,'frames.ffconcat'),'-fps_mode','vfr','-c:v','libx264','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',video],{windowsHide:true});
    const probe=JSON.parse(cp.execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_name,width,height,nb_frames:format=duration,size','-of','json',video],{encoding:'utf8',windowsHide:true}));
    evidence.push({quality,video:path.basename(video),paintFrames:frames.length,firstTimestamp:frames[0].timestamp,lastTimestamp:frames.at(-1).timestamp,unlockWallClock:unlockAt,probe,method:'CDP Page.startScreencast, real paint timestamps in ffconcat/VFR; actual application transition, no fabricated interpolation, audio omitted. Desktop Edge at844x390; not phone FPS.'});
    fs.writeFileSync(path.join(directory,'frames.json'),JSON.stringify(frames,null,2));
  }
  if(s.errors.length)throw Error(JSON.stringify(s.errors));fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({ok:true,evidence,errors:s.errors},null,2));console.log(JSON.stringify({ok:true,evidence},null,2));
}catch(error){fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({ok:false,error:String(error.stack||error),evidence,errors:s?.errors},null,2));console.error(error);process.exitCode=1;}finally{await s?.close();}})();
