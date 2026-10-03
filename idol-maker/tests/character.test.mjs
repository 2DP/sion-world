import test from 'node:test';
import assert from 'node:assert/strict';
import {characterSVG,escapeHTML} from '../src/character.js';
test('labels are escaped and dynamic colors cannot introduce SVG markup',()=>{
 const attack='\"><script>alert(1)</script>';
 const svg=characterSVG({skin:attack,hair:attack,makeup:{blush:attack,lip:attack}},{label:attack,outfit:{color:attack},shoes:{color:attack},accessory:{color:attack}});
 assert.ok(svg.includes('aria-label="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"'));
 assert.doesNotMatch(svg,/<script|alert\(1\)<\/script>/);
 assert.match(svg,/fill="#ffe0cb"/);
 assert.equal(escapeHTML('&<>"\''),'&amp;&lt;&gt;&quot;&#39;');
});
test('none removes blush and uses a thin natural mouth',()=>{
 const svg=characterSVG({makeup:{blush:'none',lip:'none',sparkle:false}});
 assert.doesNotMatch(svg,/<ellipse cx="55" cy="102"|#efa7b4|#bf7089/);
 assert.match(svg,/stroke="#946b72" stroke-width="1.4"/);
 assert.match(characterSVG({makeup:{blush:'#f0aabb',lip:'#bb6677'}}),/fill="#f0aabb"/);
});
test('four wardrobe styles have distinct clothing geometry independent of SVG IDs',()=>{
 const svgs=['daily','stage','movie','party'].map(style=>characterSVG({}, {outfit:{style,color:'#bbaacc'}}).replace(/idol-\d+/g,'idol-test'));
 assert.equal(new Set(svgs).size,4);
 assert.match(svgs[2],/M68 162H111L118 192H96L90 173L86 192H64Z/);
 assert.match(svgs[3],/131 196Q91 212 51 196/);
 assert.match(svgs[1],/M90 135L93 143L102 143/);
});
