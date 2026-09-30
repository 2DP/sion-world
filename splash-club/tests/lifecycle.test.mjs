import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

// Drive the real frame/reward/save lifecycle with a deterministic clock and a tiny render stub.
async function game(){
 const elements=new Map(),storage=new Map();let seconds=0;
 const canvas=new Proxy({}, {get:()=>()=>{}});
 const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){},toggle(){}},getContext:()=>canvas,remove(){},querySelector:()=>({focus(){}})});return elements.get(id);};
 const context={document:{querySelector:element,addEventListener(){},createElement:()=>element('modal'),body:{append(){}}},window:{addEventListener(){}},performance:{now:()=>seconds*1000},requestAnimationFrame:()=>1,cancelAnimationFrame(){},setTimeout:()=>1,clearTimeout(){},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},structuredClone};
 const code=await readFile(new URL('../game.bundle.js',import.meta.url),'utf8');
 vm.runInNewContext(code.replace(/\}\)\(\);\s*$/,`globalThis.testing={prepare(){player=newPlayer('검증',0);activeSlot=4;player.energy=60;doActivity(player,'sleep');player.place='practice';},start,frame,endRace,hit,get player(){return player;},get race(){return race;}};})();`),context);
 return {api:context.testing,storage,tick(t){seconds=t;context.testing.frame();}};
}
for(const mode of ['practice','race'])test(`${mode}: complete the longer course, pay energy once and retain a consumed boost across saves`,async()=>{
 const g=await game(),a=g.api;a.prepare();a.start(mode);assert.equal(a.race.length,mode==='practice'?50:100);assert.equal(a.player.buffs[0].remaining,2);assert.equal(a.race.actors[0].s.base,.7050000000000001);
 for(let tick=0;tick<12000&&a.race;tick++)g.tick(tick/60);
 assert.equal(a.race,null,'all swimmers must finish within 200 seconds without input');assert.equal(a.player.energy,mode==='practice'?70:90);assert.equal(a.player.records[mode==='practice'?'practices':'races'],1);
 const coins=a.player.coins;a.endRace();assert.equal(a.player.coins,coins,'repeat completion must not pay twice');
 const saved=JSON.parse(g.storage.get('splash-club-save-v2-slot-5'));assert.equal(saved.energy,a.player.energy);assert.equal(saved.buffs[0].remaining,2);assert.equal(saved.day,2);
});
test('actual input handler accepts a late Good and does not judge the same note twice',async()=>{
 const g=await game(),a=g.api;a.prepare();a.start('practice');g.tick(5.63);a.hit(0);assert.equal(a.race.groups[0].scores[0],.7);assert.equal(a.race.actors[0].combo,1);const count=a.race.judged;a.hit(0);assert.equal(a.race.judged,count);assert.equal(a.race.actors[0].combo,1);
});
