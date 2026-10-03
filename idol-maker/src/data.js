export const SKILLS={vocal:'노래',dance:'춤',acting:'연기',variety:'예능감',charm:'매력'};
export const STAGES=['연습생','데뷔','인기 아이돌','톱스타','월드스타'];
export const SCALE_NAMES=['연습실','데뷔 무대','중형 무대','대형 무대','월드 무대'];
export const MEMBER_STORIES={
 나래:'동네 합창단에서 노래하던 친구. 오늘도 다섯 목소리가 어울리는 화음을 찾고 있어요.',
 루아:'학교 댄스 모임에서 시작한 춤꾼. 어려운 안무를 기억하기 쉬운 동작으로 나눠 줘요.',
 소미:'작은 연극 무대를 좋아하는 배우. 촬영 전에는 친구들의 대사를 함께 읽어 줘요.',
 유리:'친구들 앞에서 이야기하기를 좋아해요. 인터뷰와 팬 소식을 밝게 전하는 진행자예요.'
};
export const PERSONALITY_LINES={steady:'준비물을 확인했어. 한 걸음씩 같이 가자!',sparkle:'먼저 인사해 볼까? 오늘도 반짝이는 하루야!',kind:'네 이야기도 듣고 싶어. 우리 같이 쉬어 가자!',curious:'오늘은 새로운 표현을 해 볼래. 어떤 소리가 날까?'};
export const EVERYDAY_EVENTS=[
 {id:'rain',title:'빗소리로 만든 박자',text:'창문을 두드리는 빗방울에 루아가 살짝 발을 맞춰요.',choices:[{text:'새로운 스텝 만들기',effect:'춤 경험치 +8',skill:'dance',amount:8},{text:'빗소리 들으며 쉬기',effect:'그룹 스트레스 −8',stress:-8}]},
 {id:'script',title:'소미의 작은 연극',text:'소미가 합창 연습실을 작은 영화관처럼 꾸몄어요. 오늘의 주인공은 누구일까요?',choices:[{text:'주인공 대사 읽기',effect:'연기 경험치 +8',skill:'acting',amount:8},{text:'소미에게 따뜻한 감상 전하기',effect:'예능감 경험치 +8',skill:'variety',amount:8}]},
 {id:'ribbon',title:'우리만의 무대 리본',text:'유리가 남은 리본으로 다섯 친구의 마이크를 꾸미자고 해요.',choices:[{text:'색을 골라 꾸미기',effect:'매력 경험치 +8',skill:'charm',amount:8},{text:'만드는 과정을 이야기로 소개하기',effect:'예능감 경험치 +8',skill:'variety',amount:8}]},
 {id:'trainer',title:'보라 선생님의 호흡 수업',text:'보컬 트레이너 보라가 말해요. “소리를 크게 내기보다 편하게 숨을 쉬어 보자.”',choices:[{text:'한 소절 천천히 불러 보기',effect:'노래 경험치 +8',skill:'vocal',amount:8},{text:'오늘의 조언을 적으며 쉬기',effect:'그룹 스트레스 −8',stress:-8}]},
 {id:'mirror',title:'거울 앞 다섯 발자국',text:'댄스 트레이너 도윤이 친구들과 발을 맞추는 놀이를 준비했어요.',choices:[{text:'동작을 하나씩 맞추기',effect:'춤 경험치 +8',skill:'dance',amount:8},{text:'모두의 응원 구호 만들기',effect:'예능감 경험치 +8',skill:'variety',amount:8}]},
 {id:'picnic',title:'숙소 옥상의 작은 소풍',text:'매니저 다온이 과일 바구니를 들고 왔어요. 잠깐 바람을 쐬러 가 볼까요?',choices:[{text:'친구들과 간식 나누기',effect:'그룹 스트레스 −10',stress:-10},{text:'노을을 보며 노래 흥얼거리기',effect:'노래 경험치 +8',skill:'vocal',amount:8}]},
 {id:'fanletter',stage:1,title:'첫 손글씨 응원 편지',text:'“오늘 무대를 보고 용기가 생겼어요.” 팬의 편지가 연습실에 도착했어요.',choices:[{text:'다 같이 감사 인사 남기기',effect:'그룹 팬 +30',fans:30},{text:'짧은 답장 영상 만들기',effect:'SNS 팔로워 +30',followers:30}]},
 {id:'prop',stage:1,title:'영화 소품의 작은 비밀',text:'소미가 낡은 모자 하나로 탐정과 여행자를 번갈아 연기해요.',choices:[{text:'새 배역으로 한 장면 해 보기',effect:'연기 경험치 +8',skill:'acting',amount:8},{text:'소품을 어울리게 꾸며 주기',effect:'매력 경험치 +8',skill:'charm',amount:8}]},
 {id:'encore',stage:2,title:'팬들이 고른 앙코르',text:'팬들이 다시 듣고 싶은 노래와 보고 싶은 춤 이야기를 보내 주었어요.',choices:[{text:'따뜻한 노래로 답하기',effect:'노래 경험치 +8 · 그룹 팬 +30',skill:'vocal',amount:8,fans:30},{text:'신나는 춤으로 답하기',effect:'춤 경험치 +8 · 그룹 팬 +30',skill:'dance',amount:8,fans:30}]}
];
export const PERSONALITIES=[{id:'steady',name:'차근차근',description:'훈련 능력 경험치 +1'},{id:'sparkle',name:'반짝반짝',description:'공개 활동 경험치 +2'},{id:'kind',name:'다정다정',description:'휴식 스트레스 감소 +2'},{id:'curious',name:'호기심 가득',description:'하루 첫 창작·촬영 능력 경험치 +2'}];
const a=(id,name,icon,place,skill,energy,xp,range,stress,extra={})=>({id,name,icon,place,skill,energy,xp,range,stress,cost:0,description:`${name}으로 우리만의 하루를 만들어요.`,...extra});
export const ACTIVITIES=[
 ...['vocal','dance','acting','variety'].map((s,i)=>a(s,`${SKILLS[s]} 기본 연습`,['🎤','💃','🎬','🎙️'][i],'practice',s,8,15,[16,24],3,{training:true})),
 a('choreo','안무 만들기','🧠','practice','dance',8,15,[16,24],3,{training:true}),a('lesson','전문 수업','📚','practice','vocal',10,20,[26,34],4,{cost:40,training:true}),
 a('exercise','즐거운 운동','🏃','practice','charm',10,15,[18,26],-4),a('beauty','피부관리','🫧','home','charm',5,10,[14,20],-6),a('makeup','화장 꾸미기','🎨','home','charm',5,10,[18,18],-6),a('meal','균형 식사','🥗','home','charm',-10,5,[8,8],-10),
 ...[['rest','숙소에서 쉬기','☁️',-25,-20],['play','멤버와 놀기','🧸',-15,-25],['gaming','함께 게임하기','🎮',-15,-25],['snack','간식 먹기','🍓',-15,-15],['vacation','하루 휴가','🏖️',-100,-50]].map(([id,n,i,e,s])=>a(id,n,i,'home',null,e,0,[0,0],s)),
 a('audition','데뷔 오디션','🌟','agency','vocal',20,30,[8,8],6),a('agency','대형 소속사 오디션','🏢','agency','vocal',20,30,[16,16],6),
 a('stream','연습 영상·라이브','📱','studio','vocal',8,15,[10,10],4,{public:true,money:[30,60],fans:[10,30],followers:[20,50]}),
 a('broadcast','음악 방송','📺','stage','vocal',16,25,[10,10],4,{public:true,money:[60,100],fans:[50,100],followers:[30,70]}),
 ...[['variety','예능 방송'],['interview','인터뷰']].map(([id,n])=>a(id==='variety'?'varietyshow':id,n,'🎙️','studio','variety',14,25,[18,18],4,{public:true,money:[60,100],fans:[40,90],followers:[50,100]})),
 a('eventshow','행사 무대','🎪','stage','vocal',16,25,[18,18],5,{public:true,money:[70,120],fans:[30,70],followers:[10,40]}),a('advert','광고 촬영','📸','studio','charm',16,25,[18,18],4,{public:true,money:[100,180],fans:[30,60],followers:[50,100]}),
 ...[['concert','콘서트'],['tour','도시 투어']].map(([id,n])=>a(id,n,'🎟️','stage','vocal',20,40,[20,20],6,{public:true,cost:300,money:[600,1200],fans:[200,500],followers:[100,200]})),
 a('casting','무료 영화 캐스팅','📋','studio','acting',10,15,[10,10],3),
 a('movie','영화 촬영','🎬','studio','acting',18,25,[22,22],5,{project:3,money:[300,700],fans:[150,350],followers:[100,250],audience:[5000,20000]}),
 a('album','음원 작업','🎵','studio','vocal',14,20,[18,18],3,{project:2,cost:100,money:[120,250],fans:[100,200],followers:[50,120],streams:[1000,5000]}),
 a('song','자작곡 작업','🎼','studio','vocal',12,25,[22,22],3,{project:3,cost:100,money:[120,250],fans:[100,200],followers:[50,120],streams:[1000,5000]}),
 a('overseas','해외에 우리 소개하기','🌏','agency','vocal',10,25,[16,16],2,{public:true})
];
const colors=['#b9a3e3','#99d9cc','#a9d5ef','#f6df9e','#e9aec6','#a6bcec'];
export const ITEMS=[...['lavender','mint','cream'].map((c,i)=>({id:`starter-${c}`,name:['라벤더 첫걸음','민트 산책','크림 구름'][i],type:'outfit',color:i===2?'#f6df9e':colors[i],price:0,style:'daily'})),...Array.from({length:24},(_,i)=>({id:`outfit-${i+1}`,name:`${['구름','별빛','바다','꽃잎','달빛','무지개'][i%6]} ${['산책복','무대복','촬영복','축제복'][Math.floor(i/6)]}`,type:'outfit',color:colors[i%6],price:80+Math.floor(i/6)*60,style:['daily','stage','movie','party'][Math.floor(i/6)]})),...['shoes','accessory'].flatMap((type)=>Array.from({length:6},(_,i)=>({id:`${type}-${i+1}`,name:`${['민트','라벤더','크림','하늘','장미','별빛'][i]} ${type==='shoes'?'신발':'장식'}`,type,color:colors[i],price:80+i*40,style:'daily'}))),...['vocal','dance','acting','variety'].flatMap((skill)=>[1,2,3].map(tier=>({id:`${skill}-equipment-${tier}`,name:`${SKILLS[skill]} 연습 장비 ${tier}`,type:'equipment',skill,tier,price:[150,400,900][tier-1],color:'#b9a3e3',style:'equipment'})))];
