import test from 'node:test';
import assert from 'node:assert/strict';
import {createAudio} from '../src/audio.js';
import {rhythmChart,RHYTHM_BEAT_MS,danceChart,DANCE_BEAT_MS,DANCE_DURATION_MS} from '../src/rhythm.js';

test('every difficulty puts playable notes exactly on a soundtrack beat',()=>{
 for(let tier=0;tier<3;tier++){
  const chart=rhythmChart(tier);assert.equal(chart.length,[8,12,16][tier]);
  assert.equal(chart[0],2000);assert.equal(chart.at(-1),28000);
  assert.equal(new Set(chart).size,chart.length);
  for(const at of chart)assert.equal(at%RHYTHM_BEAT_MS,0);
 }
});

test('music cues share the note clock and pause/resume cancels and reschedules audio',async()=>{
 const original=globalThis.AudioContext;let ctx;
 class FakeAudio {
  constructor(){ctx=this;this.currentTime=10;this.state='running';this.oscillators=[];}
  resume(){return Promise.resolve();} close(){return Promise.resolve();}
  createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){}},connect(){},disconnect(){}};}
  createOscillator(){const osc={frequency:{value:0},connect(){},disconnect(){},start(at){this.at=at;},stop(at){if(at===undefined)this.cancelled=true;}};this.oscillators.push(osc);return osc;}
 }
 globalThis.AudioContext=FakeAudio;
 const audio=createAudio();
 try{
  await audio.unlock();const chart=rhythmChart(0),track=audio.startRhythm(chart);
  const bell=440*2**((96-69)/12),cues=ctx.oscillators.filter(o=>o.frequency.value===bell);
  assert.equal(cues.length,chart.length);
  cues.forEach((cue,i)=>assert.ok(Math.abs(cue.at-(10.08+chart[i]/1000))<1e-9));
  ctx.currentTime=12.08;assert.ok(Math.abs(track.position()-2000)<1e-8);
  ctx.currentTime=12.33;track.pause();const frozen=track.position(),old=[...ctx.oscillators];
  assert.ok(old.every(o=>o.cancelled));ctx.currentTime=40;assert.equal(track.position(),frozen);
  track.resume();assert.ok(Math.abs(track.position()-frozen)<1e-8);
  const future=ctx.oscillators.slice(old.length);assert.ok(future.every(o=>o.at>40));
  const nextCue=future.find(o=>o.frequency.value===bell);
  assert.ok(Math.abs(nextCue.at-(40.08+(chart[1]-frozen)/1000))<1e-9);
  ctx.currentTime=nextCue.at;assert.ok(Math.abs(track.position()-chart[1])<1e-8);
  track.stop();assert.ok(future.every(o=>o.cancelled));const count=ctx.oscillators.length;track.resume();assert.equal(ctx.oscillators.length,count);
  const dance=danceChart(2,()=>0).flat().map(n=>n.at),origin=ctx.currentTime+.08;
  const slowTrack=audio.startRhythm(dance,{beatMs:DANCE_BEAT_MS,durationMs:DANCE_DURATION_MS,drums:true});
  const slowCues=ctx.oscillators.slice(count).filter(o=>o.frequency.value===bell);
  assert.equal(slowCues.length,40);
  const drums=ctx.oscillators.slice(count).filter(o=>o.frequency.value===440*2**((36-69)/12));
  assert.equal(drums.length,DANCE_DURATION_MS/DANCE_BEAT_MS);
  drums.forEach((kick,i)=>assert.ok(Math.abs(kick.at-(origin+i*DANCE_BEAT_MS/1000))<1e-9));
  slowCues.forEach((cue,i)=>assert.ok(Math.abs(cue.at-(origin+dance[i]/1000))<1e-9));
  assert.equal(dance[1]-dance[0],1500);assert.equal(dance.at(-1),61500);
  slowTrack.stop();
  const beforePitch=ctx.oscillators.length;
  const vocal=audio.startRhythm([2000],{pitches:[329.63]});
  const pitched=ctx.oscillators.slice(beforePitch).filter(o=>o.frequency.value===329.63);
  assert.equal(pitched.length,1);assert.ok(Math.abs(pitched[0].at-(ctx.currentTime+.08+2))<1e-9);
  vocal.stop();assert.equal(pitched[0].cancelled,true);
 }finally{audio.destroy();globalThis.AudioContext=original;}
});
