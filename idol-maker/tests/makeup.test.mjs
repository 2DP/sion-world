import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,updateAppearance,validateState,prepareLoadedState} from '../src/core.js';
import {characterSVG} from '../src/character.js';
test('additional makeup survives save round trip and can be removed',()=>{
 const state=newGame();const makeup={eyeshadow:'#bd9adb',eyeliner:'#494252',brow:'#795548'};
 updateAppearance(state,{makeup});const saved=JSON.parse(JSON.stringify(state));assert.equal(validateState(saved),true);
 for(const [part,value] of Object.entries(makeup))assert.equal(saved.appearance.makeup[part],value);
 const svg=characterSVG(saved.appearance);assert.match(svg,/data-feature="eyeshadow"/);assert.match(svg,/data-feature="eyeliner"/);assert.match(svg,/stroke="#795548"/);
 updateAppearance(saved,{makeup:{eyeshadow:'none',eyeliner:'none',brow:'none'}});assert.doesNotMatch(characterSVG(saved.appearance),/data-feature="eyeshadow"|data-feature="eyeliner"/);
 saved.appearance.makeup.eyeliner='invalid';assert.equal(validateState(saved),false);assert.equal(validateState(newGame()),true);
});

test('group makeup follows the protagonist, including removal and older saves',()=>{
 const state=newGame();const identities=state.members.map(m=>({hair:m.appearance.hair,hairStyle:m.appearance.hairStyle}));
 updateAppearance(state,{makeup:{blush:'#efa5b5',lip:'#d98096',eyeshadow:'#bd9adb',eyeliner:'#494252',brow:'#795548',sparkle:true}});
 for(const [i,m] of state.members.entries()){assert.deepEqual(m.appearance.makeup,state.appearance.makeup);assert.notEqual(m.appearance.makeup,state.appearance.makeup);assert.deepEqual({hair:m.appearance.hair,hairStyle:m.appearance.hairStyle},identities[i]);}
 const saved=JSON.parse(JSON.stringify(state));saved.members.forEach(m=>m.appearance.makeup={blush:'none',lip:'none',sparkle:false});
 prepareLoadedState(saved);assert.equal(validateState(saved),true);saved.members.forEach(m=>assert.deepEqual(m.appearance.makeup,saved.appearance.makeup));
 updateAppearance(saved,{makeup:{blush:'none',lip:'none',eyeshadow:'none',eyeliner:'none',brow:'none',sparkle:false}});
 saved.members.forEach(m=>assert.deepEqual(m.appearance.makeup,saved.appearance.makeup));
});
