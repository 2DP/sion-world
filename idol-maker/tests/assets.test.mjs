import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
test('offline cache includes every module import and all initial local assets',async()=>{
 const sw=await readFile(new URL('sw.js',root),'utf8');
 const paths=[...sw.matchAll(/'\.\/([^']+)'/g)].map(m=>m[1]);
 for(const p of paths){await access(new URL(p,root));if(p.endsWith('.js')){const source=await readFile(new URL(p,root),'utf8');for(const m of source.matchAll(/from ['"](\.\/[^'"]+)['"]/g)){const target=new URL(m[1],new URL(p,root));assert.ok(paths.includes(target.href.slice(root.href.length)),`${p} import ${m[1]} missing`);}}}
 const html=await readFile(new URL('index.html',root),'utf8');
 for(const [,p] of html.matchAll(/(?:src|href)="\.\/([^"]+)"/g))assert.ok(paths.includes(p),`${p} is not cached`);
 assert.match(sw,/startsWith\(self.registration.scope\)/);
 assert.doesNotMatch(sw,/skipWaiting|localStorage\.clear/);
});
