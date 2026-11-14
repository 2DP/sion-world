const test=require('node:test'),assert=require('node:assert/strict'),E=require('../engine.js');
function arena(){const s=E.create({seed:123,phase:'playing'});s.tiles=s.tiles.map(t=>t===2?0:t);s.hidden={};s.items={};s.pending={};s.crateSites=[E.index(s,7,5)];s.time=15;return s;}
test('crates return one at a time, with spacing and no timer progress while paused',()=>{
 const s=arena();E.step(s);assert.equal(s.tiles[s.crateSites[0]],2);assert.equal(s.events.filter(e=>e.type==='crate').length,1);
 s.tiles[s.crateSites[0]]=0;E.step(s);assert.equal(s.tiles[s.crateSites[0]],0);
 E.pause(s);E.step(s,{},20);assert.equal(s.tiles[s.crateSites[0]],0);
 E.resume(s);s.time=28;E.step(s);assert.equal(s.tiles[s.crateSites[0]],2);
});
test('crate regeneration avoids actors, loot, bombs, settlement and passage bottlenecks',()=>{
 for(const kind of ['actor','item','bomb','settling','corridor']) {
  const s=arena(),i=s.crateSites[0];
  if(kind==='actor')Object.assign(s.actors[0],{x:7,y:5});
  if(kind==='item')s.items[i]='fire';
  if(kind==='bomb')s.bombs.push({id:99,owner:0,x:1,y:1,range:2,due:30});
  if(kind==='settling')s.settling=true;
  if(kind==='corridor'){s.tiles.fill(1);for(let x=1;x<12;x++)s.tiles[E.index(s,x,5)]=0;}
  E.step(s);assert.notEqual(s.tiles[i],2,kind);
 }
});
test('allies always accept useful loot while enemy interest stays lower and shields are rarer',()=>{
 for(let stage=1;stage<=18;stage++){const s=E.create({stage});const a=s.actors.find(a=>a.id&&a.team===0);assert.equal(E.cpuLevel(s,a).itemInterest,1);assert.ok(E.cpuLevel(s,s.actors[1]).itemInterest<=.55);}
 assert.equal(E.ITEMS.shield.weight,8);assert.equal(Object.values(E.ITEMS).reduce((n,i)=>n+i.weight,0),100);
});
