export function createAudio() {
 let ctx, musicGain, sfxGain, unlocked=false, timer=null, active=false, place='practice', step=0, next=0;
 let musicVolume=.35,sfxVolume=.65;
 const voices=new Set();
 const melodies={practice:[72,76,79,76,74,77,81,79,76,72,74,76,79,76,74,71],home:[72,76,79,83,79,76,74,71,69,72,76,79,76,72,71,67],agency:[72,74,76,79,81,79,76,74,77,79,81,84,83,79,76,74],stage:[72,79,76,81,79,84,83,79,77,81,79,76,74,77,76,72],studio:[69,72,76,79,76,72,74,77,71,74,77,81,79,77,74,71]};
 const hz=n=>440*Math.pow(2,(n-69)/12);
 function note(freq,duration,gainNode,volume=.12,time=ctx?.currentTime || 0,type='sine') {
  if(!ctx || !unlocked || ctx.state!=='running')return;
  const osc=ctx.createOscillator(),env=ctx.createGain();
  osc.type=type;osc.frequency.value=freq;env.gain.setValueAtTime(0,time);env.gain.linearRampToValueAtTime(volume,time+.025);env.gain.exponentialRampToValueAtTime(.0001,time+duration);
  osc.connect(env);env.connect(gainNode);voices.add(osc);osc.onended=()=>{voices.delete(osc);osc.disconnect();env.disconnect();};osc.start(time);osc.stop(time+duration+.03);
 }
 function tick(){
  if(!ctx||!unlocked||!active||ctx.state!=='running')return;
  const beat=place==='home'?.39:.29,melody=melodies[place]||melodies.practice;
  while(next<ctx.currentTime+.16){note(hz(melody[step%melody.length]),beat*1.75,musicGain,.1,next,'triangle');if(step%2===0)note(hz([48,55,60,55][Math.floor(step/2)%4]),beat*2.6,musicGain,.075,next);step++;next+=beat;}
 }
 async function unlock(){
  try {if(!ctx){const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return false;ctx=new Audio();musicGain=ctx.createGain();sfxGain=ctx.createGain();musicGain.gain.value=musicVolume;sfxGain.gain.value=sfxVolume;musicGain.connect(ctx.destination);sfxGain.connect(ctx.destination);}
   await ctx.resume();unlocked=ctx.state==='running';if(active&&!timer){next=ctx.currentTime+.04;timer=setInterval(tick,90);tick();}return unlocked;
  }catch{return false;}
 }
 function stop(){active=false;if(timer){clearInterval(timer);timer=null;}for(const osc of voices){try{osc.stop();}catch{}}voices.clear();}
 function start(target='practice'){if(active&&place===target)return;stop();active=true;place=target;step=0;if(ctx&&unlocked){next=ctx.currentTime+.04;timer=setInterval(tick,90);tick();}}
 function setVolume(music,sfx){if(Number.isFinite(music))musicVolume=Math.max(0,Math.min(1,music));if(Number.isFinite(sfx))sfxVolume=Math.max(0,Math.min(1,sfx));if(ctx){musicGain.gain.setTargetAtTime(musicVolume,ctx.currentTime,.04);sfxGain.gain.setTargetAtTime(sfxVolume,ctx.currentTime,.04);}}
 function tone(freq,duration=.12){if(Number.isFinite(freq)&&freq>0)note(Math.min(freq,12000),Math.max(.05,Math.min(duration,3)),sfxGain,.16);}
 function effect(name='click'){if(!ctx||!unlocked)return;const tones={click:[76],success:[72,76,79],reward:[76,79,84,88],level:[72,76,79,84],levelup:[72,76,79,84],buy:[79,84],save:[76,79],error:[64,60],rest:[72,67],start:[72,76,79]}[name]||[76,79];tones.forEach((n,i)=>note(hz(n),.22,sfxGain,.13,ctx.currentTime+i*.09));}
 function destroy(){stop();unlocked=false;if(ctx){ctx.close().catch(()=>{});ctx=null;}}
 return {unlock,setVolume,start,stop,tone,effect,destroy};
}
