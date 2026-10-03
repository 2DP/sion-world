import test from 'node:test';
import assert from 'node:assert/strict';
import {mountExtraMinigame} from '../src/extra-minigames.js';
import {gameIconText} from '../src/icons.js';
function mount(type){
 const nodes=[];let tick,input,time=0,catches=0;
 const el=(tag,className='',textContent='')=>{const n={tag,className,textContent,children:[],style:{},classList:{add(){}},setAttribute(){},append(...items){this.children.push(...items);},remove(){this.removed=true;},clientHeight:270,offsetTop:198,offsetHeight:className==='mini-falling'?40:64};nodes.push(n);return n;};
 const body=el('main');
 mountExtraMinigame(type,{body,el,button:(text,fn,cls)=>Object.assign(el('button',cls,text),{click:fn}),schedule(){},sound(){catches++;},result(){},finish(){},rand:()=>.5,tier:0,o:{},now:()=>time,setTick:fn=>tick=fn,setInput:fn=>input=fn,setKeyUp(){},setPause(){},listen(){}});
 return {nodes,key:key=>input({key}),step(t){time=t;tick();},get catches(){return catches;}};
}
test('star disappears at the basket opening before its full fall, and is counted once',()=>{
 const game=mount('gaming');game.step(0);
 const star=game.nodes.find(n=>n.className==='mini-falling');
 game.step(2000);assert.equal(star.removed,undefined);assert.equal(game.catches,0);
 game.step(2100);assert.equal(star.removed,true);assert.equal(game.catches,1);
 game.step(2200);assert.equal(game.catches,1);
 assert.match(game.nodes.find(n=>n.className==='mini-basket').innerHTML,/<svg/);
});
test('coral, rock and beans use vector artwork in both choices and selected food',()=>{
 for(const icon of ['🪸','🪨','🫘']){assert.match(gameIconText(icon),/<svg/);assert.ok(!gameIconText(icon).includes(icon));}
 const beach=mount('vacation');
 assert.equal(beach.nodes.filter(n=>n.className==='mini-beach-object'&&n.innerHTML.includes('<svg')).length,2);
 const meal=mount('meal');meal.nodes.find(n=>n.textContent==='🫘 콩').click();
 assert.ok(meal.nodes.some(n=>n.className==='mini-bento-slot'&&n.innerHTML?.includes('<svg')));
});

test('seven basket lanes are selectable and keyboard movement stops at both edges',()=>{
 const game=mount('gaming'),basket=game.nodes.find(n=>n.className==='mini-basket');
 const controls=game.nodes.find(n=>n.className==='mini-catcher-controls').children;
 assert.equal(controls.length,7);assert.equal(basket.style.left,'50%');
 controls.forEach((b,i)=>{b.click();assert.equal(basket.style.left,((i+.5)/7*100)+'%');});
 for(let i=0;i<10;i++)game.key('ArrowLeft');assert.equal(basket.style.left,(.5/7*100)+'%');
 for(let i=0;i<10;i++)game.key('ArrowRight');assert.equal(basket.style.left,(6.5/7*100)+'%');
});
