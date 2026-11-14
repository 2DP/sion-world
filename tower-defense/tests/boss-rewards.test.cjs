const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

function setup(difficulty='normal',type='boss') {
  const s=E.create(0,difficulty);
  const tower=E.build(s,'magic',120,24);
  E.start(s);s.queue=['basic'];s.spawn=100;
  const boss=E.spawnEnemy(s,type);boss.d=144;
  return {s,tower,boss};
}
function hit(s,tower,boss,targetHp){
  boss.hp=targetHp+E.stats(tower).damage;tower.cooldown=0;
  E.step(s,.01);
}
test('네 난이도에서 보스 HP 구간을 실제 공격으로 넘으면 25 G씩 한 번 지급',()=>{
  for(const difficulty of Object.keys(E.difficulties)){
    const {s,tower,boss}=setup(difficulty);const gold=s.gold;
    hit(s,tower,boss,boss.maxHp*.75+1);assert.equal(s.gold,gold);
    for(const [i,threshold]of [.75,.5,.25].entries()){
      hit(s,tower,boss,boss.maxHp*threshold);
      assert.equal(s.gold,gold+(i+1)*25);
      E.step(s,.01);assert.equal(s.gold,gold+(i+1)*25);
      assert.equal(s.kills,0);assert.equal(s.score,0);
    }
    assert.ok(s.effects.some(e=>e.type==='coin'&&e.amount===25));
  }
});
test('한 번에 여러 구간을 넘거나 처치해도 남은 보상만 지급',()=>{
  const {s,tower,boss}=setup();const gold=s.gold;
  hit(s,tower,boss,boss.maxHp*.2);assert.equal(s.gold,gold+75);
  hit(s,tower,boss,0);assert.equal(s.gold,gold+175);assert.equal(s.kills,1);
  E.step(s,.01);assert.equal(s.gold,gold+175);
  const other=setup();const initial=other.s.gold;
  hit(other.s,other.tower,other.boss,-1);assert.equal(other.s.gold,initial+175);
});
test('보스가 탈출해도 이미 받은 구간 보상은 유지하고 처치 보상은 지급하지 않음',()=>{
  const {s,tower,boss}=setup();const gold=s.gold;
  hit(s,tower,boss,boss.maxHp*.5);boss.d=E.length(E.maps[0].path)-.01;
  E.step(s,.1);assert.equal(s.gold,gold+50);assert.equal(s.kills,0);assert.equal(s.hp,15);
});
test('일반 몬스터에는 HP 구간 보상을 지급하지 않음',()=>{
  const {s,tower,boss}=setup('normal','armor');const gold=s.gold;
  hit(s,tower,boss,boss.maxHp*.2);assert.equal(s.gold,gold);
});
