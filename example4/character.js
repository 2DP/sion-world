import {COLORS} from './core.js';

// Shared by the selection screen, village, profile, results and all race lanes.
// Limb classes are the hooks used by the rhythm-input animations.
export function swimmer(color=0, swimming=false, id='avatar', gear=[]) {
  const suit = COLORS[color];
  const hair = ['#674738', '#805035', '#493d46', '#795738', '#473d38'][color];
  const lens = gear.includes('goggles') ? '#c2f8ff' : '#edfaff';
  const label = ['민트', '코랄', '라벤더', '레몬', '하늘색'][color];

  return `<svg class="swimmer ${swimming?'swimming':''}" viewBox="0 0 160 190" aria-label="${label} 원피스 수영복을 입은 귀여운 여자아이 선수" role="img">
    <ellipse cx="80" cy="178" rx="37" ry="6" fill="#233d4612"/>
    <g class="body">
      <g class="hair" fill="${hair}">
        <path d="M40 67 Q18 62 18 85 Q18 103 34 106 Q26 88 44 85Z"/>
        <path d="M120 67 Q142 62 142 85 Q142 103 126 106 Q134 88 116 85Z"/>
      </g>
      <g fill="${suit}" stroke="#fff4e8" stroke-width="2">
        <path d="M29 76 Q17 63 18 78 Q18 91 29 82 Q40 92 40 78 Q40 67 29 76Z"/>
        <path d="M131 76 Q119 63 120 78 Q120 91 131 82 Q142 92 142 78 Q142 67 131 76Z"/>
      </g>
      <g class="limb limb-q"><path d="M55 108 Q35 105 28 127" fill="none" stroke="#f6c6a3" stroke-width="13" stroke-linecap="round"/></g>
      <g class="limb limb-o"><path d="M105 108 Q125 105 132 127" fill="none" stroke="#f6c6a3" stroke-width="13" stroke-linecap="round"/></g>
      <g class="limb limb-w">
        <path d="M66 139 L63 166" stroke="#f6c6a3" stroke-width="14" stroke-linecap="round"/>
        ${gear.includes('fins')?'<path d="M55 159 Q34 180 65 177 L71 160" fill="#ffca5f"/>':''}
      </g>
      <g class="limb limb-p">
        <path d="M94 139 L97 166" stroke="#f6c6a3" stroke-width="14" stroke-linecap="round"/>
        ${gear.includes('fins')?'<path d="M89 160 L94 177 Q125 180 105 159" fill="#ffca5f"/>':''}
      </g>
      <path d="M58 94 L70 94 Q80 101 90 94 L102 94 L107 138 Q99 146 91 145 L80 137 L69 145 Q61 146 53 138Z" fill="${suit}"/>
      <path d="M62 98 Q80 111 98 98" fill="none" stroke="#fff7eb" stroke-width="5" stroke-linecap="round"/>
      <path d="M58 126 Q80 132 102 126" fill="none" stroke="#fff7eb" stroke-width="3" opacity=".85"/>
      <g fill="#fffaf1" opacity=".88"><circle cx="63" cy="117" r="2"/><circle cx="97" cy="117" r="2"/><circle cx="66" cy="135" r="2"/><circle cx="95" cy="135" r="2"/></g>
      ${gear.includes('suit')?'<path d="M80 107 l3 6 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1Z" fill="#fff9d7"/>':'<path d="M80 112 C72 104 70 117 80 122 C90 117 88 104 80 112Z" fill="#fff7ec"/>'}
      <circle cx="37" cy="65" r="8" fill="#f6c6a3"/>
      <circle cx="123" cy="65" r="8" fill="#f6c6a3"/>
      <ellipse cx="80" cy="61" rx="43" ry="41" fill="#f9d0af"/>
      <path d="M37 52 Q34 23 80 22 Q124 24 123 54 L115 62 111 42 Q104 55 88 52 L91 40 Q78 56 61 51 L65 40 Q52 52 44 48 L44 64Z" fill="${hair}"/>
      <path d="M35 43 Q34 9 80 9 Q126 9 125 43 Q80 29 35 43Z" fill="${suit}"/>
      <path d="M48 27 Q64 16 86 19" fill="none" stroke="white" stroke-width="5" stroke-linecap="round" opacity=".55"/>
      <path d="M37 60 L123 60" stroke="#477c7e" stroke-width="4"/>
      <rect x="43" y="51" width="31" height="25" rx="11" fill="${lens}" fill-opacity=".72" stroke="#477c7e" stroke-width="3"/>
      <rect x="86" y="51" width="31" height="25" rx="11" fill="${lens}" fill-opacity=".72" stroke="#477c7e" stroke-width="3"/>
      <path d="M74 61 Q80 56 86 61" fill="none" stroke="#477c7e" stroke-width="3"/>
      <g fill="#483b39">
        <ellipse cx="60" cy="64" rx="4.5" ry="6"/>
        <ellipse cx="100" cy="64" rx="4.5" ry="6"/>
      </g>
      <g fill="white"><circle cx="61.5" cy="61.5" r="1.7"/><circle cx="101.5" cy="61.5" r="1.7"/></g>
      <path d="M55 60 L52 57 M105 60 L108 57" stroke="#483b39" stroke-width="2" stroke-linecap="round"/>
      <ellipse cx="49" cy="79" rx="8" ry="4.5" fill="#ed9d9c" opacity=".65"/>
      <ellipse cx="111" cy="79" rx="8" ry="4.5" fill="#ed9d9c" opacity=".65"/>
      <path d="M74 80 Q80 89 87 80" fill="#d88382" stroke="#ad6d63" stroke-width="2" stroke-linecap="round"/>
      ${gear.includes('cap')?'<path d="M105 23 l3 6 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1Z" fill="#fffbe8"/>':'<g fill="#fff7ed"><circle cx="106" cy="27" r="4"/><circle cx="100" cy="31" r="4"/><circle cx="112" cy="31" r="4"/><circle cx="103" cy="36" r="4"/><circle cx="109" cy="36" r="4"/></g><circle cx="106" cy="32" r="3" fill="#f4cd68"/>'}
    </g>
  </svg>`;
}
