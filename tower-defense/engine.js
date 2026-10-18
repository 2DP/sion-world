(function (root) {
  'use strict';
  const W = 960, H = 576, CELL = 48;
  const maps = [
    { name: '풀빛 정원', subtitle: '첫 번째 별을 지키는 곳', color: '#dfead1', path: [[-24,120],[264,120],[264,360],[600,360],[600,168],[792,168],[792,456],[984,456]] },
    { name: '라벤더 언덕', subtitle: '굽이치는 보랏빛 산책로', color: '#e5dded', path: [[-24,408],[168,408],[168,168],[456,168],[456,456],[696,456],[696,216],[984,216]] },
    { name: '달빛 호수', subtitle: '마지막 별빛을 향해서', color: '#d4e9e8', path: [[-24,168],[216,168],[216,408],[504,408],[504,120],[744,120],[744,360],[984,360]] }
  ];
  const types = {
    arrow: { name: '화살', cost: 65, damage: 15, range: 150, cooldown: .6, color: '#4a8870', icon: '➶', note: '빠른 단일 공격' },
    cannon: { name: '대포', cost: 115, damage: 34, range: 135, cooldown: 1.5, color: '#c88258', icon: '●', note: '주변 적까지 범위 공격' },
    frost: { name: '얼음', cost: 90, damage: 7, range: 140, cooldown: .85, color: '#619da9', icon: '❄', note: '2초 동안 이동 속도 감소' },
    magic: { name: '마법', cost: 135, damage: 28, range: 160, cooldown: 1, color: '#9974b4', icon: '✦', note: '방어력을 무시하는 공격' }
  };
  const enemies = {
    basic: { name: '말랑이', hp: 44, speed: 43, reward: 8, armor: 0, color: '#c895b0', radius: 13 },
    fast: { name: '쌩쌩이', hp: 29, speed: 77, reward: 9, armor: 0, color: '#e2b25d', radius: 11 },
    armor: { name: '돌멩이', hp: 102, speed: 32, reward: 15, armor: .52, color: '#8696ac', radius: 16 },
    swarm: { name: '꼬물이', hp: 24, speed: 50, reward: 5, armor: 0, color: '#99b56d', radius: 9 },
    boss: { name: '구름 대장', hp: 800, speed: 25, reward: 100, armor: .28, color: '#9f80b5', radius: 24 }
  };
  function distanceToSegment(x,y,a,b) { const dx=b[0]-a[0],dy=b[1]-a[1]; const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy))); return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy); }
  function length(path) { return path.slice(1).reduce((n,p,i)=>n+Math.hypot(p[0]-path[i][0],p[1]-path[i][1]),0); }
  function point(path,d) { for(let i=1;i<path.length;i++){ const a=path[i-1],b=path[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]); if(d<=len)return {x:a[0]+(b[0]-a[0])*d/len,y:a[1]+(b[1]-a[1])*d/len}; d-=len; } return {x:path.at(-1)[0],y:path.at(-1)[1]}; }
  function create(map=0,difficulty='easy') { return {map: maps[map]?map:0,difficulty:difficulty==='normal'?'normal':'easy',gold:260,hp:difficulty==='normal'?20:30,wave:0,status:'ready',towers:[],enemies:[],effects:[],queue:[],spawn:0,time:0,kills:0,score:0,nextId:1}; }
  function stats(t) { const base=types[t.type]; return {...base,damage:Math.round(base.damage*(1+(t.level-1)*.8)),range:base.range+(t.level-1)*15,cooldown:base.cooldown/(1+(t.level-1)*.12)}; }
  function upgradeCost(t) { return Math.round(types[t.type].cost*(t.level===1?.8:1.25)); }
  function cell(x,y) { return {x:Math.floor(x/CELL)*CELL+CELL/2,y:Math.floor(y/CELL)*CELL+CELL/2}; }
  function canBuild(s,x,y) { if(!Number.isFinite(x)||!Number.isFinite(y)||x<24||x>W-24||y<24||y>H-24)return false; const p=maps[s.map].path; return !p.slice(1).some((b,i)=>distanceToSegment(x,y,p[i],b)<46)&&!s.towers.some(t=>Math.hypot(t.x-x,t.y-y)<40); }
  function editable(s) { return s.status==='ready'||s.status==='running'; }
  function build(s,type,x,y) { if(!editable(s)||!types[type])return null; const p=cell(x,y); if(!canBuild(s,p.x,p.y)||s.gold<types[type].cost)return null; const t={id:s.nextId++,type,...p,level:1,cooldown:0,spent:types[type].cost}; s.gold-=t.spent;s.towers.push(t);return t; }
  function upgrade(s,id) { const t=s.towers.find(t=>t.id===id); if(!editable(s)||!t||t.level>=3||s.gold<upgradeCost(t))return false; const cost=upgradeCost(t);s.gold-=cost;t.spent+=cost;t.level++;return true; }
  function sell(s,id) { const t=s.towers.find(t=>t.id===id);if(!editable(s)||!t)return false;s.gold+=Math.floor(t.spent*.7);s.towers=s.towers.filter(t=>t.id!==id);return true; }
  function start(s) { if(s.status!=='ready'||s.wave>=15)return false;s.wave++;s.status='running';const count=8+s.wave*2; s.queue=Array.from({length:count},(_,i)=>s.wave>=4&&i%5===0?'armor':s.wave>=3&&i%4===0?'swarm':s.wave>=2&&i%3===0?'fast':'basic');if(s.wave%5===0)s.queue.push('boss');s.spawn=0;return true; }
  function spawnEnemy(s,type) { const b=enemies[type], scale=(1+(s.wave-1)*.19)*(1+s.map*.16)*(s.difficulty==='easy'?.78:1);const e={...b,type,id:s.nextId++,hp:b.hp*scale,maxHp:b.hp*scale,d:0,slow:0,...point(maps[s.map].path,0)};s.enemies.push(e);return e; }
  function step(s,dt) { if(s.status!=='running'||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);s.time+=dt;s.effects=s.effects.filter(e=>(e.life-=dt)>0);s.spawn-=dt;if(s.queue.length&&s.spawn<=0){spawnEnemy(s,s.queue.shift());s.spawn+=s.wave>10?.68:.85;}
    const path=maps[s.map].path,total=length(path);
    for(const e of s.enemies){ e.d+=e.speed*(e.slow>0?.5:1)*dt;e.slow=Math.max(0,e.slow-dt);Object.assign(e,point(path,e.d));if(e.d>=total){e.escaped=true;s.hp=Math.max(0,s.hp-(e.type==='boss'?5:1));} }
    s.enemies=s.enemies.filter(e=>!e.escaped);
    if(s.hp<=0){s.status='lost';return;}
    for(const t of s.towers){ t.cooldown=Math.max(0,t.cooldown-dt);if(t.cooldown>0)continue;const st=stats(t);const target=s.enemies.filter(e=>e.hp>0&&Math.hypot(e.x-t.x,e.y-t.y)<=st.range).sort((a,b)=>b.d-a.d)[0];if(!target)continue;t.cooldown=st.cooldown;t.angle=Math.atan2(target.y-t.y,target.x-t.x);s.effects.push({x:t.x,y:t.y,tx:target.x,ty:target.y,type:t.type,life:.2});const victims=t.type==='cannon'?s.enemies.filter(e=>e.hp>0&&Math.hypot(e.x-target.x,e.y-target.y)<64):[target];for(const e of victims){e.hp-=st.damage*(t.type==='magic'?1:1-e.armor);if(t.type==='frost')e.slow=2;}}
    s.enemies=s.enemies.filter(e=>{if(e.hp>0)return true;s.gold+=e.reward;s.score+=e.reward*10;s.kills++;return false;});
    if(!s.enemies.length&&!s.queue.length){s.gold+=35+s.wave*3;s.score+=100*s.wave;s.effects=[];s.status=s.wave===15?'won':'ready';if(s.status==='won')s.score+=s.hp*100;}
  }
  const api={W,H,CELL,maps,types,enemies,create,stats,upgradeCost,cell,canBuild,build,upgrade,sell,start,step,spawnEnemy,point,length};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.TD=api;
})(typeof globalThis!=='undefined'?globalThis:this);
