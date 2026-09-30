import test from 'node:test';
import assert from 'node:assert/strict';
import {KEY,SLOT_COUNT,ITEMS,ACTIVITIES,DISTANCES,TIMING,newPlayer,readSave,readSlots,savePlayer,slotKey,validSave,purchase,equip,stats,doActivity,beginSwim,reward,findNote,judge,chart} from '../core.js';
const memory=()=>{const data=new Map();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
test('ten independent slots survive reload, overwrite and save-as',()=>{
 const storage=memory();
 for(let i=0;i<SLOT_COUNT;i++){const p=newPlayer(`선수${i}`,i%5);p.day=i+1;assert.ok(savePlayer(storage,p,i));}
 assert.equal(readSlots(storage).length,10);
 for(let i=0;i<10;i++){assert.equal(readSave(storage,i).player.name,`선수${i}`);assert.equal(readSave(storage,i).player.day,i+1);}
 const copy=readSave(storage,0).player;copy.name='복사';savePlayer(storage,copy,9);
 assert.equal(readSave(storage,0).player.name,'선수0');assert.equal(readSave(storage,9).player.name,'복사');
 assert.equal(savePlayer(storage,copy,10),false);assert.equal(savePlayer(storage,copy,-1),false);
 storage.setItem(slotKey(4),'{');assert.ok(readSlots(storage)[4].error);assert.equal(readSlots(storage)[5].player.name,'선수5');
});
test('legacy save is adopted by slot 1 without altering original or mixing 50m records',()=>{
 const storage=memory(),p=newPlayer('이전 선수',1);p.version=1;delete p.day;delete p.energy;delete p.buffs;p.records.best=42;purchase(p,'cap');
 storage.setItem(KEY,JSON.stringify(p));const original=storage.getItem(KEY),next=readSave(storage).player;
 assert.equal(next.version,2);assert.equal(next.energy,60);assert.equal(next.day,1);assert.equal(next.records.best,null);assert.deepEqual(next.owned,['cap']);assert.equal(next.coins,40);
 assert.ok(savePlayer(storage,next));assert.equal(storage.getItem(KEY),original);assert.equal(readSave(storage,1).player,null);
 next.name='새 이름';savePlayer(storage,next);assert.equal(readSave(storage).player.name,'새 이름');
});
test('100 unique items, 25 per slot, replacement removes prior bonus and keeps ownership',()=>{
 assert.equal(ITEMS.length,100);assert.equal(new Set(ITEMS.map(i=>i.id)).size,100);assert.equal(new Set(ITEMS.map(i=>i.name)).size,100);
 for(const slot of ['cap','suit','fins','goggles'])assert.equal(ITEMS.filter(i=>i.slot===slot).length,25);
 const p=newPlayer('쇼핑',0);p.coins=100000;
 for(const item of ITEMS){assert.ok(purchase(p,item.id));assert.ok(validSave(p));assert.ok(p.equipped.length<=4);}
 assert.equal(p.owned.length,100);assert.equal(p.equipped.length,4);
 const balance=p.coins;assert.equal(purchase(p,ITEMS[0].id),false);assert.equal(p.coins,balance);
 equip(p,'cap');assert.ok(p.equipped.includes('cap'));assert.ok(!p.equipped.includes('cap-24'));
 assert.equal(stats(p).stability,p.stats.stability+ITEMS.find(i=>i.id==='cap').bonus+ITEMS.find(i=>i.id==='goggles-24').bonus);
});
test('every home activity only spends energy and lasts exactly three starts',()=>{
 for(const a of ACTIVITIES){const p=newPlayer('집',0),base={...p.stats};p.coins=0;assert.ok(doActivity(p,a.id));assert.equal(p.coins,0);assert.equal(p.energy,60-a.energy);assert.equal(p.day,a.id==='sleep'?2:1);
 for(let i=0;i<3;i++){const s=beginSwim(p);assert.equal(s[a.stat],base[a.stat]+a.bonus);}
 assert.deepEqual(beginSwim(p),base);assert.equal(p.buffs.length,0);}
});
test('activities refresh rather than multiply; insufficient resources leave state unchanged',()=>{
 const p=newPlayer('집',0);doActivity(p,'rest');beginSwim(p);doActivity(p,'rest');assert.deepEqual(p.buffs,[{id:'rest',remaining:3}]);doActivity(p,'tv');assert.equal(p.buffs.length,2);
 for(const resource of ['energy']){const q=newPlayer('부족',0);q[resource]=0;const before=structuredClone(q);assert.equal(doActivity(q,'sleep'),false);assert.deepEqual(q,before);}
});
test('finished swims replenish energy with cap and serialize day and remaining boosts',()=>{
 const storage=memory(),p=newPlayer('활력',0);p.energy=0;assert.equal(reward(p,'practice',1,100,20,60).energy,30);assert.equal(p.energy,30);reward(p,'race',1,100,20,100);assert.equal(p.energy,80);assert.equal(reward(p,'race',1,100,20,100).energy,20);assert.equal(p.energy,100);
 doActivity(p,'sleep');beginSwim(p);assert.ok(savePlayer(storage,p,6));assert.deepEqual(readSave(storage,6).player,p);
 for(const change of [{energy:-1},{energy:101},{day:0},{buffs:[{id:'rest',remaining:4}]},{buffs:[null]},{buffs:[{id:'rest',remaining:1},{id:'rest',remaining:2}]}])assert.equal(validSave({...p,...change}),false);
});
test('expanded timing matches nearest unprocessed note, both early and late, once only',()=>{
 for(const direction of [-1,1])for(const [delta,score] of [[.14,1],[.24,.7],[.32,.3]]){const g={time:2,keys:[0],scores:[null]};const hit=findNote([g],0,2+direction*delta);assert.ok(hit);assert.equal(judge(hit.delta),score);g.scores[0]=score;assert.equal(findNote([g],0,2+direction*delta),null);}
 const groups=[{time:2,keys:[0],scores:[null]},{time:2.5,keys:[0],scores:[null]}];assert.equal(findNote(groups,0,2.3).group,groups[1]);assert.equal(findNote(groups,1,2),null);assert.equal(findNote(groups,0,1.679),null);
});
test('longer race chart lasts beyond the slowest unassisted swimmer',()=>{
 assert.deepEqual(DISTANCES,{practice:50,race:100});assert.ok(TIMING.perfect>.06);
 for(const mode of ['practice','race']){const duration=DISTANCES[mode]/.65+10,notes=chart(mode,1,duration);assert.ok(notes.at(-1).time>DISTANCES[mode]/.65);}
});
