import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../src/storage.js';
import {newGame,validateState,startActivity,finishActivity} from '../src/core.js';
function memory(){const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};}
test('ten independent slots and official save versus recovery',async()=>{
  const store=createStore(memory(),validateState,{locks:null});
  for(let i=1;i<=10;i++){const s=newGame({name:`리더${i}`});assert.equal((await store.write(i,s,{kind:'manual'})).ok,true);}
  const s=store.read(3).snapshot;const run=startActivity(s,'vocal');finishActivity(s,run.run.id,100);
  assert.equal((await store.write(3,s,{expectedRevision:1})).ok,true);
  assert.equal(store.read(3).snapshot.used,0);assert.equal(store.read(3).recovery.used,1);
  assert.equal(store.read(4).state.name,'리더4');
  assert.equal((await store.write(3,s,{kind:'auto',expectedRevision:2})).ok,true);
  assert.equal(store.read(3).recovery,null);assert.equal(store.read(3).snapshot.used,1);
});
test('stale writer cannot overwrite newer state, copy save is independent',async()=>{
  const db=memory(),a=createStore(db,validateState,{locks:null}),b=createStore(db,validateState,{locks:null});const s=newGame();await a.write(1,s);
  const stale=b.read(1);await a.write(1,s,{expectedRevision:1});
  const conflict=await b.write(1,stale.state,{expectedRevision:1});assert.equal(conflict.conflict,true);assert.equal(a.read(1).revision,2);
  await b.write(2,stale.state,{kind:'manual',overwrite:true});assert.equal(a.read(2).state.id,s.id);
});
test('storage denial and malformed saves are reported without replacement',async()=>{
  const bad={getItem:()=>'{bad',setItem:()=>{throw Error('quota');}},store=createStore(bad,validateState,{locks:null});
  assert.ok(store.read(1).error);assert.equal((await store.write(1,newGame())).ok,false);
  assert.equal((await store.write(1,newGame(),{overwrite:true})).ok,false);
  assert.equal((await store.write(1,{version:1},{overwrite:true})).ok,false);
});
test('valid snapshot survives a damaged recovery, preserving original data',async()=>{
  const db=memory(),store=createStore(db,validateState,{locks:null});await store.write(1,newGame(),{kind:'manual'});
  const raw=JSON.parse(db.getItem(store.key(1)));raw.recovery={broken:true};db.setItem(store.key(1),JSON.stringify(raw));
  assert.equal(store.read(1).damaged,true);assert.equal(store.read(1).state.name,'하루');
});
