import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

// Drive the real frame/reward/save lifecycle with a deterministic clock and a tiny render stub.
async function game(){
 const elements=new Map(),storage=new Map(),handlers={};let seconds=0;
 const canvas=new Proxy({}, {get:()=>()=>{}});
 const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){},toggle(){}},getContext:()=>canvas,remove(){},scrollIntoView(){},querySelector:()=>({focus(){}})});return elements.get(id);};
 const context={document:{querySelector:element,addEventListener(type,fn){handlers[type]=fn;},createElement:()=>element('modal'),body:{append(){}}},window:{addEventListener(){}},performance:{now:()=>seconds*1000},requestAnimationFrame:()=>1,cancelAnimationFrame(){},setTimeout:()=>1,clearTimeout(){},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},structuredClone};
 const code=await readFile(new URL('../game.bundle.js',import.meta.url),'utf8');
 vm.runInNewContext(code.replace(/\}\)\(\);\s*$/,`globalThis.testing={prepare(){player=newPlayer('검증',0);activeSlot=4;player.energy=60;doActivity(player,'sleep');player.place='practice';},go,start,frame,endRace,hit,get player(){return player;},get race(){return race;}};})();`),context);
 return {api:context.testing,storage,html:()=>element('#app').innerHTML,click(dataset){handlers.click({target:{closest:()=>({dataset,disabled:false})},preventDefault(){}});},tick(t){seconds=t;context.testing.frame();}};
}
for(const mode of ['practice','race'])test(`${mode}: complete the longer course, pay energy once and retain a consumed boost across saves`,async()=>{
 const g=await game(),a=g.api;a.prepare();a.start(mode);assert.equal(a.race.length,mode==='practice'?50:100);assert.equal(a.player.buffs[0].remaining,2);assert.equal(a.race.actors[0].s.base,.7050000000000001);
 for(let tick=0;tick<12000&&a.race;tick++)g.tick(tick/60);
 assert.equal(a.race,null,'player must finish within 200 seconds without input');assert.equal(a.player.energy,mode==='practice'?70:90);assert.equal(a.player.records[mode==='practice'?'practices':'races'],1);
 const coins=a.player.coins;a.endRace();assert.equal(a.player.coins,coins,'repeat completion must not pay twice');
 const saved=JSON.parse(g.storage.get('splash-club-save-v2-slot-5'));assert.equal(saved.energy,a.player.energy);assert.equal(saved.buffs[0].remaining,2);assert.equal(saved.day,2);
});
test('actual input handler accepts a late Good and does not judge the same note twice',async()=>{
 const g=await game(),a=g.api;a.prepare();a.start('practice');g.tick(5.63);a.hit(0);assert.equal(a.race.groups[0].scores[0],.7);assert.equal(a.race.actors[0].combo,1);const count=a.race.judged;a.hit(0);assert.equal(a.race.judged,count);assert.equal(a.race.actors[0].combo,1);
});

test('shop is separate from home, remains open through purchase and filtering, and persists its location',async()=>{
 const g=await game(),a=g.api;a.prepare();a.go('home');assert.match(g.html(),/data-activity="eat"/);assert.doesNotMatch(g.html(),/data-item=/);
 a.go('village');assert.match(g.html(),/상점으로 가기/);a.go('shop');assert.match(g.html(),/data-item="cap"/);assert.doesNotMatch(g.html(),/data-activity=/);
 g.click({item:'cap'});assert.ok(a.player.owned.includes('cap'));assert.equal(a.player.place,'shop');assert.match(g.html(),/알록달록 수영 상점/);
 g.click({filter:'goggles'});assert.match(g.html(),/data-item="goggles"/);assert.doesNotMatch(g.html(),/data-item="cap"/);
 g.click({shopPage:'2'});assert.match(g.html(),/은하수 수영안경/);assert.equal(a.player.place,'shop');
 const saved=JSON.parse(g.storage.get('splash-club-save-v2-slot-5'));assert.equal(saved.place,'shop');
 const {readSave}=await import('../core.js');const loaded=readSave({getItem:k=>g.storage.get(k)??null},4);assert.equal(loaded.player.place,'shop');assert.ok(loaded.player.owned.includes('cap'));
});

test('last charge of a home boost is visible for the entire swim',async()=>{
 const g=await game(),a=g.api;a.prepare();a.player.buffs[0].remaining=1;a.start('race');
 assert.equal(a.player.buffs.length,0);assert.equal(a.race.activeBuffs[0].id,'sleep');assert.match(g.html(),/집에서 챙긴 부스트/);assert.match(g.html(),/이번 수영에 적용 중 · 이후 0회/);assert.match(g.html(),/속도 \+0.025 m\/s/);
 g.tick(4);assert.match(g.html(),/이번 수영에 적용 중/);
});
test('player finish ends immediately; unfinished rivals are not ranked ahead or given fake times',async()=>{
 const g=await game(),a=g.api;a.prepare();a.start('race');const actors=a.race.actors;
 actors[0].distance=99.99;actors[0].speed=1;actors[1].finish=.001;actors[1].distance=100;
 for(const rival of actors.slice(2)){rival.distance=10;rival.speed=.7;}
 g.tick(3.02);assert.equal(a.race,null);assert.equal(a.player.records.races,1);assert.match(g.html(),/2위 \/ 5명/);assert.equal((g.html().match(/미완주/g)||[]).length,3);assert.doesNotMatch(g.html(),/NaN|undefined/);
 const coins=a.player.coins;a.endRace();assert.equal(a.player.coins,coins);
});
test('a rival crossing later in the same frame cannot outrank the finished player',async()=>{
 const g=await game(),a=g.api;a.prepare();a.start('race');const actors=a.race.actors;
 actors[0].distance=99.995;actors[0].speed=1;actors[1].distance=99.993;actors[1].speed=1;
 g.tick(3.02);assert.equal(a.race,null);assert.match(g.html(),/1위 \/ 5명/);assert.equal((g.html().match(/미완주/g)||[]).length,4);
});
