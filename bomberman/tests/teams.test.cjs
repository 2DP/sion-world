const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js'), AI = require('../ai.js');
function arena(stage=1) { const s=E.create({stage,seed:17,phase:'playing'}); s.tiles=s.tiles.map(t=>t===2?0:t); s.hidden={}; return s; }
function at(a,x,y) { Object.assign(a,{x,y,prevX:x,prevY:y}); }
function ticks(s,n,controller) { for(let i=0;i<n;i++) E.step(s,{},1/60,controller); }

test('player death is spectating, and a surviving ally can win the stage',()=>{
  const s=arena(); s.actors[0].alive=false;
  E.step(s); assert.equal(s.phase,'playing'); assert.equal(s.settling,false);
  s.actors.find(a=>a.team===1).alive=false; E.step(s);
  assert.equal(s.phase,'stage-clear'); assert.equal(E.teamCounts(s).ours,1);
});
test('only elimination of the entire friendly team causes defeat',()=>{
  const s=arena(7); s.actors[0].alive=false;
  const allies=s.actors.filter(a=>a.id&&a.team===0);
  allies[0].alive=false; E.step(s); assert.equal(s.phase,'playing');
  allies[1].alive=false; E.step(s); assert.equal(s.phase,'defeat');
});
test('last enemy elimination waits for every bomb and residual flame, with no new bombs',()=>{
  const s=arena(),p=s.actors[0]; at(p,5,5); E.place(s,p); at(p,1,1);
  s.actors.filter(a=>a.team===1).forEach(a=>a.alive=false);
  E.step(s); assert.equal(s.phase,'playing'); assert.equal(s.settling,true);
  assert.equal(E.place(s,p),false); assert.ok(E.move(s,p,'right'));
  ticks(s,119); assert.equal(s.bombs.length,0); assert.equal(s.phase,'playing');
  ticks(s,23); assert.equal(s.phase,'playing'); ticks(s,1); assert.equal(s.phase,'stage-clear');
});
test('a defeated enemy final bomb can turn a provisional team victory into a draw',()=>{
  const s=arena(),enemy=s.actors[1],ally=s.actors.find(a=>a.id&&a.team===0);
  at(enemy,3,3); E.place(s,enemy); enemy.alive=false;
  at(s.actors[0],3,3); at(ally,5,3);
  ticks(s,120); assert.equal(E.teamCounts(s).ours,0); assert.equal(s.phase,'playing');
  ticks(s,24); assert.equal(s.phase,'draw');
});
test('settlement runs chain explosions and pauses without premature result events',()=>{
  const s=arena(),enemy=s.actors[1],p=s.actors[0];
  at(p,3,3); E.place(s,p); at(p,1,1); at(enemy,5,3); E.place(s,enemy); s.bombs[1].due=4; enemy.alive=false;
  E.step(s); E.pause(s); const time=s.time; ticks(s,300); assert.equal(s.time,time);
  E.resume(s); ticks(s,119); assert.equal(s.bombs.length,0); assert.equal(s.phase,'playing');
  ticks(s,24); assert.equal(s.phase,'stage-clear'); assert.equal(s.events.filter(e=>e.type==='result').length,1);
  E.step(s); assert.equal(s.events.length,0);
});
test('teammate blasts do not hurt allies, but the owner still takes damage',()=>{
  for(const ownerTeam of [0,1]) {
    const s=arena(3), members=s.actors.filter(a=>a.team===ownerTeam),owner=members[0],friend=members[1];
    at(owner,3,3); at(friend,5,3); friend.shield=1; E.place(s,owner); ticks(s,120);
    assert.equal(owner.alive,false); assert.equal(friend.alive,true); assert.equal(friend.shield,1);
    assert.equal(owner.kills,0);
  }
});
test('AI does not attack a teammate standing in its firing line',()=>{
  const s=arena(),ally=s.actors.find(a=>a.id&&a.team===0); s.stage=12; s.rng=()=>0;
  at(ally,3,3); at(s.actors[0],5,3); at(s.actors[1],9,7);
  assert.notEqual(AI.input(s,ally).bomb,true);
  at(s.actors[1],3,5); ally.ai.next=0;
  assert.equal(AI.input(s,ally).bomb,true);
});
test('stage twelve supports ally-only campaign victory after the last blast',()=>{
  const s=arena(12); s.actors[0].alive=false;
  s.actors.filter(a=>a.team===1).forEach(a=>a.alive=false); E.step(s);
  assert.equal(s.phase,'complete'); assert.equal(E.teamCounts(s).ours,2);
});
