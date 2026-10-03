import test from 'node:test';
import assert from 'node:assert/strict';
import {createAudio} from '../src/audio.js';
import {rhythmChart,RHYTHM_BEAT_MS} from '../src/rhythm.js';

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
 }finally{audio.destroy();globalThis.AudioContext=original;}
});
