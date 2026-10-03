import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,startActivity,finishActivity,activityView,validateState,updateAppearance,equipItem,prepareLoadedState,buyItem} from '../src/core.js';
import {ACTIVITIES,MINI_NAMES,APPEARANCE_OPTIONS,APPEARANCE_DEFAULTS,ITEMS,WARDROBE_COLORS} from '../src/data.js';
import {characterSVG} from '../src/character.js';

test('all activities offer a registered game and seven games complete with one cost each',()=>{
 const s=newGame();
 for(const a of ACTIVITIES)assert.ok(MINI_NAMES[activityView(s,a.id).mini],a.id);
 for(const id of ['exercise','beauty','meal','rest','play','gaming','snack']){
  const before={used:s.used,money:s.money},v=activityView(s,id),r=startActivity(s,id);
  assert.ok(r.ok,id);assert.equal(r.run.mini,id);assert.ok(validateState(s));
  const saved=prepareLoadedState(JSON.parse(JSON.stringify(s)));
  assert.equal(saved.activeAction.id,r.run.id);
  assert.ok(finishActivity(s,r.run.id,80).ok);assert.equal(s.used,before.used+1);
  assert.equal(s.money,before.money-v.cost);assert.equal(finishActivity(s,r.run.id,80).ok,false);
 }
 assert.equal(s.used,7);assert.equal(s.miniOffers,7);assert.equal(startActivity(s,'rest').ok,false);
});

test('wardrobe follows leader while companion faces and hair remain individual',()=>{
 const s=newGame(),faces=s.members.map(m=>m.appearance.hair);s.money=5000;
 for(const id of ['outfit-8','shoes-2','accessory-4']){assert.ok(buyItem(s,id).ok);assert.ok(equipItem(s,id).ok);}
 for(const m of s.members)for(const k of ['outfit','shoes','accessory'])assert.equal(m.appearance[k],s.appearance[k]);
 assert.deepEqual(s.members.map(m=>m.appearance.hair),faces);
 for(const a of [s.appearance,...s.members.map(m=>m.appearance)])for(const key of Object.keys(APPEARANCE_DEFAULTS))delete a[key];
 s.members[0].appearance.outfit='starter-mint';assert.ok(validateState(s));
 prepareLoadedState(s);assert.ok(validateState(s));assert.equal(s.appearance.faceShape,'round');assert.equal(s.members[0].appearance.outfit,s.appearance.outfit);
});

test('every appearance option renders, survives saving, and rejects unsupported input',()=>{
 const s=newGame();
 for(const [key,{values}] of Object.entries(APPEARANCE_OPTIONS))for(const value of Object.keys(values)){
  updateAppearance(s,{[key]:value});assert.equal(s.appearance[key],value);assert.ok(validateState(JSON.parse(JSON.stringify(s))));
  assert.ok(characterSVG(s.appearance).includes('<svg'));
 }
 updateAppearance(s,{eyeColor:'#123456',freckles:true});assert.equal(s.appearance.eyeColor,'#123456');assert.ok(s.appearance.freckles);
 const before=JSON.stringify(s.appearance);updateAppearance(s,{eyeColor:'<script>',hairStyle:'__proto__',glasses:'unknown'});assert.equal(JSON.stringify(s.appearance),before);
});

test('all wearable names identify their actual shared color palette',()=>{
 for(const item of ITEMS.filter(i=>i.type!=='equipment')){
  const palette=WARDROBE_COLORS.find(c=>c.name===item.colorName);assert.ok(palette,item.id);
  assert.ok(item.name.startsWith(palette.name),item.name);assert.equal(item.color,palette.color);
 }
});
