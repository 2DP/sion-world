const {test}=require('node:test');const assert=require('node:assert/strict');const E=require('../engine.js');
for(let map=0;map<3;map++)for(const difficulty of ['easy','normal'])test(`전체 15웨이브 클리어 가능: 지도 ${map+1} / ${difficulty}`,()=>{
  const s=E.create(map,difficulty);
  for(let wave=1;wave<=15;wave++){
    const spots=[];
    for(let y=24;y<E.H;y+=48)for(let x=24;x<E.W;x+=48)if(E.canBuild(s,x,y)){
      let coverage=0;for(let d=80;d<E.length(E.maps[map].path);d+=24){const p=E.point(E.maps[map].path,d);if(Math.hypot(p.x-x,p.y-y)<150)coverage++;}spots.push({x,y,coverage});
    }
    spots.sort((a,b)=>b.coverage-a.coverage);
    while(s.gold>=52){
      const up=s.towers.filter(t=>t.level<3&&E.upgradeCost(t)<=s.gold).sort((a,b)=>a.level-b.level)[0];
      if(up){E.upgrade(s,up.id);continue;}
      const p=spots.find(p=>E.canBuild(s,p.x,p.y));if(!p)break;
      const type=['arrow','arrow','magic','frost','cannon'][s.towers.length%5];if(!E.build(s,type,p.x,p.y))break;
    }
    assert.ok(E.start(s));for(let i=0;i<12000&&s.status==='running';i++)E.step(s,1/30);
    assert.notEqual(s.status,'lost');assert.notEqual(s.status,'running');
  }
  assert.equal(s.status,'won');assert.ok(s.hp>0);assert.ok(s.score>0);
});
