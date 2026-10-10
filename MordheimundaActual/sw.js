const CACHE='mordheimunda-v110-187';
const PRECACHE=['/','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(PRECACHE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',event=>{
  const r=event.request; if(r.method!=='GET')return;
  const u=new URL(r.url); if(u.origin!==location.origin||u.pathname.startsWith('/api/'))return;
  // Network-first for everything same-origin: always try to get the latest
  // deployed file first, and only fall back to the cached copy when the
  // network is unavailable (offline support). This avoids ever serving a
  // stale asset after a deploy, without needing a manual hard refresh.
  event.respondWith(
    fetch(r).then(res=>{
      const copy=res.clone();
      caches.open(CACHE).then(c=>c.put(r,copy));
      return res;
    }).catch(()=>caches.match(r).then(cached=>cached||(r.mode==='navigate'?caches.match('/'):undefined)))
  );
});
