import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

// Drive the real frame/reward/save lifecycle with a deterministic clock and a tiny render stub.
async function game(){
 const elements=new Map(),storage=new Map(),handlers={};let seconds=0;let timerId=0;const timers=new Map(),intervals=new Map();
 const canvas=new Proxy({}, {get:()=>()=>{}});
 const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',focus(){},style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}},getContext:()=>canvas,remove(){},scrollIntoView(){},querySelector:()=>({focus(){},textContent:''})});return elements.get(id);};
 const context={document:{querySelector:element,addEventListener(type,fn){handlers[type]=fn;},createElement:()=>element('modal'),body:{append(){}}},window:{addEventListener(){}},performance:{now:()=>seconds*1000},requestAnimationFrame:()=>1,cancelAnimationFrame(){},setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id),setInterval:fn=>{intervals.set(++timerId,fn);return timerId;},clearInterval:id=>intervals.delete(id),localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},structuredClone};
 const code=await readFile(new URL('../game.bundle.js',import.meta.url),'utf8');
 vm.runInNewContext(code.replace(/\}\)\(\);\s*$/,`globalThis.testing={prepare(){player=newPlayer('검증',0);activeSlot=4;player.energy=60;player.lastPracticeDay=player.day;doActivity(player,'sleep');player.place='practice';},go,start,frame,endRace,hit,pause,resume,elapsed,startSnorkel,snorkelFrame,pauseSnorkel,resumeSnorkel,stopSnorkel,get snorkel(){return snorkel;},get player(){return player;},get race(){return race;}};})();`),context);
 return {api:context.testing,storage,flush(){const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn());},interval(){[...intervals.values()].forEach(fn=>fn());},html:()=>element('#app').innerHTML,click(dataset){handlers.click({target:{closest:()=>({dataset,disabled:false})},preventDefault(){}});},tick(t){seconds=t;context.testing.frame();}};
}
for(const mode of ['practice','race'])test(`${mode}: complete the longer course, pay energy once and retain a consumed boost across saves`,async()=>{
 const g=await game(),a=g.api;a.prepare();a.start(mode);assert.equal(a.race.length,mode==='practice'?50:100);assert.equal(a.player.buffs[0].remaining,2);assert.equal(a.race.actors[0].s.base,.7050000000000001);
 for(let tick=0;tick<12000&&a.race;tick++)g.tick(tick/60);
 assert.equal(a.race,null,'player must finish within 200 seconds without input');assert.equal(a.player.energy,mode==='practice'?90:100);assert.equal(a.player.records[mode==='practice'?'practices':'races'],1);
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

test('wait for all rivals, accelerate tenfold, freeze player scoring and pay once',async()=>{
 const g=await game(),a=g.api;a.prepare();a.start('race');const actors=a.race.actors;
 actors[0].distance=99.99;actors[0].speed=1;actors[1].finish=.001;actors[1].distance=100;
 for(const rival of actors.slice(2)){rival.distance=10;rival.speed=.7;}
 g.tick(3.02);assert.ok(a.race);assert.equal(a.player.records.races,0);assert.ok(a.race.fastAt!==undefined);assert.match(g.html(),/100m/);
 const finished=actors[0].finish,judged=a.race.judged,combo=actors[0].combo,distance=actors[2].distance;
 a.endRace();assert.ok(a.race);g.tick(3.12);assert.ok(actors[2].distance-distance>.5);a.hit(0);assert.equal(a.race.judged,judged);assert.equal(actors[0].combo,combo);assert.equal(actors[0].finish,finished);
 for(let t=3.22;t<30&&a.race;t+=.1)g.tick(t);
 assert.equal(a.race,null);assert.ok(actors.every(a=>a.finish!==null));assert.equal(a.player.records.races,1);assert.match(g.html(),/2위 \/ 5명/);assert.match(g.html(),/podium-scene/);assert.doesNotMatch(g.html(),/미완주|NaN|undefined/);const coins=a.player.coins;a.endRace();assert.equal(a.player.coins,coins);
});

test('furniture applies once after movement and action; leaving cancels pending action',async()=>{const g=await game(),a=g.api;a.prepare();a.go('home');const energy=a.player.energy;g.click({activity:'bath'});g.click({activity:'eat'});assert.equal(a.player.energy,energy);g.flush();assert.equal(a.player.energy,energy);g.flush();assert.equal(a.player.energy,energy-15);assert.equal(a.player.buffs.filter(b=>b.id==='bath').length,1);g.click({activity:'eat'});a.go('village');g.flush();g.flush();assert.equal(a.player.energy,energy-15);a.go('home');a.player.energy=0;const day=a.player.day;g.click({activity:'sleep'});g.flush();g.flush();assert.equal(a.player.day,day+1);assert.equal(a.player.energy,0);});
test('tenfold spectating pauses and resumes without advancing during pause',async()=>{const g=await game(),a=g.api;a.prepare();a.start('race');a.race.actors[0].distance=99.999;g.tick(3.02);assert.ok(a.race.fastAt!==undefined);a.pause();const time=a.elapsed(),distance=a.race.actors[1].distance;g.tick(8);assert.ok(Math.abs(a.elapsed()-time)<1e-8);assert.equal(a.race.actors[1].distance,distance);a.resume();g.interval();g.interval();g.interval();assert.ok(Math.abs(a.elapsed()-time)<1e-8);g.tick(8.1);assert.ok(Math.abs(a.elapsed()-time-1)<1e-8);});

test('beach loop saves catches immediately, pauses, and cleans up on leaving',async()=>{
 const g=await game(),a=g.api;a.prepare();a.go('village');assert.match(g.html(),/해변으로 가기/);a.go('beach');assert.equal(a.player.place,'beach');assert.match(g.html(),/스노클링 시작하기/);a.startSnorkel();assert.match(g.html(),/sea-arena/);const s=a.snorkel;s.targets=[{id:99,type:'fish',x:s.x,y:s.y,age:0,life:10,phase:0,variant:0}];const coins=a.player.coins,buffs=structuredClone(a.player.buffs),practice=a.player.lastPracticeDay;a.snorkelFrame(10);assert.equal(a.player.coins,coins+3);assert.equal(a.snorkel.catches,1);assert.equal(JSON.parse(g.storage.get('splash-club-save-v2-slot-5')).coins,coins+3);assert.deepEqual(structuredClone(a.player.buffs),buffs);assert.equal(a.player.lastPracticeDay,practice);
 a.pauseSnorkel();const time=s.time;a.snorkelFrame(1000);assert.equal(s.time,time);a.resumeSnorkel();assert.equal(s.paused,false);a.go('shop');assert.equal(a.snorkel,null);a.snorkelFrame(2000);assert.equal(a.player.place,'shop');
});

test('shark penalty is saved immediately without counting as a catch',async()=>{const g=await game(),a=g.api;a.prepare();a.go('beach');a.startSnorkel();const s=a.snorkel;s.targets=[{id:99,type:'shark',x:s.x,y:s.y,age:0,life:10,phase:0,variant:0}];const coins=a.player.coins,energy=a.player.energy;a.snorkelFrame(10);assert.equal(a.player.coins,coins-8);assert.equal(a.player.energy,energy-5);assert.equal(s.catches,0);const saved=JSON.parse(g.storage.get('splash-club-save-v2-slot-5'));assert.equal(saved.coins,coins-8);assert.equal(saved.energy,energy-5);});
