import test from 'node:test';
import assert from 'node:assert/strict';
import {minigameDifficulty} from '../src/difficulty.js';
import {danceChart,createDanceRun} from '../src/rhythm.js';
test('difficulty changes only at levels six and sixteen, with a permanent comfortable override',()=>{
 for(const [level,tier] of [[1,0],[5,0],[6,1],[15,1],[16,2],[1000,2]]){
  assert.equal(minigameDifficulty(level).tier,tier);
  assert.deepEqual(minigameDifficulty(level,true),minigameDifficulty(1,true));
 }
});
test('all twelve skill games scale gently in the intended direction',()=>{
 const profiles=[1,6,16].map(level=>minigameDifficulty(level));
 for(const key of ['vocalNotes','actingFrames','runSpeed','foamCount','cloudGrowth','pairs','beachObjects'])assert.ok(profiles[0][key]<profiles[1][key]&&profiles[1][key]<profiles[2][key],key);
 for(const key of ['danceWindow','memoryBeat','quizDuration','fallDuration','fruitPeriod'])assert.ok(profiles[0][key]>profiles[1][key]&&profiles[1][key]>profiles[2][key],key);
 assert.ok(profiles[2].runSpeed/profiles[0].runSpeed<1.2);
 assert.ok(profiles[2].cloudGrowth/profiles[0].cloudGrowth<1.2);
});
test('dance timing stays generous but gets narrower, while easy mode overrides every tier',()=>{
 for(let tier=0;tier<3;tier++){
  const run=createDanceRun(danceChart(tier,()=>0),false,tier);
  assert.ok(run.press(0,3000+[600,550,500][tier]));
  const miss=createDanceRun(danceChart(tier,()=>0),false,tier);
  assert.equal(miss.press(0,3001+[600,550,500][tier]),null);
  assert.ok(createDanceRun(danceChart(tier,()=>0),true,tier).press(0,3700));
 }
});
