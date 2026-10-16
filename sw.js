/* v2: fixes ERR_FAILED on hosts (Cloudflare) that redirect /index.html -> / .
   Browsers refuse a service worker answering a navigation with a redirected response. */
const C='eu-v2',ROOT=new URL('./',self.location).href;
const A=['styles.css','app.js','manifest.json','icon-192.png','icon-512.png'].map(f=>new URL(f,ROOT).href);
const clean=async r=>r.redirected?new Response(await r.blob(),{status:200,statusText:'OK',headers:r.headers}):r;
self.addEventListener('install',e=>e.waitUntil((async()=>{
  const c=await caches.open(C);
  for(const u of [ROOT,...A]){try{const r=await fetch(u,{cache:'reload'});if(r.ok)await c.put(u,await clean(r))}catch(_){}}
  self.skipWaiting()})()));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>clients.claim())));
self.addEventListener('fetch',e=>{
  const q=e.request;if(q.method!=='GET')return;
  if(q.mode==='navigate'){ // always answer app navigations with the cached shell (works offline, never a redirect)
    e.respondWith(caches.match(ROOT).then(r=>r||fetch(ROOT).then(clean)).catch(()=>new Response('Offline',{status:503})));return}
  e.respondWith(caches.match(q,{ignoreSearch:true}).then(r=>r||fetch(q).then(async n=>{if(n.ok&&new URL(q.url).origin===location.origin){const c=await caches.open(C);c.put(q,n.clone())}return n})));
});
