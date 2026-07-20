// Pokemon Card Tracker service worker.
// Strategy: network-first for pages/config (so updates land immediately),
// cache-first for images and logos (fast + offline), never cache sheet CSVs
// beyond a session fallback.
const VERSION = 'shell-v3';
// Keep downloaded card art across shell releases. Browser storage quotas still
// apply, so the user agent may evict older images when space is constrained.
const IMAGE_CACHE = 'card-images-v1';
const SHELL = ['./', 'index.html', 'tracker.html', 'sets.js', 'lib.js', 'manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== VERSION && k !== IMAGE_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()));
});

async function cacheFirstImage(request){
  const cache=await caches.open(IMAGE_CACHE);
  const hit=await cache.match(request);
  if(hit) return hit;
  try{
    const response=await fetch(request);
    // Cross-origin <img> responses are commonly opaque (status 0), but
    // the Cache API can safely store and replay them for the same URL.
    if(response.ok || response.type==='opaque'){
      await cache.put(request,response.clone());
    }
    return response;
  }catch(error){
    console.warn('Card image request failed; trying the next image candidate.',error);
    return Response.error();
  }
}

async function networkFirst(request,url){
  try{
    const response=await fetch(request);
    if(response.ok && url.origin===location.origin){
      const cache=await caches.open(VERSION);
      await cache.put(request,response.clone());
    }
    return response;
  }catch(error){
    console.warn('Network request failed; using the offline cache.',error);
    return caches.match(request);
  }
}

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  const isImage=/\.(png|jpg|jpeg|webp|svg)$/.test(url.pathname);
  event.respondWith(isImage ? cacheFirstImage(event.request) : networkFirst(event.request,url));
});
