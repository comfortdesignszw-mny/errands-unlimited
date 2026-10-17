/* Offline-first: app shell is served from cache instantly, then refreshed in the background. API calls are never cached. */
const C='eu-v4',ROOT=new URL('./',self.location).href;
const A=['styles.css','app.js','manifest.json','icon-192.png','icon-512.png'].map(f=>new URL(f,ROOT).href);
const clean=async r=>r.redirected?new Response(await r.blob(),{status:200,statusText:'OK',headers:r.headers}):r;
self.addEventListener('install',e=>e.waitUntil((async()=>{const c=await caches.open(C);
for(const u of [ROOT,...A]){try{const r=await fetch(u,{cache:'reload'});if(r.ok)await c.put(u,await clean(r))}catch(_){}}self.skipWaiting()})()));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>clients.claim())));
self.addEventListener('fetch',e=>{const q=e.request,u=new URL(q.url);if(q.method!=='GET'||u.pathname.startsWith('/api/')||u.origin!==location.origin)return;
if(q.mode==='navigate'){e.respondWith(caches.open(C).then(async c=>{const r=await c.match(ROOT);const n=fetch(ROOT).then(clean).then(x=>{if(x.ok)c.put(ROOT,x.clone());return x}).catch(()=>r||new Response('Offline',{status:503}));return r||n}));return}
e.respondWith(caches.open(C).then(async c=>{const r=await c.match(q,{ignoreSearch:true});const n=fetch(q).then(x=>{if(x.ok)c.put(q,x.clone());return x}).catch(()=>r);return r||n}))});
