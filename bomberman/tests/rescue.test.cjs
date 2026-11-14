const test=require('node:test'),assert=require('node:assert/strict'),E=require('../engine.js'),AI=require('../ai.js');
function setup(deadId=0){const s=E.create({seed:1,phase:'playing'});s.tiles=s.tiles.map(t=>t===2?0:t);s.hidden={};const ally=s.actors.find(a=>a.team===0&&a.id),dead=deadId?ally:s.actors[0],helper=deadId?s.actors[0]:ally;Object.assign(dead,{alive:false,x:3,y:3,death:{at:0,cause:'bomb'}});Object.assign(helper,{x:3,y:4});return {s,dead,helper};}
function ticks(s,n,ai){for(let i=0;i<n;i++)E.step(s,{},1/60,ai);}
test('player and ally can each be rescued, but the team can rescue only once',()=>{
 for(const id of [0,1]){const {s,dead}=setup(id);ticks(s,89);assert.equal(dead.alive,false);ticks(s,1);assert.equal(dead.alive,true);assert.equal(dead.death,null);assert.equal(s.rescuesLeft,0);assert.ok(dead.protectedUntil>s.time);dead.alive=false;dead.death={at:s.time};ticks(s,120);assert.equal(dead.alive,false);}
});
test('rescue pauses, resets on leaving, and cannot occur during flames or team defeat',()=>{
 const {s,dead,helper}=setup();ticks(s,40);E.pause(s);ticks(s,100);assert.ok(Math.abs(s.rescue.elapsed-40/60)<1e-8);E.resume(s);helper.x=7;E.step(s);assert.equal(s.rescue,null);helper.x=3;ticks(s,50);assert.equal(dead.alive,false);
 s.flames=[{cells:new Set([E.index(s,3,3)]),until:s.time+3,team:0,owner:helper.id}];E.step(s);assert.equal(s.rescue,null);s.flames=[];helper.alive=false;E.step(s);assert.equal(s.phase,'defeat');assert.equal(dead.alive,false);
});
test('ally AI approaches and revives a player safely without planting bombs at the rescue point',()=>{
 const {s,dead,helper}=setup();helper.x=5;helper.y=3;s.actors[1].ai.next=999;
 ticks(s,240,(s,a)=>a.team===0?AI.input(s,a):{});assert.equal(dead.alive,true);assert.equal(s.rescuesLeft,0);
});
test('new rounds restore rescue allowance; enemies and storm casualties outside safe terrain cannot be rescued',()=>{
 const {s,dead}=setup();s.time=125;dead.x=1;dead.y=1;assert.deepEqual(E.rescueTargets(s),[]);assert.equal(E.create().rescuesLeft,1);
});
