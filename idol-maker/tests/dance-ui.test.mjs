import test from 'node:test';
import assert from 'node:assert/strict';
import {startMinigame} from '../src/minigames.js';
function harness(type,fn){
 class Node extends EventTarget{
  constructor(tag=''){super();this.tag=tag;this.children=[];this.className='';this.textContent='';this.attrs={};this.style={setProperty(){}};this.classList={add(){},remove(){}};}
  append(...nodes){for(const n of nodes)n.parent=this;this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  remove(){this.parent.children=this.parent.children.filter(n=>n!==this);}
  setAttribute(k,v){this.attrs[k]=v;}
  contains(n){return this===n||this.children.some(c=>c.contains(n));}
  get isConnected(){return host.contains(this);}
  querySelector(selector){return find(this,n=>selector==='button'&&n.tag==='button');}
  focus(){}
 }
 function find(node,predicate){if(predicate(node))return node;for(const child of node.children){const found=find(child,predicate);if(found)return found;}}
 function event(target,type,props={}){const e=new Event(type,{cancelable:true});Object.assign(e,props);target.dispatchEvent(e);return e;}
 const original={document:globalThis.document,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
 const host=new Node(),doc=new Node();doc.createElement=tag=>new Node(tag);doc.hidden=false;
 const tones=[];let frame,time=0,position=0,pauseCalls=0,resumeCalls=0,stopCalls=0,cues;
 globalThis.document=doc;globalThis.requestAnimationFrame=fn=>{frame=fn;return 1;};globalThis.cancelAnimationFrame=()=>{};
 const button=label=>find(host,n=>n.tag==='button'&&n.textContent===label);
 const step=()=>{time+=100;frame(time);};let game;
 try{
  game=startMinigame(host,{type,seed:42,tone:(f)=>tones.push(f),startRhythm:chart=>{cues=chart;return {position:()=>position,pause:()=>pauseCalls++,resume:()=>resumeCalls++,stop:()=>stopCalls++};}});
  event(button('준비됐어요 · 시작'),'click');for(let i=0;i<23;i++)step();
  fn({tones,event,doc,button,find:pred=>find(host,pred),step,setTime:t=>{position=t;step();},get cues(){return cues;},get pauses(){return pauseCalls;},get resumes(){return resumeCalls;},get stops(){return stopCalls;}});
 }finally{game?.destroy();Object.assign(globalThis,original);}
}
test('falling dance UI accepts keyboard and touch, pauses, and finishes on exactly ten hits',()=>harness('direction',h=>{
 const cards=h.find(n=>n.className==='mini-dance-fall').children.filter(n=>n.className.startsWith('mini-dance-drop'));
 const initial=parseFloat(cards[0].style.top);h.setTime(1000);assert.ok(parseFloat(cards[0].style.top)>initial);
 h.event(h.button('잠깐 쉬기'),'click');assert.equal(h.pauses,1);
 h.event(h.doc,'keydown',{key:'ArrowUp',repeat:false});assert.equal(h.find(n=>n.className==='mini-meter').textContent,'성공 0/10번');
 h.event(h.button('▶ 이어 하기'),'click');assert.equal(h.resumes,1);
 // Deliberately miss the first arrow. Successes must still reach ten.
 for(let i=1;i<=10;i++){
  h.setTime(h.cues[i]+(i%2?500:-500));const card=cards[i],key={'↑':'ArrowUp','↓':'ArrowDown','←':'ArrowLeft','→':'ArrowRight'}[card.textContent];
  h.event(h.doc,'keydown',{key,repeat:true});assert.equal(card.hidden,false);
  if(i%2)h.event(h.doc,'keydown',{key,repeat:false});
  else {const pad=h.find(n=>n.tag==='button'&&n.textContent===card.textContent);h.event(pad,'pointerdown');h.event(pad,'click',{detail:1});}
  assert.equal(card.hidden,true);if(i<10)assert.equal(h.find(n=>n.className==='mini-meter').textContent,'성공 '+i+'/10번');
 }
 assert.ok(h.find(n=>n.textContent==='댄스 연습 완료! 10번 성공했어요!'));assert.equal(h.stops,1);
}));
test('vocal UI holds pitch buttons, requires pitch and rhythm together, and clears held input on pause',()=>harness('rhythm',h=>{
 const gauge=h.find(n=>n.className==='mini-pitch-gauge'),up=h.button('→ 음정 높이기');
 h.event(up,'pointerdown',{pointerId:1});for(let t=100;t<=700;t+=100)h.setTime(t);
 assert.ok(Number(gauge.attrs['aria-valuenow'])>2.9);
 h.event(up,'pointerup',{pointerId:1});h.setTime(2000);h.event(h.doc,'keydown',{code:'Space',repeat:false});
 assert.match(h.find(n=>n.className==='mini-meter').textContent,/0\/8/);
 h.event(h.doc,'keydown',{key:'ArrowLeft',repeat:false});h.setTime(2100);h.setTime(2200);
 h.event(h.button('잠깐 쉬기'),'click');h.event(h.button('▶ 이어 하기'),'click');
 const pitch=Number(gauge.attrs['aria-valuenow']);h.setTime(2300);assert.equal(Number(gauge.attrs['aria-valuenow']),pitch);
 h.event(h.doc,'keydown',{key:'ArrowLeft',repeat:false});for(let t=2400;t<=2800;t+=100)h.setTime(t);h.event(h.doc,'keyup',{key:'ArrowLeft'});
 // Move to the second target (re): holding up reaches it, then release freezes it.
 h.event(h.doc,'keydown',{key:'ArrowRight',repeat:false});for(let t=2900;t<=3600;t+=100)h.setTime(t);h.event(h.doc,'keyup',{key:'ArrowRight'});
 h.setTime(h.cues[1]);h.event(h.doc,'keydown',{code:'Space',repeat:false});h.step();
 assert.match(h.find(n=>n.className==='mini-meter').textContent,/1\/8/);
}));

test('matching game has twenty cards',()=>harness('play',h=>{
 assert.equal(h.find(n=>n.className==='mini-pairs').children.length,20);
 assert.match(h.find(n=>n.className==='mini-meter').textContent,/0\/10쌍/);
}));
test('runner jumps, prevents double jumps, pauses and completes',()=>harness('exercise',h=>{
 const runner=h.find(n=>n.className==='mini-runner');
 h.event(h.doc,'keydown',{code:'Space',repeat:false});h.step();const rising=parseFloat(runner.style.bottom);assert.ok(rising>38);
 h.event(h.doc,'keydown',{code:'Space',repeat:false});h.step();assert.ok(parseFloat(runner.style.bottom)>rising);
 h.event(h.button('잠깐 쉬기'),'click');const frozen=runner.style.bottom;for(let i=0;i<10;i++)h.step();assert.equal(runner.style.bottom,frozen);
 h.event(h.button('▶ 이어 하기'),'click');for(let i=0;i<260;i++)h.step();
 assert.ok(h.find(n=>n.textContent==='장애물 달리기 완주!'));
}));


test('vocal success removes its target and cannot score it twice',()=>harness('rhythm',h=>{
 const note=h.find(n=>n.className==='mini-note');
 h.setTime(2000);h.event(h.doc,'keydown',{code:'Space',repeat:false});h.step();
 assert.equal(note.hidden,true);assert.equal(note.isConnected,false);
 assert.match(h.find(n=>n.className==='mini-meter').textContent,/1\/8/);
 h.event(h.doc,'keydown',{code:'Space',repeat:false});h.step();
 assert.match(h.find(n=>n.className==='mini-meter').textContent,/1\/8/);
}));
test('runner obstacle gaps vary and preserve jump recovery time',()=>harness('exercise',h=>{
 const obstacles=h.find(n=>n.className==='mini-arena mini-run-field').children.filter(n=>n.className==='mini-run-obstacle');
 const gaps=obstacles.slice(1).map((n,i)=>parseFloat(n.style.left)-parseFloat(obstacles[i].style.left));
 assert.ok(new Set(gaps.map(n=>n.toFixed(2))).size>1);
 assert.ok(gaps.every(n=>n>=48&&n<=86));
}));

test('vocal feedback distinguishes hits, wrong pitch, bad timing and missed notes',()=>harness('rhythm',h=>{
 const press=()=>h.event(h.doc,'keydown',{key:' ',code:'Space'});
 h.tones.length=0;press();assert.equal(h.tones.at(-1),196);
 h.setTime(h.cues[0]);press();assert.equal(h.tones.at(-1),784);h.step();assert.equal(h.tones.at(-1),1046.5);
 h.setTime(h.cues[1]);press();assert.equal(h.tones.at(-1),196);
 h.tones.length=0;h.setTime(h.cues[1]+321);assert.deepEqual(h.tones,[196]);h.step();assert.deepEqual(h.tones,[196]);
}));
