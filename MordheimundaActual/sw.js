const CACHE='mordheimunda-v110-481';
const PRECACHE=['/','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(PRECACHE)).then(()=>self.skipWaiting()))});
// V-OFFLINE: public read-only content (rules, catalog, scenarios, maps…) is
// the same for everyone; it is kept so the rules stay readable with a weak
// signal. Account data, admin and writes are never cached.
const API_CACHE='mordheimunda-api-v1';
const API_PUBLIC=/^\/api\/(rules\/(overrides|nav-groups)|catalog\/|scenarios$|deployment-maps$|quests$|trophies$|warbands\/official$|home$|rule-images\/)/;
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k!==API_CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',event=>{
  const r=event.request; if(r.method!=='GET')return;
  const u=new URL(r.url); if(u.origin!==location.origin)return;
  if(u.pathname.startsWith('/api/')){
    if(!API_PUBLIC.test(u.pathname))return;
    event.respondWith(fetch(r).then(res=>{if(res.ok){const copy=res.clone();caches.open(API_CACHE).then(c=>c.put(r,copy))}return res}).catch(()=>caches.open(API_CACHE).then(c=>c.match(r)).then(hit=>hit||Response.error())));
    return;
  }
  // V-FASTLOAD: a file asked for with its build version (?v=…) never
  // changes under that URL (every deploy bumps it), so it is served from the
  // cache at once — no waiting on a weak signal — and fetched only once.
  if(u.searchParams.has('v')&&/^\/(assets|data)\//.test(u.pathname)){
    event.respondWith(caches.open(CACHE).then(c=>c.match(r).then(hit=>hit||fetch(r).then(res=>{if(res.ok)c.put(r,res.clone());return res}))));
    return;
  }
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
