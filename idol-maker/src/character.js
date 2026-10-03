let serial = 0;
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const color = (v, fallback) => /^#[\da-f]{3,8}$/i.test(v || '') && [4,5,7,9].includes(v.length) ? v : fallback;
const palette = id => /mint|green/.test(id || '') ? '#9ddcc9' : /cream|yellow|gold/.test(id || '') ? '#f4d991' : /pink|rose/.test(id || '') ? '#efabc4' : /blue|sky/.test(id || '') ? '#9ec9ee' : '#b9a4e5';
export function characterSVG(a = {}, opts = {}) {
 const skin=color(a.skin,'#ffe0cb'), hair=color(a.hair,'#6c4e69'), cloth=color(opts.outfit?.color,palette(a.outfit)), shoe=color(opts.shoes?.color,palette(a.shoes)), accent=color(opts.accessory?.color,'#ffe5a2'), blush=color(a.makeup?.blush,'#efa7b4'), lip=color(a.makeup?.lip,'#bf7089'),iris=color(a.eyeColor,'#a697cf');
 const style=String(opts.outfit?.style || a.outfit || ''), accessory=String(opts.accessory?.style || a.accessory || 'bow'), pose=opts.pose || 'idle', id=`idol-${++serial}`, smile=a.eyes==='smile'||pose==='rest';
 const pants=/pants|sport|casual|street|movie/.test(style), dress=/dress|princess|gown|party/.test(style), stage=/stage/.test(style), noLip=a.makeup?.lip==='none';
 // Skin and sleeve share the same shoulder pivot, including animated poses.
 const arm=(side,angle)=>`<g data-arm="${side}" transform="${side==='right'?'translate(64 136)':'translate(116 136) scale(-1 1)'} rotate(${angle})"><path d="M-8 12Q-9 24-13 32Q-16 39-11 42Q-5 44-2 37L6 14Z" fill="${skin}"/><path d="M-9 23L-6 24M-3 36L-3 39" fill="none" opacity=".25"/><path data-sleeve="${side}" d="M-6-5Q-15-1-14 10L-12 18Q-4 23 5 17L7 1Q3-4-6-5Z" fill="${cloth}"/><path d="M-6-5Q-15-1-14 10L-12 18Q-4 23 5 17L7 1Q3-4-6-5Z" fill="url(#${id}-fabric)" stroke="none"/><path d="M-9 1Q-12 7-8 12M2 2Q-1 9 2 12" fill="none" opacity=".25"/><path d="M-12 17Q-4 22 5 16" fill="none" stroke="#fff8f0" stroke-width="3"/></g>`;
 const skirtPath=`M69 160H111L${dress?'131 196Q91 212 51 196':'124 185Q90 197 56 185'}Z`;
 // Closed silhouettes keep the hair full; long interior curves describe its flow.
 const hairLock=d=>`<g data-hair-lock="true"><path d="${d}" fill="${hair}" stroke="${hair}" stroke-width=".85"/><path d="${d}" fill="url(#${id}-shade)" stroke="none"/></g>`;
 const mirroredLocks=paths=>paths.map(hairLock).join('')+`<g transform="translate(180 0) scale(-1 1)">${paths.map(hairLock).join('')}</g>`;
 const hairStyle=['long','bob','twin','pony','short','bun','wavy'].includes(a.hairStyle)?a.hairStyle:'long';
 const crownStart='M39 74C34 43 53 20 89 20C124 18 146 41 141 74';
 const backEnds={
  long:'C141 106 147 133 146 154Q132 168 111 162Q90 168 69 162Q48 168 34 154C33 133 39 106 39 74Z',
  bob:'C146 96 148 114 134 122Q116 132 90 125Q64 132 46 122C32 114 34 96 39 74Z',
  wavy:'C143 92 153 113 145 134Q139 147 146 156Q129 172 110 162Q90 169 70 162Q51 172 34 156Q41 147 35 134C27 113 37 92 39 74Z',
  short:'Q148 98 133 110Q110 119 90 115Q70 119 47 110Q32 98 39 74Z'
 };
 const backHair=hairLock(crownStart+(backEnds[hairStyle]||backEnds.short));
 const hairExtras=hairStyle==='twin'?mirroredLocks(['M43 89C28 87 20 105 24 125Q28 143 24 154Q38 161 49 147C59 132 52 108 48 95Z'])
  :hairStyle==='pony'?hairLock('M133 57C153 49 165 64 163 83C163 103 150 116 157 138Q141 140 134 123C127 105 142 88 132 74Z')
  :hairStyle==='bun'?mirroredLocks(['M46 45C26 48 23 31 30 23C39 13 55 21 56 32Q57 42 46 45Z']):'';
 const crownPath='M40 73C35 44 54 21 89 21C124 19 145 42 140 73L130 64Q112 48 90 49Q65 49 50 66Z';
 const fringePaths={
  straight:'M46 45Q90 35 134 45L135 67Q127 71 118 67L117 64Q107 71 96 68L95 65Q82 72 70 68L70 65Q58 71 45 66Z',
  side:'M45 46Q84 30 131 43L135 68Q125 71 118 64L112 54Q99 68 81 71L84 63Q67 74 47 70Z',
  curtain:'M46 46Q89 29 134 46L136 72Q111 72 91 49Q72 74 44 72Z',
  open:'M44 46Q90 29 136 46L136 66Q126 55 114 53Q88 48 65 55Q52 58 43 68Z'
 };
 const fringeUnderlay=hairLock(fringePaths[a.bangs]||fringePaths.side);
 const fringeLines=a.bangs==='straight'?'M59 43Q57 56 60 65M76 40Q74 55 77 65M94 40Q91 54 94 65M111 41Q110 54 114 63M126 46L129 63'
  :a.bangs==='curtain'?'M84 39Q74 58 53 65M98 39Q108 58 128 65'
  :a.bangs==='open'?'M57 42Q75 32 87 34M98 34Q118 36 129 51'
  :'M102 39Q88 59 62 65M116 44Q120 58 129 63';
 const fringe=`<path d="${fringeLines}" fill="none" stroke="#fff0dc" stroke-width="1" opacity=".17"/>`;
 const backStrands=hairStyle==='long'?'M44 79C40 104 43 132 42 151M52 96Q54 135 58 155M136 79C140 104 137 132 138 151M128 96Q126 135 122 155'
  :hairStyle==='wavy'?'M43 79C37 106 49 123 42 151M53 102Q65 135 55 157M137 79C143 106 131 123 138 151M127 102Q115 135 125 157'
  :hairStyle==='bob'?'M41 77Q33 109 48 119M49 91Q44 112 58 121M139 77Q147 109 132 119M131 91Q136 112 122 121'
  :hairStyle==='twin'?'M37 98C26 114 40 138 31 150M143 98C154 114 140 138 149 150'
  :hairStyle==='pony'?'M147 65C165 81 141 108 148 129'
  :hairStyle==='bun'?'M33 26Q27 40 45 41M147 26Q153 40 135 41':'';
 const sideLocks=mirroredLocks([
  'M43 60C35 75 36 94 45 108Q42 94 47 81L52 66Z'
 ]);
 // A broad cheek curve and a shallow chin replace the previous face geometry.
 const faceOutline=a.faceShape==='oval'
  ? 'M49 60C51 37 129 37 131 60C134 74 135 85 133 98C130 115 110 124 90 125C70 124 50 115 47 98C45 85 46 74 49 60Z'
  :a.faceShape==='heart'
  ? 'M47 61C48 35 132 35 133 61C136 74 140 87 137 98C134 109 112 120 90 127C68 120 46 109 43 98C40 87 44 74 47 61Z'
  : 'M47 61C48 35 132 35 133 61C136 73 140 86 138 98C136 113 114 123 90 124C66 123 44 113 42 98C40 86 44 73 47 61Z';
 const eye=cx=>`<g data-feature="eye" transform="translate(${cx} 89)${a.eyes==='calm'?' scale(1 .76)':''}"><path d="M-10 0C-10-8-6-13 0-13C6-13 10-8 10 0C10 8 6 13 0 13C-6 13-10 8-10 0Z" fill="#fff9ef" stroke="none"/><ellipse cy=".5" rx="7.2" ry="11.6" fill="url(#${id}-iris)" stroke="none"/><ellipse cy="-2" rx="3.3" ry="7.3" fill="#533c32" stroke="none"/><path d="M-9-3C-8-12 3-16 9-6" fill="none" stroke="#74564b" stroke-width="1.8"/><path d="M-4 8Q0 11 4 8" fill="none" stroke="#ffdeb0" stroke-width="1.8" opacity=".45"/><ellipse cx="-2.7" cy="-6.4" rx="1.9" ry="2.5" fill="#fffaf3" stroke="none"/><circle cx="3" cy="3" r=".9" fill="#fffaf3" stroke="none"/>${a.eyes==='star'?'<path d="M0-4L1.2-.8L4 0L1.2 1L0 4L-1.2 1L-4 0L-1.2-.8Z" fill="#fff1be" stroke="none"/>':''}</g>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 240" class="idol-character" role="img" aria-label="${escapeHTML(opts.label || '사랑스러운 아이돌')}"${opts.mini?' data-mini="true"':''}><defs>
 <linearGradient id="${id}-shade" x2=".15" y2="1"><stop stop-color="#fff1db" stop-opacity=".16"/><stop offset=".45" stop-color="#fff1db" stop-opacity=".03"/><stop offset="1" stop-color="#372a46" stop-opacity=".1"/></linearGradient>
 <linearGradient id="${id}-fabric" x2=".3" y2="1"><stop stop-color="#fff" stop-opacity=".38"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#826884" stop-opacity=".16"/></linearGradient>
 ${a.makeup?.blush==='none'?'':`<radialGradient id="${id}-cheek"><stop stop-color="${blush}" stop-opacity=".55"/><stop offset="1" stop-color="${blush}" stop-opacity="0"/></radialGradient>`}
 <linearGradient id="${id}-iris" x2="0" y2="1"><stop stop-color="#654837"/><stop offset=".62" stop-color="${iris}"/><stop offset="1" stop-color="#d9b889"/></linearGradient>
 <pattern id="${id}-check" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M0 0H5V10H0ZM0 0H10V5H0Z" fill="#fff8ef" opacity=".25"/></pattern>
 <pattern id="${id}-dots" width="13" height="12" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="2" fill="#fffaf4" opacity=".85"/></pattern>
 <clipPath id="${id}-skirt"><path d="${skirtPath}"/></clipPath>
 </defs><ellipse cx="90" cy="229" rx="31" ry="5" fill="#9b7e91" opacity=".12"/><g stroke="#806671" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">
 <g data-layer="back-hair" transform="translate(25.2 1.3) scale(.72)">
 ${hairExtras}
 ${backHair}
 <path d="${backStrands}" fill="none" stroke="#fff0dc" stroke-width="1.1" opacity=".18"/>
 </g>
 <g data-layer="body" transform="translate(9 -65.8) scale(.9 1.3)">
 <path d="M74 184L74 212Q80 218 86 212L88 186M96 186L97 212Q104 218 110 212L111 184" fill="${skin}"/>
 <path d="M74 190H87L86 211H74ZM97 190H111L110 211H97Z" fill="#fff9ef"/><path d="M75 194H85M99 194H109" stroke="${cloth}" stroke-width="2"/>
 <path d="M74 207L86 207L87 219Q78 225 65 220Q64 213 73 212ZM97 207L110 207L110 212Q120 214 119 220Q107 225 97 219Z" fill="${shoe}"/><path d="M74 209Q80 213 85 209M99 209Q104 213 109 209M69 220H86M99 220H117" fill="none" stroke="#fff9ef" stroke-width="2"/><circle cx="79" cy="211" r="1.2" fill="${accent}"/><circle cx="104" cy="211" r="1.2" fill="${accent}"/>
 <path d="M74 124Q90 120 106 124L119 132L110 148L111 170H68L71 148L61 132Z" fill="${cloth}"/><path d="M74 124Q90 120 106 124L119 132L110 148L111 170H68L71 148L61 132Z" fill="url(#${id}-fabric)" stroke="none"/><path d="M79 119L79 128Q89 138 101 128L101 119" fill="${skin}"/>
 ${pants?`<path d="M72 128L78 128L80 147H101L103 128H109L107 165H73Z" fill="#fff8f0"/><path d="M80 149H101V158H80Z" fill="${cloth}"/><path d="M82 151V157M99 151V157" stroke="#fff8f0"/><circle cx="77" cy="137" r="1.5" fill="${accent}"/><circle cx="104" cy="137" r="1.5" fill="${accent}"/>`:stage?`<path d="M68 127L81 140L75 148L64 133M112 127L99 140L105 148L116 133" fill="${accent}"/><path d="M90 135L93 143L102 143L95 149L97 157L90 152L83 157L85 149L78 143L87 143Z" fill="#fff8f0"/>`:dress?`<path d="M72 129Q90 145 109 129L107 139Q90 152 73 139Z" fill="#fff8f0"/><path d="M90 145Q74 135 78 150Q80 158 90 148Q104 158 104 147Q106 137 90 145Z" fill="${accent}"/>`:`<path d="M74 125L89 134Q83 147 76 140L69 130ZM106 125L91 134Q97 147 104 140L111 130Z" fill="#fff8f0"/><path d="M90 136Q77 128 79 139Q80 146 90 138Q100 146 101 139Q104 128 90 136Z" fill="${accent}"/><path d="M87 139L84 146L89 145M93 139L96 146L91 145" fill="${accent}"/><path d="M90 144V158" fill="none" opacity=".25"/><circle cx="90" cy="149" r="1.2" fill="#fff8f0"/><circle cx="90" cy="155" r="1.2" fill="#fff8f0"/>`}
 ${pants?`<path d="M68 162H111L118 192H96L90 173L86 192H64Z" fill="${cloth}"/><path d="M90 173V167"/>`:`<path d="M69 160H111L${dress?'131 196Q91 212 51 196':'124 185Q90 197 56 185'}Z" fill="${cloth}"/><path d="M77 166L72 185M90 165V188M102 166L108 185" opacity=".45"/><path d="M58 183Q89 196 122 183" fill="none" stroke="#fff8f0" stroke-width="4"/>`}
 ${pants?'':`<g clip-path="url(#${id}-skirt)" stroke="none"><path d="${skirtPath}" fill="url(#${id}-fabric)"/>${stage?'':`<path d="${skirtPath}" fill="url(#${id}-${dress?'dots':'check'})"/>`}</g><path d="M77 166Q74 176 73 183M90 166V186M102 166Q105 176 107 183" fill="none" stroke="#fffaf5" opacity=".38"/>`}
 <path d="M72 145L74 157M108 145L106 157" fill="none" opacity=".25"/><path d="M69 161H111" stroke="#fff8f0" stroke-width="3"/><circle cx="90" cy="161" r="2" fill="${accent}"/>
 ${stage?'<g fill="#fff8f0" stroke="none"><path d="M72 171L74 175L78 177L74 179L72 183L70 179L66 177L70 175ZM109 171L111 175L115 177L111 179L109 183L107 179L103 177L107 175Z"/><circle cx="90" cy="179" r="3"/></g>':''}
 ${arm('right',pose==='wave'?110:pose==='sing'?80:pose==='dance'?75:0)}${arm('left',pose==='dance'?75:0)}
 ${pose==='sing'?'<g transform="translate(34 140) rotate(-12)"><rect x="-3" y="-12" width="7" height="24" rx="3" fill="#8f82ba"/><ellipse cy="-13" rx="8" ry="10" fill="#e1daef"/><path d="M-5-16H5M-5-12H5" opacity=".5"/></g>':''}
 </g>
 <g data-layer="face" transform="translate(25.2 1.3) scale(.72)">
 <g data-feature="face-outline"><path d="${faceOutline}" fill="${skin}" stroke="#b18d7d" stroke-width="1.35"/><path d="${faceOutline}" fill="#fff9ec" opacity=".12" stroke="none"/></g>
 <g data-layer="front-hair">${hairLock(crownPath)}${fringeUnderlay}${fringe}<path d="M51 48Q65 33 81 33M97 32Q119 36 130 51M57 51Q65 40 74 37M110 39Q118 44 123 51" fill="none" stroke="#fff0dc" stroke-width="1" opacity=".18"/></g>
 <path data-feature="brows" d="${a.brows==='straight'?'M62 72H74M106 72H118':a.brows==='up'?'M62 74Q67 70 74 71M106 71Q113 70 118 74':'M62 73Q68 69 74 72M106 72Q112 69 118 73'}" fill="none" stroke="${hair}" stroke-width="1.5" opacity=".7"/>
 ${smile?'<path data-feature="smiling-eyes" d="M60 90Q68 81 76 90M104 90Q112 81 120 90" fill="none" stroke="#74564b" stroke-width="2"/>':`${eye(68)}${eye(112)}`}
 ${a.glasses==='round'?'<g fill="none" stroke="#807092" stroke-width="2.5"><circle cx="68" cy="87" r="15"/><circle cx="112" cy="87" r="15"/><path d="M83 86Q90 80 97 86M53 86L43 82M127 86L137 82"/></g>':a.glasses==='square'?'<g fill="none" stroke="#807092" stroke-width="2.5"><rect x="52" y="74" width="32" height="27" rx="6"/><rect x="96" y="74" width="32" height="27" rx="6"/><path d="M84 85H96M52 84L43 81M128 84L137 81"/></g>':''}
 ${a.freckles?'<g fill="#ae795c" stroke="none"><circle cx="54" cy="103" r="1"/><circle cx="59" cy="105" r="1"/><circle cx="64" cy="103" r="1"/><circle cx="116" cy="103" r="1"/><circle cx="121" cy="105" r="1"/><circle cx="126" cy="103" r="1"/></g>':''}
 ${a.makeup?.blush==='none'?'':`<g data-feature="blush" fill="${blush}" stroke="none"><ellipse cx="59" cy="105" rx="8.5" ry="4.5" opacity=".17"/><ellipse cx="121" cy="105" rx="8.5" ry="4.5" opacity=".17"/></g><g fill="url(#${id}-cheek)" stroke="none"><ellipse cx="59" cy="105" rx="11" ry="7.5"/><ellipse cx="121" cy="105" rx="11" ry="7.5"/></g>`}<circle data-feature="nose" cx="90" cy="100" r=".65" fill="#b18d7d" stroke="none" opacity=".35"/>
 ${pose==='sing'||a.mouth==='grin'?`<g data-feature="open-mouth"><path d="M86 110C86 105 94 105 94 110C95 117 85 117 86 110Z" fill="${noLip?'#946b72':lip}" stroke="${noLip?'#946b72':lip}" stroke-width="1"/><path d="M88 113Q90 111 92 113" fill="none" stroke="#ffd2c4" stroke-width="1.3"/></g>`:`<path data-feature="mouth" d="${a.mouth==='small'?'M88.5 110Q90 111 91.5 110':'M87.5 109.5Q90 112.5 93 109.5'}" fill="none" stroke="${noLip?'#946b72':lip}" stroke-width="${noLip?'1.4':'1.6'}"/>`}
 <g data-layer="side-locks">${sideLocks}<path d="M42 75Q40 85 44 96M138 75Q140 85 136 96" fill="none" stroke="#fff0dc" stroke-width=".8" opacity=".23"/></g>
 ${/none/.test(accessory)?'':/crown|tiara/.test(accessory)?`<path d="M70 29L66 13L81 22L90 6L100 22L115 13L111 29Z" fill="${accent}"/><circle cx="90" cy="21" r="3" fill="#fff"/>`:/star|pin|clip/.test(accessory)?`<path d="M125 41L128 49L137 49L130 55L133 64L125 59L118 64L120 55L113 49L122 49Z" fill="${accent}"/>`:`<path d="M119 43Q101 27 104 46Q101 63 120 51Q140 62 137 44Q141 28 122 42Z" fill="${accent}"/><circle cx="121" cy="46" r="5" fill="#fff4d6"/>`}
 ${a.makeup?.sparkle?'<path d="M47 107L49 102L51 107L56 109L51 111L49 116L47 111L42 109Z" fill="#fff" stroke="none"/>':''}
 </g>
 </g></svg>`;
}
export function backgroundSVG(place='practice') {
 const stage=place==='stage',home=place==='home',agency=place==='agency',studio=place==='studio';
 const plant=(x,y)=>`<g transform="translate(${x} ${y})"><path d="M-22 0H22L16 45H-16Z" fill="#e4b9b0"/><path d="M0 0V-65M0-22Q-46-61-29-70Q2-68 0-22M0-40Q28-88 42-67Q40-42 0-40" fill="#96c8ac" stroke="#6d9e85" stroke-width="3"/></g>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${stage?'반짝이는 공연 무대':home?'포근한 숙소':agency?'밝은 소속사':studio?'영화 촬영장':'햇살 가득한 연습실'}"><defs><linearGradient id="room-${place.replace(/[^a-z]/g,'')}" x2="0" y2="1"><stop stop-color="${stage?'#4a386e':'#eee6f8'}"/><stop offset="1" stop-color="${stage?'#746493':'#fff7eb'}"/></linearGradient></defs><path fill="${stage?'#50436e':'#eee6f8'}" d="M0 0H1000V560H0Z"/><path d="M0 380H1000V560H0Z" fill="${stage?'#8b7aaa':'#e6cdb7'}"/><path d="M0 390H1000M0 450H1000M0 520H1000M150 390L60 560M370 390L340 560M630 390L660 560M850 390L940 560" stroke="${stage?'#ad9fc5':'#d5b9a3'}" stroke-width="2"/>
 ${stage?`<path d="M0 0H1000V52Q750 100 500 48Q250 100 0 52Z" fill="#aa85bf"/><path d="M0 0H140Q110 190 58 360H0ZM1000 0H860Q890 190 942 360H1000Z" fill="#9974ae"/><path d="M180 25L80 410H410ZM820 25L590 410H920Z" fill="#fff0bb" opacity=".12"/><g fill="#fff0b9">${[210,355,500,645,790].map((x,i)=>`<path transform="translate(${x} ${90+i%2*55})" d="M0-14L4-4L15 0L4 4L0 15L-4 4L-15 0L-4-4Z"/>`).join('')}</g>`:home?`<path d="M80 330V140A90 90 0 0 1 260 140V330Z" fill="#c3e4e7" stroke="#fffaf3" stroke-width="15"/><path d="M170 55V330M84 205H258" stroke="#fffaf3" stroke-width="8"/><path d="M310 313Q310 288 342 288H677Q710 288 710 313V407H310Z" fill="#bda9d6"/><rect x="292" y="340" width="435" height="76" rx="24" fill="#c9b9de"/><rect x="351" y="297" width="95" height="67" rx="18" fill="#f6dfb0"/><rect x="567" y="297" width="95" height="67" rx="18" fill="#a9d9cd"/><path d="M803 180H935V367H803Z" fill="#ceb295"/><path d="M810 235H927M810 300H927" stroke="#fff1dc" stroke-width="6"/>${[0,1,2,3,4].map(i=>`<rect x="${818+i*20}" y="${190+i%2*7}" width="15" height="39" rx="2" fill="${['#d4c2e4','#aacfc2','#f1d7a4'][i%3]}"/>`).join('')}${plant(85,366)}`:agency?`<rect x="68" y="78" width="215" height="238" rx="26" fill="#d2e9e2" stroke="#fffaf3" stroke-width="10"/><circle cx="176" cy="167" r="45" fill="#fff0ba"/><path d="M122 274L176 210L237 274" fill="#b6a5d3"/><rect x="365" y="251" width="350" height="154" rx="20" fill="#c6afda"/><path d="M350 257H729" stroke="#fff7e9" stroke-width="16"/><rect x="491" y="195" width="90" height="54" rx="6" fill="#8e84aa"/><path d="M520 249V258" stroke="#8e84aa" stroke-width="7"/><rect x="785" y="100" width="130" height="147" rx="12" fill="#fff2d4"/><path d="M849 128L859 157L890 158L866 178L873 210L849 192L824 210L832 178L808 158L839 157Z" fill="#c4acd9"/>${plant(831,373)}${plant(181,386)}`:studio?`<path d="M170 60H788V377H170Z" fill="#c1b5d7"/><path d="M211 85H748V377H211Z" fill="#dbeadf"/><circle cx="480" cy="177" r="65" fill="#fff1c8"/><path d="M211 377L353 260L460 330L587 242L748 377" fill="#a5cbbb"/><path d="M96 146V405M54 407L96 337L138 407M890 146V405M848 407L890 337L932 407" fill="none" stroke="#81738f" stroke-width="8"/><path d="M55 90H137V160H55ZM849 90H931V160H849Z" fill="#fff2b9" stroke="#a391ae" stroke-width="9"/><path d="M780 300V464M746 469L780 390L814 469" stroke="#766a85" stroke-width="7" fill="none"/><rect x="741" y="254" width="78" height="54" rx="8" fill="#8c7d9d"/><path d="M819 267L850 253V309L819 293" fill="#786b87"/><circle cx="758" cy="246" r="20" fill="#ad9bbc"/><circle cx="800" cy="244" r="23" fill="#ad9bbc"/>`:`<rect x="107" y="58" width="590" height="283" rx="16" fill="#dce7ef" stroke="#fcf8f2" stroke-width="12"/><path d="M120 323L405 67H485L207 323M520 325L684 162V212L570 325" fill="#fff" opacity=".36"/><path d="M305 65V334M503 65V334" stroke="#c2c8db" stroke-width="5"/><path d="M80 278H729M116 279V385M683 279V385" stroke="#b89487" stroke-width="9" stroke-linecap="round"/><rect x="794" y="228" width="92" height="158" rx="13" fill="#9b8eb1"/><circle cx="840" cy="332" r="30" fill="#776b91"/><circle cx="840" cy="263" r="15" fill="#c7bddb"/><circle cx="840" cy="332" r="12" fill="#b7accd"/><path d="M756 386V199M733 391L756 363L780 391" stroke="#8b7a9f" stroke-width="5" fill="none"/><rect x="749" y="174" width="14" height="37" rx="7" fill="#b5a5c9"/>${plant(936,364)}`}
 <g fill="#fff" opacity=".65"><circle cx="44" cy="58" r="3"/><circle cx="954" cy="204" r="4"/><path d="M931 40L935 50L945 54L935 58L931 68L927 58L917 54L927 50Z"/></g></svg>`;
}
