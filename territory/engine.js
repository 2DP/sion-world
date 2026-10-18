(function(root){
'use strict';
const W=48,H=32,DIRS={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
const STAGES=[['첫 번째 별밭',50,1,180],['민트빛 산책',55,2,180],['반딧불 손님',60,2,180],['라벤더 오솔길',65,2,165],['구름의 숨바꼭질',70,3,165],['나의 별빛 정원',75,3,180]].map(([name,target,enemies,limit])=>({name,target,enemies,limit}));
const idx=(x,y)=>y*W+x, clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function create(stage=1,difficulty='easy'){
 stage=clamp(Math.floor(stage)||1,1,6);difficulty=difficulty==='normal'?'normal':'easy';const cfg=STAGES[stage-1];
 const s={stage,difficulty,cfg,tiles:Array(W*H).fill(0),player:{x:24,y:0},anchor:{x:24,y:0},trail:[],armed:false,lives:3,shield:0,time:cfg.limit+(difficulty==='easy'?45:0),score:0,percent:0,phase:'playing',events:[],moveClock:0,firefly:stage>=3?65:null};
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(!x||!y||x===W-1||y===H-1)s.tiles[idx(x,y)]=1;
 s.enemies=Array.from({length:cfg.enemies},(_,i)=>({x:12+i*12+.5,y:15+(i%2)*9+.5,vx:(i%2?-1:1)*(2.7+stage*.3),vy:(i%2?1:-1)*(2.1+stage*.25)}));return s;
}
function toggle(s){if(s.phase==='playing'&&!s.trail.length)s.armed=!s.armed;}
function pause(s){if(s.phase==='playing')s.phase='paused';else if(s.phase==='paused')s.phase='playing';s.moveClock=0;}
function damage(s){if(s.phase!=='playing'||s.shield>0)return false;s.lives--;s.trail=[];s.armed=false;s.player={...s.anchor};s.shield=2;s.events.push('hurt');if(!s.lives){s.phase='lost';s.events.push('lost');}return true;}
function capture(s){
 if(s.phase!=='playing'||!s.trail.length)return;
 if(s.enemies.some(e=>s.trail.includes(idx(Math.floor(e.x),Math.floor(e.y))))){if(!damage(s)){s.trail=[];s.armed=false;s.player={...s.anchor};}return;}
 const before=s.tiles.reduce((a,b)=>a+b,0);for(const i of s.trail)s.tiles[i]=1;s.trail=[];s.armed=false;
 const seen=new Uint8Array(W*H),queue=[];
 for(const e of s.enemies){const i=idx(Math.floor(e.x),Math.floor(e.y));if(!s.tiles[i]&&!seen[i]){seen[i]=1;queue.push(i);}}
 for(let p=0;p<queue.length;p++){const i=queue[p],x=i%W,y=Math.floor(i/W);for(const [dx,dy]of Object.values(DIRS)){const nx=x+dx,ny=y+dy,j=idx(nx,ny);if(nx>=0&&ny>=0&&nx<W&&ny<H&&!s.tiles[j]&&!seen[j]){seen[j]=1;queue.push(j);}}}
 for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=idx(x,y);if(!seen[i])s.tiles[i]=1;}
 const total=s.tiles.reduce((a,b)=>a+b,0),area=total-(2*W+2*H-4);s.percent=area/((W-2)*(H-2))*100;s.score+=(total-before)*10;s.events.push('capture');
 if(s.percent>=s.cfg.target){s.phase='won';s.score+=Math.ceil(s.time)*5+s.lives*250;s.events.push('won');}
}
function move(s,dir){if(s.phase!=='playing'||!DIRS[dir])return;const [dx,dy]=DIRS[dir],x=s.player.x+dx,y=s.player.y+dy;if(x<0||y<0||x>=W||y>=H)return;const i=idx(x,y);
 if(s.trail.includes(i)){damage(s);return;}
 if(!s.tiles[i]&&!s.armed&&!s.trail.length)return;
 if(!s.tiles[i]){if(!s.trail.length){s.anchor={...s.player};s.events.push('draw');}s.trail.push(i);}
 s.player={x,y};if(s.tiles[i]&&s.trail.length)capture(s);
 if(s.phase==='playing'&&!s.tiles[i]&&s.enemies.some(e=>Math.floor(e.x)===x&&Math.floor(e.y)===y))damage(s);
}
const perimeter=2*(W-1)+2*(H-1);
function perimeterPoint(n){n=((n%perimeter)+perimeter)%perimeter;if(n<W-1)return{x:n,y:0};n-=W-1;if(n<H-1)return{x:W-1,y:n};n-=H-1;if(n<W-1)return{x:W-1-n,y:H-1};n-=W-1;return{x:0,y:H-1-n};}
function step(s,dt,dir){if(s.phase!=='playing')return;dt=clamp(dt,0,.1);s.shield=Math.max(0,s.shield-dt);s.moveClock+=dt;if(s.moveClock>=.065){s.moveClock%=.065;move(s,dir);}if(s.phase!=='playing')return;
 const speed=s.difficulty==='easy'?.75:1;
 for(const e of s.enemies){const sub=Math.max(1,Math.ceil(Math.max(Math.abs(e.vx),Math.abs(e.vy))*dt*speed/.15));for(let k=0;k<sub;k++){
 for(const axis of ['x','y']){const v=axis==='x'?'vx':'vy',next=e[axis]+e[v]*dt*speed/sub;const x=axis==='x'?next:e.x,y=axis==='y'?next:e.y;if(s.tiles[idx(Math.floor(x),Math.floor(y))]!==0)e[v]*=-1;else e[axis]=next;}
 const i=idx(Math.floor(e.x),Math.floor(e.y));if(s.trail.includes(i)||(!s.tiles[idx(s.player.x,s.player.y)]&&i===idx(s.player.x,s.player.y)))damage(s);
 }}
 if(s.firefly!==null){s.firefly=(s.firefly+dt*(6+s.stage)*speed)%perimeter;const p=perimeterPoint(s.firefly);if(Math.abs(p.x-s.player.x)<.8&&Math.abs(p.y-s.player.y)<.8)damage(s);}
 if(s.phase==='playing'){s.time=Math.max(0,s.time-dt);if(!s.time){s.phase='lost';s.events.push('lost');}}
}
function cleanSave(raw){const out={difficulty:'easy',muted:false,unlocks:{easy:1,normal:1},records:{}};if(!raw||typeof raw!=='object')return out;out.difficulty=raw.difficulty==='normal'?'normal':'easy';out.muted=raw.muted===true;for(const d of ['easy','normal']){const n=Number(raw.unlocks?.[d]);out.unlocks[d]=Number.isFinite(n)?clamp(Math.floor(n),1,6):1;for(let st=1;st<=6;st++){const key=d+'-'+st,r=raw.records?.[key];if(r&&Number.isFinite(r.score)&&Number.isFinite(r.percent))out.records[key]={score:clamp(Math.floor(r.score),0,1000000),percent:clamp(r.percent,0,100)};}}return out;}
function record(save,s){if(!['won','lost'].includes(s.phase))return save;const key=s.difficulty+'-'+s.stage,old=save.records[key]||{score:0,percent:0};save.records[key]={score:Math.max(old.score,s.score),percent:Math.max(old.percent,s.percent)};if(s.phase==='won')save.unlocks[s.difficulty]=Math.max(save.unlocks[s.difficulty],Math.min(6,s.stage+1));return save;}
const api={W,H,DIRS,STAGES,idx,create,toggle,pause,damage,capture,move,step,perimeterPoint,cleanSave,record};if(typeof module!=='undefined')module.exports=api;root.StarGarden=api;
})(typeof globalThis!=='undefined'?globalThis:this);
