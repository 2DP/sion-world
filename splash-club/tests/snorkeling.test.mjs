import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayer,ITEMS,stats,savePlayer,readSave,validSave} from '../core.js';
import {SEA_TYPES,seaType,newSnorkel,spawnSeaTarget,moveSnorkeler,seaPosition,catchSeaTarget,stepSnorkel,hitSeaShark} from '../snorkeling.js';

test('sea types have a rare one-percent gear band and several living targets',()=>{
 for(const [roll,type] of [[0,'fish'],[.4099,'fish'],[.41,'crab'],[.64,'shrimp'],[.83,'dolphin'],[.91,'shark'],[.9899,'shark'],[.99,'item'],[.9999,'item']])assert.equal(seaType(roll),type);
 assert.equal(newSnorkel(()=>.5).targets.length,5);
});
test('arrow movement normalizes diagonal speed and stops at all four edges',()=>{
 const a=newSnorkel(),b=newSnorkel();moveSnorkeler(a,1,0,1);moveSnorkeler(b,1,1,1);assert.ok(Math.abs(Math.hypot(b.x-450,b.y-290)-(a.x-450))<1e-8);
 moveSnorkeler(a,1,1,100);assert.equal(a.x,870);assert.equal(a.y,478);moveSnorkeler(a,-1,-1,100);assert.equal(a.x,30);assert.equal(a.y,42);assert.equal(a.facing,-1);
});
test('spawn cap, timed disappearance and pause freeze movement and lifetime',()=>{
 const s=newSnorkel(()=>.5),p=newPlayer('바다',0);for(let i=0;i<20;i++)spawnSeaTarget(s,'dolphin');assert.equal(s.targets.length,10);const target=s.targets[0];target.age=target.life-.01;s.paused=true;const before=structuredClone({...s,rng:null});stepSnorkel(s,1,new Set(['ArrowRight']),p);assert.deepEqual({...s,rng:null},before);s.paused=false;stepSnorkel(s,.05,new Set(),p);assert.ok(!s.targets.some(t=>t.id===target.id));
});
test('contact grants each creature reward once; expiry cannot grant rewards',()=>{
 for(const type of ['fish','crab','shrimp','dolphin']){const p=newPlayer('캐치',0),s=newSnorkel(()=>.5);s.targets=[];const t=spawnSeaTarget(s,type);const pos=seaPosition(t);s.x=pos.x;s.y=pos.y;const rewards=stepSnorkel(s,.01,new Set(),p);assert.equal(rewards.length,1);assert.equal(p.coins,120+SEA_TYPES[type].coins);assert.equal(p.energy,60+SEA_TYPES[type].energy);assert.equal(catchSeaTarget(p,t),null);assert.equal(stepSnorkel(s,.01,new Set(),p).length,0);assert.equal(p.lastPracticeDay,0);assert.equal(p.day,1);}
 const p=newPlayer('만료',0);assert.equal(catchSeaTarget(p,{type:'fish',age:10,life:10}),null);assert.equal(p.coins,120);
});
test('actual energy payout is capped and bank limit remains valid',()=>{
 const p=newPlayer('상한',0);p.energy=99;p.coins=1e9-1;const r=catchSeaTarget(p,{type:'dolphin',age:0,life:10});assert.equal(r.energy,1);assert.equal(r.coins,1);assert.equal(p.energy,100);assert.equal(p.coins,1e9);assert.ok(validSave(p));
});
test('free gear catch uses purchase equipment rules and survives beach save',()=>{
 const p=newPlayer('보물',0);p.owned=['cap'];p.equipped=['cap'];p.place='beach';p.coins=0;const t={type:'item',age:0,life:14};const r=catchSeaTarget(p,t,()=>0);assert.equal(r.item.id,'cap-1');assert.equal(p.coins,8);assert.equal(p.energy,64);assert.deepEqual(p.owned,['cap','cap-1']);assert.deepEqual(p.equipped,['cap-1']);assert.equal(stats(p).stability,p.stats.stability+r.item.bonus);assert.equal(catchSeaTarget(p,t),null);
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};assert.ok(savePlayer(storage,p,3));assert.deepEqual(readSave(storage,3).player,p);
});
test('all-owned treasure pays coins without duplicating or toggling equipment',()=>{
 const p=newPlayer('수집왕',0);p.owned=ITEMS.map(i=>i.id);p.equipped=['cap'];const r=catchSeaTarget(p,{type:'item',age:0,life:14});assert.equal(r.allOwned,true);assert.equal(r.coins,25);assert.equal(p.owned.length,100);assert.deepEqual(p.equipped,['cap']);assert.ok(validSave(p));
});

test('sharks approach more slowly than the swimmer and spawn with escape space',()=>{
 const s=newSnorkel(()=>.5);s.targets=[];const shark=spawnSeaTarget(s,'shark');assert.ok(Math.hypot(shark.x-s.x,shark.y-s.y)>=220);const before=Math.hypot(shark.x-s.x,shark.y-s.y);stepSnorkel(s,.05,new Set(['ArrowRight']),newPlayer('도망',0));const after=Math.hypot(shark.x-s.x,shark.y-s.y);assert.ok(after>before,'moving away must increase distance');assert.equal(catchSeaTarget(newPlayer('상어',0),shark),null);
});
test('shark hit loses a little, never below zero, and protects against repeated hits',()=>{
 const p=newPlayer('위험',0),s=newSnorkel();s.targets=[];const shark={id:100,type:'shark',x:s.x,y:s.y,age:0,life:10};s.targets.push(shark);let r=stepSnorkel(s,.01,new Set(),p);assert.equal(r.length,1);assert.equal(r[0].hit,true);assert.equal(p.coins,112);assert.equal(p.energy,55);assert.equal(s.catches,0);assert.equal(s.lostCoins,8);assert.equal(hitSeaShark(p,shark,s),null);
 const other={...shark,id:101,caught:false};s.targets=[other];stepSnorkel(s,.05,new Set(),p);assert.equal(p.coins,112);assert.equal(p.energy,55);s.time=s.invulnerableUntil;p.coins=3;p.energy=2;r=stepSnorkel(s,.01,new Set(),p);assert.equal(r[0].coins,-3);assert.equal(r[0].energy,-2);assert.equal(p.coins,0);assert.equal(p.energy,0);assert.ok(validSave(p));
});
test('pause freezes sharks and protection duration',()=>{
 const s=newSnorkel(),p=newPlayer('정지',0);s.targets=[];spawnSeaTarget(s,'shark');s.invulnerableUntil=2.5;s.paused=true;const before=structuredClone({...s,rng:null});stepSnorkel(s,10,new Set(['ArrowLeft']),p);assert.deepEqual({...s,rng:null},before);
});
