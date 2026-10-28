// Layout selection preserves the existing audio graph and all deck controls.
const profiles = {
  studio: ['STUDIO 01', '균형 잡힌 기본 배치 · 한 줄 퍼포먼스 패드'],
  club: ['CLUB 02', '대형 조그 · 2열 패드 · 클럽 플레이 배치'],
  battle: ['BATTLE 03', '상단 퍼포먼스 패드 · 턴테이블 중심 스크래치 배치']
};
const guides = [
  ['[data-action="play"][data-deck="0"]', 'A 덱 ▶ 재생', '이 버튼을 눌러 첫 곡을 재생하세요.'],
  ['#cross', '중앙 아래 CROSSFADER', '손잡이를 좌우로 움직이세요.'],
  ['[data-action="monitor"][data-deck="1"], #output', 'B 채널 ♫ CUE → 출력', 'CUE를 켠 뒤 출력에서 CUE 미리 듣기를 선택하세요.'],
  ['#tempo-0, #jog-0', 'A 덱 TEMPO / 조그', 'TEMPO를 움직이거나 조그 테두리를 드래그하세요.'],
  ['[data-control="low"][data-deck="0"]', '믹서 A LOW', '노브를 아래로 드래그해 저음을 줄이세요.'],
  ['[data-action="loop"][data-deck="0"], [data-padmode="hot"][data-deck="0"], [data-pad="0"][data-deck="0"]', 'A 덱 LOOP / HOT CUE', 'LOOP를 켜거나 HOT CUE 모드에서 1번 패드를 누르세요.'],
  ['#fx-on, #fx-depth', 'BEAT FX의 ON / DEPTH', 'ON을 켜고 DEPTH로 효과의 양을 조절하세요.'],
  ['#jog-0, [data-action="vinyl"][data-deck="0"], [data-action="play"][data-deck="0"]', 'A 덱 조그휠 안쪽', 'VINYL과 재생을 켜고 원판 안쪽을 앞뒤로 드래그하세요.']
];
let targets = [], focusTarget = null;
const bubble = document.createElement('div');
bubble.className = 'academy-pointer'; bubble.hidden = true; bubble.id = 'academy-pointer';
document.body.append(bubble);
function placeGuide() {
  if (!focusTarget || bubble.hidden) return;
  const r = focusTarget.getBoundingClientRect();
  bubble.style.left = `${Math.max(8, Math.min(innerWidth - bubble.offsetWidth - 8, r.left + r.width / 2 - bubble.offsetWidth / 2))}px`;
  const above = r.top - bubble.offsetHeight - 12;
  bubble.style.top = `${Math.max(8, Math.min(innerHeight - bubble.offsetHeight - 8, above > 8 ? above : r.bottom + 12))}px`;
  bubble.style.visibility = r.bottom < 0 || r.top > innerHeight ? 'hidden' : 'visible';
}
export function locateGuide() {
  if (!focusTarget) return;
  focusTarget.scrollIntoView({behavior: 'instant', block:'center', inline:'nearest'});
  const control = focusTarget.matches('button,input,select,[tabindex]') ? focusTarget : focusTarget.querySelector('input,button');
  control?.focus({preventScroll:true}); placeGuide();
}
export function highlightLesson(index, done = false) {
  for (const node of targets) { node.classList.remove('academy-target'); node.removeAttribute('aria-describedby'); }
  targets = []; focusTarget = null; bubble.hidden = true;
  if (index == null || done) return;
  const [selector, title, hint] = guides[index];
  for (const node of selector.split(',').flatMap(part => [...document.querySelectorAll(part.trim())])) {
    const visible = node.closest('.rotary') || node;
    visible.classList.add('academy-target'); visible.setAttribute('aria-describedby', bubble.id); targets.push(visible);
  }
  focusTarget = targets[0]; bubble.textContent = `${index + 1} · ${title} — ${hint}`;
  bubble.hidden = false; requestAnimationFrame(placeGuide);
}
export function setupControllers() {
  const bar = document.createElement('section'); bar.className = 'controller-selector';
  bar.setAttribute('aria-label','컨트롤러 선택');
  bar.innerHTML = `<div><span class="eyebrow">CHOOSE YOUR CONTROLLER</span><p id="controller-description"></p></div><div class="controller-options">${Object.entries(profiles).map(([id,p])=>`<button data-controller="${id}" aria-pressed="false">${p[0]}</button>`).join('')}</div>`;
  document.querySelector('.wave-rack').before(bar);
  const select = id => {
    if (!profiles[id]) id = 'studio';
    document.body.dataset.controller = id;
    document.querySelector('#controller-description').textContent = profiles[id][1];
    bar.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.controller===id)));
    try { localStorage.setItem('mixroom.controller',id); } catch {}
    requestAnimationFrame(placeGuide);
  };
  bar.addEventListener('click',e=>{const b=e.target.closest('[data-controller]');if(b)select(b.dataset.controller);});
  let initial = 'studio'; try { initial = localStorage.getItem('mixroom.controller') || initial; } catch {}
  select(initial);
}
addEventListener('resize',placeGuide);
addEventListener('scroll',placeGuide,true);
