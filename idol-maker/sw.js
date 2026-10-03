const CACHE='idol-maker-assets-v3';
const FILES=['./','./index.html','./styles.css','./src/minigames.css','./manifest.webmanifest','./assets/icon.svg','./assets/preview.svg','./game.bundle.js'];
const urls=FILES.map(f=>new URL(f,self.registration.scope).href);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(urls))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('idol-maker-assets-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||!event.request.url.startsWith(self.registration.scope))return;
  event.respondWith((async()=>{const cache=await caches.open(CACHE);const url=new URL(event.request.url);url.search='';
    if(['localhost','127.0.0.1','[::1]'].includes(url.hostname)){try{const fresh=await fetch(event.request);if(fresh.ok&&urls.includes(url.href))await cache.put(url.href,fresh.clone());return fresh;}catch{}}
    const cached=await cache.match(url.href);if(cached)return cached;try{return await fetch(event.request);}catch{return new Response('오프라인 준비가 필요해요. 연결된 상태에서 게임을 한 번 열어 주세요.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}})());
});
self.addEventListener('message',event=>{if(event.data?.type==='READY')event.waitUntil((async()=>{const cache=await caches.open(CACHE);const ready=(await Promise.all(urls.map(u=>cache.match(u)))).every(Boolean);event.ports[0]?.postMessage({ready});})());});
