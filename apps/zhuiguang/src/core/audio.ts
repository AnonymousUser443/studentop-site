import { appUrl } from "./url";
import { Howl, Howler } from 'howler';
const effects=['light-on','seal-stamp','paper-slide','paper-whip','tear','chime','tick','rain','match','guqin-open','bonk','shatter'] as const;
type Effect=typeof effects[number];
const bank=new Map<string,Howl>();
let unlocked=false,muted=false,currentTrack='',fadeFrame=0;
let previousMusic:Howl|undefined;
const levels:Record<string,number>={'light-on':.18,'seal-stamp':.32,'paper-slide':.025,'paper-whip':.07,tear:.15,chime:.12,tick:.025,rain:.04,match:.12,'guqin-open':.16,bonk:.18,shatter:.14};
function effect(key:Effect){let sound=bank.get(key);if(!sound){sound=new Howl({src:[appUrl(`/assets/audio/sfx/${key}.wav`)],volume:levels[key]||.1,preload:true});bank.set(key,sound)}return sound}
export const audio={
 async unlock(){if(unlocked)return;try{await Howler.ctx?.resume();unlocked=true}catch{unlocked=false}},
 isMuted:()=>muted,
 isUnlocked:()=>unlocked,
 setMuted(value:boolean){muted=value;Howler.mute(value)},
 play(key:string,rate=1){if(!unlocked||muted||!effects.includes(key as Effect))return;const sound=effect(key as Effect);const id=sound.play();sound.rate(rate,id);return id},
 cue(pageId:string,chapter:number){
  if (['P1-07','P2-13','P5-16','P7-14','P8-08','P8-20'].includes(pageId)) { audio.silence(); return; }
  const track = chapter===1 && pageId>='P1-08' ? 'p1-after-film' : chapter===8 && pageId>='P8-09' ? 'p8-lamp' : 'p'+chapter;
  if(!unlocked||track===currentTrack)return;currentTrack=track;cancelAnimationFrame(fadeFrame);const old=previousMusic;const sound=new Howl({src:[appUrl(`/assets/audio/bgm/${track}.opus`),appUrl(`/assets/audio/bgm/${track}.m4a`)],format:['opus','m4a'],loop:true,volume:0,html5:false,preload:true});previousMusic=sound;const volume=chapter===8?.065:.095;sound.play();const start=performance.now();const fade=()=>{const p=Math.min(1,(performance.now()-start)/1200);sound.volume(Math.sin(p*Math.PI/2)*volume);old?.volume(Math.cos(p*Math.PI/2)*.095);if(p<1)fadeFrame=requestAnimationFrame(fade);else old?.unload()};fadeFrame=requestAnimationFrame(fade)},
 silence(){cancelAnimationFrame(fadeFrame);previousMusic?.stop();previousMusic?.unload();previousMusic=undefined;currentTrack='';bank.forEach(s=>s.stop())},
 stopScene(){bank.forEach((s,k)=>{if(k==='rain')s.stop()})},
 destroy(){audio.silence();bank.forEach(s=>s.unload());bank.clear()},
};
