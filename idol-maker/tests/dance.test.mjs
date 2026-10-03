import test from 'node:test';
import assert from 'node:assert/strict';
import {danceChart,createDanceRun,memorySequences,movePitch,vocalScore,vocalChart} from '../src/rhythm.js';
test('falling dance arrows have readable spacing and ten hits remain possible after misses',()=>{
 const notes=danceChart(0,()=>.5).flat();assert.equal(notes.length,40);
 assert.equal(notes[0].at,3000);assert.equal(notes[1].at-notes[0].at,1500);
 const run=createDanceRun([notes]);run.advance(20000);assert.equal(run.hits,0);
 for(const n of run.notes.filter(n=>n.status==='pending').slice(0,10))assert.ok(run.press(n.direction,n.at));
 assert.equal(run.hits,10);
});
test('dance allows early and late hits, rejects wrong directions and never counts twice',()=>{
 for(const easy of [false,true])for(const delta of [-1,1]){
  const run=createDanceRun(danceChart(0,()=>0),easy),at=3000+delta*(easy?700:600);
  assert.equal(run.press(1,at),null);assert.equal(run.hits,0);
  assert.ok(run.press(0,at));assert.equal(run.press(0,at),null);assert.equal(run.hits,1);
  const other=createDanceRun(danceChart(0,()=>0),easy);assert.equal(other.press(0,at+delta),null);
 }
});
test('memory sequence lengths include both 4 and 6 regardless of level',()=>{
 assert.deepEqual(memorySequences(()=>0).map(a=>a.length),[4,4,4]);
 assert.deepEqual(memorySequences(()=>.999).map(a=>a.length),[6,6,6]);
 let seed=1;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);
 const lengths=new Set();for(let i=0;i<30;i++)for(const sequence of memorySequences(random)){lengths.add(sequence.length);assert.ok(sequence.every(d=>d>=0&&d<4));}
 assert.deepEqual([...lengths].sort(),[4,5,6]);
});
test('pitch changes continuously, clamps to range, and both rhythm and pitch are required',()=>{
 assert.equal(movePitch(4,1,100),4);assert.equal(movePitch(0,-1,100),0);
 assert.ok(movePitch(2,1,100)>2);assert.ok(movePitch(2,-1,100)<2);
 assert.equal(vocalScore(100,2,2),100);assert.equal(vocalScore(70,2.6,2),70);
 assert.equal(vocalScore(100,3,2),0);assert.equal(vocalScore(0,2,2),0);
 assert.ok(vocalChart(2).every(n=>n.pitch>=0&&n.pitch<=4));
});
