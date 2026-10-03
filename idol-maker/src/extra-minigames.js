// Each activity has its own interaction. The host owns time, pause and cleanup.
export function mountExtraMinigame(type,k){
 const {body,el,button,schedule,sound,result,finish,rand,tier,o,now,setTick,setInput,setKeyUp,setPause,listen}=k;
 const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,n));
 const shuffled=items=>{const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 const meter=()=>{const m=el('p','mini-meter');body.append(m);return m;};
 const board=(name,cls='')=>{const b=el('div',`mini-arena ${cls}`);b.setAttribute('aria-label',name);body.append(b);return b;};
 const feedback=()=>{const f=el('p','mini-feedback','천천히 시작해 봐요.');f.setAttribute('aria-live','polite');body.append(f);return f;};

 function acting(){
  const stories=[
   {title:'길 잃은 강아지를 가족에게 데려다줘요',frames:[['🐶','공원에서 강아지를 만나요'],['🔎','목걸이의 이름표를 살펴봐요'],['☎️','가족에게 연락해요'],['🏡','강아지가 가족과 다시 만나요']]},
   {title:'씨앗이 꽃이 되는 이야기를 만들어요',frames:[['🌱','화분에 씨앗을 심어요'],['💧','매일 물을 줘요'],['🌿','초록 잎이 자라나요'],['🌼','꽃이 활짝 피었어요']]},
   {title:'친구들과 첫 공연을 준비해요',frames:[['📝','멤버들과 곡을 골라요'],['🎤','연습실에서 함께 연습해요'],['🎫','팬들을 공연에 초대해요'],['🌟','무대에서 노래를 들려줘요']]}
  ];
  const story=stories[Math.floor(rand()*stories.length)],frames=tier===0?story.frames.filter((_,i)=>i!==2):story.frames;
  let order=[],selected=null;const status=meter();body.append(el('h3','mini-scene-title',story.title),el('p','mini-guide','장면을 골라 빈 필름 칸에 넣어요. 넣은 장면을 누르면 다시 뺄 수 있어요. 드래그도 가능해요.'));
  const slots=el('div','mini-film'),bank=el('div','mini-film-bank');body.append(slots,bank);const hint=feedback();
  const done=button('🎬 이 순서로 상영하기',()=>{if(order.filter(x=>x!==null).length!==frames.length)return;const correct=order.filter((n,i)=>n===i).length;result(60+40*correct/frames.length,correct===frames.length?'이야기가 자연스럽게 이어져요!':'새로운 순서의 영화가 완성됐어요!');},'mini-primary');body.append(done);
  const bankOrder=shuffled(frames.map((_,i)=>i));order=Array(frames.length).fill(null);
  function put(at){if(selected===null){if(order[at]!==null){selected=order[at];order[at]=null;}}else{const previous=order[at];order[at]=selected;selected=previous;}draw();}
  function draw(){slots.replaceChildren();bank.replaceChildren();status.textContent=`필름 ${order.filter(x=>x!==null).length}/${frames.length}칸 · 정답을 서두르지 않아도 돼요`;done.disabled=order.some(x=>x===null);
   order.forEach((n,i)=>{const b=button(n===null?`${i+1}번 빈 장면`:`${i+1}번 ${frames[n][0]} ${frames[n][1]}`,()=>put(i),'mini-film-slot');b.ondragover=e=>e.preventDefault();b.ondrop=e=>{e.preventDefault();const n=Number(e.dataTransfer.getData('text/plain'));if(bankOrder.includes(n)&&!order.includes(n)){selected=n;put(i);}};slots.append(b);});
   bankOrder.filter(n=>!order.includes(n)).forEach(n=>{const b=button(`${frames[n][0]} ${frames[n][1]}`,()=>{selected=n;hint.textContent='넣고 싶은 필름 칸을 골라 주세요.';draw();},'mini-film-card');b.setAttribute('aria-pressed',String(selected===n));b.draggable=true;b.ondragstart=e=>e.dataTransfer.setData('text/plain',String(n));bank.append(b);});
  }
  setInput(e=>{const n=Number(e.key)-1,available=bankOrder.filter(n=>!order.includes(n));if(available[n]!==undefined){selected=available[n];put(order.indexOf(null));}});draw();
 }

 function variety(){
  const categories=[{name:'동물',words:['🐶 강아지','🐱 고양이','🐰 토끼']},{name:'과일',words:['🍎 사과','🍓 딸기','🍌 바나나']},{name:'악기',words:['🎸 기타','🎺 트럼펫','🥁 북']}];
  const status=meter(),topic=el('h3','mini-scene-title'),grid=el('div','mini-quiz-grid');body.append(topic,grid);const hint=feedback();let round=0,hits=0,left=3,locked=false;const start=now(),duration=o.easy?36000:28000;
  function next(){if(round===4){result(hits/12*100,'오늘의 퀴즈쇼를 마쳤어요!');return;}const cat=categories[round%3];round++;left=3;locked=false;topic.textContent=`제시어: ${cat.name} 세 개를 찾아요!`;grid.replaceChildren();
   const pool=shuffled(categories.flatMap(c=>c.words.map(word=>({word,good:c===cat}))));
   pool.forEach(({word,good},i)=>{const b=button(`${i+1}. ${word}`,()=>{if(locked||b.disabled)return;if(good){b.disabled=true;b.classList.add('found');hits++;left--;sound(660);hint.textContent='딱 맞는 단어예요!';if(!left){locked=true;schedule(500,next);}}else{b.disabled=true;hint.textContent=`이 단어는 ${cat.name}이 아니에요. 다른 단어를 찾아봐요.`;}},'mini-quiz-word');grid.append(b);});
  }
  setInput(e=>{const b=grid.children[Number(e.key)-1];b?.click();});setTick(()=>{const remain=Math.max(0,duration-(now()-start));status.textContent=`${Math.ceil(remain/1000)}초 · 찾은 단어 ${hits}/12`;if(!remain)result(hits/12*100,'퀴즈쇼 끝! 다음에 또 도전해요.');});next();
 }

 function exercise(){
  const status=meter(),arena=board('멀리뛰기 운동장','mini-jump-field'),runner=el('div','mini-jumper','🏃'),mark=el('div','mini-jump-target','🏁');arena.append(runner,mark);
  const gauge=el('div','mini-charge'),zone=el('span','mini-charge-zone'),fill=el('i','mini-charge-fill');gauge.append(zone,fill);body.append(gauge);const hint=feedback();
  let holding=false,charge=0,start=0,round=0,points=0,flying=false;const target=70,width=o.easy?30:24-tier*4;
  zone.style.left=`${target-width/2}%`;zone.style.width=`${width}%`;
  const hold=button('누르고 힘 모으기 · 놓으면 점프!',()=>{},'mini-primary mini-hold');body.append(hold);hold.setAttribute('aria-label','힘 모으기');
  function press(){if(flying||holding)return;holding=true;start=now();hint.textContent='연두 구간에서 손을 떼 보세요!';}
  function release(){if(!holding||flying)return;holding=false;flying=true;hold.disabled=true;round++;const distance=Math.abs(charge-target);points+=distance<=width/2?100:Math.max(20,100-distance*2);runner.style.left=`${12+charge*.65}%`;runner.classList.add('jumping');sound(440+charge*5);hint.textContent=`${round}번째 점프 · ${(charge/20+1).toFixed(1)}m!`;
   schedule(900,()=>{if(round===3){result(points/3,'세 번의 멋진 점프 완료!');return;}flying=false;hold.disabled=false;charge=0;fill.style.width='0%';runner.style.left='12%';runner.classList.remove('jumping');});}
  listen(hold,'pointerdown',e=>{e.preventDefault();hold.setPointerCapture?.(e.pointerId);press();});listen(hold,'pointerup',release);listen(hold,'pointercancel',()=>{holding=false;charge=0;fill.style.width='0%';});
  setInput(e=>{if(e.code==='Space')press();});setKeyUp(e=>{if(e.code==='Space')release();});setPause(()=>{holding=false;charge=0;fill.style.width='0%';});
  setTick(()=>{if(holding){charge=clamp((now()-start)/(o.easy?24:19));fill.style.width=`${charge}%`;if(charge===100)release();}status.textContent=`${Math.min(round+1,3)}/3번째 점프 · Space를 길게 눌렀다 놓아도 돼요`;});
 }

 function beauty(){
  const status=meter(),arena=board('거품 세안 얼굴','mini-wash-face');if(o.renderCharacter){const portrait=el('div','mini-wash-portrait');portrait.innerHTML=o.renderCharacter(o.appearance);arena.append(portrait);}
  const count=8+tier*2,spots=shuffled(Array.from({length:12},(_,i)=>({x:24+(i%4)*17,y:18+Math.floor(i/4)*17}))).slice(0,count),cleared=new Set(),bubbles=[];
  const hint=feedback();hint.textContent='손가락으로 거품을 문지르거나 하나씩 눌러 주세요.';
  function clean(i){if(cleared.has(i))return;cleared.add(i);bubbles[i].classList.add('clean');bubbles[i].disabled=true;sound(650+i*25,.07);status.textContent=`보송보송 ${cleared.size}/${count}`;if(cleared.size===count)schedule(450,()=>finish(80));}
  spots.forEach((spot,i)=>{const b=button('🫧',()=>clean(i),'mini-foam');b.setAttribute('aria-label',`${i+1}번 거품 닦기`);b.style.left=`${spot.x}%`;b.style.top=`${spot.y}%`;bubbles.push(b);arena.append(b);});status.textContent=`보송보송 0/${count}`;
  const rub=e=>{if(e.type==='pointermove'&&!e.buttons)return;const rect=arena.getBoundingClientRect();spots.forEach((spot,i)=>{const x=rect.left+rect.width*spot.x/100,y=rect.top+rect.height*spot.y/100;if(Math.hypot(e.clientX-x,e.clientY-y)<32)clean(i);});};listen(arena,'pointerdown',rub);listen(arena,'pointermove',rub);
 }

 function meal(){
  const groups=[{name:'든든한 곡물',food:['🍚 밥','🍞 빵','🍠 고구마']},{name:'고소한 단백질',food:['🥚 달걀','🫘 콩','🐟 생선']},{name:'알록달록 채소',food:['🥦 브로콜리','🥕 당근','🍅 토마토']}];
  const status=meter(),tray=el('div','mini-bento'),pantry=el('div','mini-pantry');body.append(tray,pantry);const chosen=[null,null,null],slots=[];const hint=feedback();hint.textContent='재료를 골라 도시락을 채워요. 같은 칸의 재료는 언제든 바꿀 수 있어요.';
  const done=button('다섯 친구와 맛있게 먹기',()=>{if(chosen.every(Boolean))finish(80);},'mini-primary');done.disabled=true;body.append(done);
  function put(g,n){chosen[g]=groups[g].food[n];slots[g].textContent=chosen[g];slots[g].classList.add('filled');done.disabled=!chosen.every(Boolean);status.textContent=`도시락 ${chosen.filter(Boolean).length}/3칸`;sound(392+g*100);}
  groups.forEach((group,g)=>{const slot=el('div','mini-bento-slot',group.name);slot.ondragover=e=>e.preventDefault();slot.ondrop=e=>{e.preventDefault();const [a,b]=e.dataTransfer.getData('text/plain').split(':').map(Number);if(a===g&&group.food[b])put(a,b);};slots.push(slot);tray.append(slot);const section=el('section','mini-food-group');section.append(el('h3','',group.name));group.food.forEach((food,n)=>{const b=button(food,()=>put(g,n));b.draggable=true;b.ondragstart=e=>e.dataTransfer.setData('text/plain',`${g}:${n}`);section.append(b);});pantry.append(section);});status.textContent='도시락 0/3칸';
 }

 function rest(){
  const status=meter(),garden=board('구름 쉼터','mini-breath-garden'),cloud=el('div','mini-breath-cloud','☁');garden.append(cloud);const hint=feedback();hint.textContent='구름을 부풀렸다 줄이며 천천히 쉬어 가요.';
  let phase=0,active=false,start=0,round=0;const control=button('☁ 구름 키우기',()=>{if(active)return;active=true;start=now();control.disabled=true;},'mini-primary');body.append(control);
  setTick(()=>{status.textContent=`함께 쉬기 ${round}/3번`;if(!active)return;const progress=clamp((now()-start)/20)/100;cloud.style.transform=`scale(${phase===0?.65+progress*.65:1.3-progress*.65})`;if(progress===1){active=false;phase=1-phase;if(phase===0)round++;if(round===3){status.textContent='함께 쉬기 3/3번';finish(80);return;}control.disabled=false;control.textContent=phase?'☁ 구름 살며시 줄이기':'☁ 구름 다시 키우기';}});
 }

 function play(){
  const icons=['🐶','🐱','🐰','🦊','🐼'].slice(0,3+tier),deck=shuffled([...icons,...icons]),status=meter(),grid=el('div','mini-pairs');body.append(grid);const hint=feedback();let first=null,locked=false,matches=0,turns=0;const cards=[];
  deck.forEach((icon,i)=>{const b=button('★',()=>flip(i),'mini-pair-card');b.setAttribute('aria-label',`${i+1}번 카드 뒤집기`);cards.push(b);grid.append(b);});
  function flip(i){if(locked||cards[i].disabled||i===first)return;cards[i].textContent=deck[i];cards[i].setAttribute('aria-label',`${i+1}번 카드 ${deck[i]}`);cards[i].classList.add('revealed');if(first===null){first=i;return;}const previous=first;first=null;turns++;locked=true;
   if(deck[previous]===deck[i]){matches++;cards[i].disabled=cards[previous].disabled=true;hint.textContent='같은 친구를 찾았어요!';sound(660);schedule(450,()=>{locked=false;if(matches===icons.length)result(Math.max(60,100-(turns-icons.length)*4),'친구 카드를 모두 모았어요!');});}
   else {hint.textContent='위치를 기억해 두고 다시 찾아봐요.';schedule(850,()=>{for(const j of [previous,i]){cards[j].textContent='★';cards[j].setAttribute('aria-label',`${j+1}번 카드 뒤집기`);cards[j].classList.remove('revealed');}locked=false;});}status.textContent=`친구 ${matches}/${icons.length}쌍 · 시간 제한 없음`;
  }status.textContent=`친구 0/${icons.length}쌍 · 시간 제한 없음`;
 }

 function gaming(){
  const status=meter(),arena=board('떨어지는 별 받기','mini-catcher'),basket=el('div','mini-basket','🧺');arena.append(basket);body.append(el('p','mini-guide','바구니를 움직여 별을 받아요. 회색 구름은 피하세요. 화살표·버튼·손가락 끌기로 움직여요.'));
  const hint=feedback();let lane=1,hits=0,stars=0,next=0,drops=[];const start=now(),duration=22000,speed=o.easy?3400:2900-tier*300;
  function move(n){lane=clamp(n,0,2);basket.style.left=`${17+lane*33}%`;}
  const controls=el('div','mini-catcher-controls');['왼쪽 바구니','가운데 바구니','오른쪽 바구니'].forEach((name,i)=>controls.append(button(name,()=>move(i))));body.append(controls);
  const movePointer=e=>{if(e.type==='pointermove'&&!e.buttons)return;const r=arena.getBoundingClientRect();move(Math.floor((e.clientX-r.left)/r.width*3));};listen(arena,'pointerdown',movePointer);listen(arena,'pointermove',movePointer);setInput(e=>{if(e.key==='ArrowLeft')move(lane-1);if(e.key==='ArrowRight')move(lane+1);});move(1);
  setTick(()=>{const t=now()-start;if(t>=duration){result(stars?hits/stars*100:0,'별 바구니 놀이 완료!');return;}if(t>=next&&t<duration-speed){next=t+1050;const good=rand()>.23,column=Math.floor(rand()*3),node=el('div','mini-falling',good?'⭐':'☁');node.style.left=`${17+column*33}%`;arena.append(node);drops.push({node,good,column,born:t});if(good)stars++;}
   drops=drops.filter(drop=>{const p=(t-drop.born)/speed;drop.node.style.top=`${p*86}%`;if(p<1)return true;if(drop.column===lane){if(drop.good){hits++;sound(700);hint.textContent='반짝이는 별을 받았어요!';}else hint.textContent='구름은 다음에 살짝 피해 보아요.';}drop.node.remove();return false;});status.textContent=`${Math.ceil((duration-t)/1000)}초 · 별 ${hits}개`;
  });
 }

 function snack(){
  const status=meter(),arena=board('과일 꼬치 탑','mini-stack'),stick=el('div','mini-stack-stick');arena.append(stick);const hint=feedback();const fruits=['🍓','🍌','🥝','🍊','🍇'];let count=0,points=0,base=50,x=50,fruit=null,locked=false;
  const drop=button('🍓 여기서 과일 놓기 · Space',put,'mini-primary');body.append(drop);
  function spawn(){fruit=el('div','mini-stack-fruit',fruits[count]);fruit.style.top='12px';arena.append(fruit);}
  function put(){if(locked||!fruit)return;locked=true;drop.disabled=true;points+=Math.max(20,100-Math.abs(x-base)*2);base=clamp(x,25,75);fruit.style.left=`${base}%`;fruit.style.top='auto';fruit.style.bottom=`${25+count*38}px`;count++;hint.textContent=Math.abs(x-50)<15?'안정적으로 쌓았어요!':'친구가 살짝 받쳐 줬어요. 다음 과일도 올려 봐요!';sound(440+count*80);fruit=null;schedule(450,()=>{if(count===5){result(points/5,'알록달록 과일 꼬치 완성!');return;}locked=false;drop.disabled=false;spawn();});}
  setInput(e=>{if(e.code==='Space')put();});setTick(()=>{status.textContent=`과일 ${count}/5개 · 아래 과일 위를 노려요`;if(fruit&&!locked){x=50+Math.sin(now()/(o.easy?850:650-tier*90))*38;fruit.style.left=`${x}%`;}});spawn();
 }

 function vacation(){
  const status=meter(),arena=board('해변 보물 지도','mini-beach'),wanted=['🐚','⭐','🦀','🪸'],found=new Set();body.append(el('p','mini-guide','찾을 보물: 조개 🐚 · 별 ⭐ · 게 🦀 · 산호 🪸'));const hint=feedback();const objects=shuffled([...wanted,'🌴','🌺','🌊','🪨','🐟','🍃','☀️','⛱️']);
  const names={'🐚':'조개','⭐':'별','🦀':'게','🪸':'산호','🌴':'야자수','🌺':'꽃','🌊':'파도','🪨':'바위','🐟':'물고기','🍃':'나뭇잎','☀️':'햇님','⛱️':'파라솔'};
  const done=button('📮 여행 엽서 완성하기',()=>{if(found.size===4)finish(80);},'mini-primary');done.disabled=true;body.append(done);
  objects.forEach((icon,i)=>{const b=button(icon,()=>{if(wanted.includes(icon)){found.add(icon);b.disabled=true;b.classList.add('found');hint.textContent=`${names[icon]}를 찾았어요!`;sound(600);done.disabled=found.size!==4;}else hint.textContent=`${names[icon]}도 예쁘네요. 목록의 보물도 찾아봐요!`;status.textContent=`해변 보물 ${found.size}/4개`;},'mini-beach-object');b.style.left=`${12+(i%4)*25}%`;b.style.top=`${20+Math.floor(i/4)*30}%`;b.setAttribute('aria-label',names[icon]);arena.append(b);});status.textContent='해변 보물 0/4개';
 }
 const games={acting,variety,exercise,beauty,meal,rest,play,gaming,snack,vacation};
 games[type]();
}
