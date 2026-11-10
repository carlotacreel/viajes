// Guarda la app en el teléfono para que abra sin internet.
const V="viajes-v3";
const SHELL=["./","./index.html","./runtime-stub.js","./runtime.js","./firebase-config.js","./mundo.js","./manifest.webmanifest","./icon-192.png","./icon-512.png",
"https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js","https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);if(e.request.method!=="GET")return;
  if(/firestore\.googleapis|identitytoolkit|securetoken|googleapis\.com\/(identity|token)/.test(u.href))return;
  const cacheable=u.origin===location.origin||/gstatic\.com\/firebasejs|fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare|cdn\.jsdelivr/.test(u.href);
  if(!cacheable)return;
  // Archivos propios: primero internet (siempre la versión nueva) y, sin señal, la copia guardada.
  if(u.origin===location.origin){e.respondWith(caches.open(V).then(c=>fetch(e.request,{cache:"no-cache"}).then(r=>{if(r.ok)c.put(e.request,r.clone());return r}).catch(()=>c.match(e.request,{ignoreSearch:true}))));return}
  e.respondWith(caches.open(V).then(async c=>{const hit=await c.match(e.request);const net=fetch(e.request).then(r=>{if(r.ok)c.put(e.request,r.clone());return r}).catch(()=>hit);return hit||net}));
});
