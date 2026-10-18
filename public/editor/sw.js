const CACHE='showpiece-shell-v2';
const FILES=['/','/index.html','/style.css','/app.js','/engine.js','/timeline.js','/narration.js','/storage.js','/icon.svg','/app.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(fetch(e.request).catch(()=>caches.match(e.request).then(r=>r||new Response('Offline',{status:503}))));});
