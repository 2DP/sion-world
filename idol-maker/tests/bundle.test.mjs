import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {buildBundle} from '../build.mjs';

const root=new URL('../',import.meta.url);
const bundle=await readFile(new URL('game.bundle.js',root),'utf8');
function boot(protocol){
 const links=[],app={innerHTML:'',addEventListener(){},querySelectorAll(){return [];}};
 const navigator={};
 if(protocol==='file:'){
  for(const key of ['locks','serviceWorker'])Object.defineProperty(navigator,key,{get(){throw Error(`file boot accessed ${key}`);}});
 }
 const document={
  querySelector:()=>app,addEventListener(){},
  documentElement:{classList:{toggle(){}}},
  createElement:()=>({}),head:{append:link=>links.push(link)}
 };
 vm.runInNewContext(bundle,{document,navigator,location:{protocol},window:{addEventListener(){}},console},{timeout:2000});
 return {html:app.innerHTML,links};
}
test('shipped classic bundle is current and parses without module loading',async()=>{
 assert.equal(bundle.replace(/\r\n/g,'\n'),await buildBundle(),'Run npm run build after editing src/*.js.');
 assert.doesNotThrow(()=>new vm.Script(bundle));
});
test('file launch renders the real start screen without manifest, service worker or locks',()=>{
 const output=boot('file:');
 assert.match(output.html,/새로운 이야기 시작하기/);
 assert.match(output.html,/로컬 파일로 실행 중/);
 assert.match(output.html,/게임 폴더의 파일로 바로 실행 중/);
 assert.equal(output.links.length,0);
});
test('HTTP launch renders the same game and enables its app manifest',()=>{
 const output=boot('http:');
 assert.match(output.html,/새로운 이야기 시작하기/);
 assert.doesNotMatch(output.html,/로컬 파일로 실행 중/);
 assert.equal(output.links.length,1);
 assert.equal(output.links[0].rel,'manifest');
 assert.equal(output.links[0].href,'./manifest.webmanifest');
});
test('HTML can load as a local file without requesting modules or a manifest',async()=>{
 const html=await readFile(new URL('index.html',root),'utf8');
 assert.match(html,/<script defer src="\.\/game\.bundle\.js"><\/script>/);
 assert.doesNotMatch(html,/type=["']module["']|rel=["']manifest["']|crossorigin=/);
});
