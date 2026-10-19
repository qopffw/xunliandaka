/* Service Worker：跨域不拦截 + 网络优先 + 限时回退缓存 */
const CACHE='v202610191453';
const PRECACHE=['./index.html','./data.json','./manifest.webmanifest','./icon.svg','./html2canvas.min.js'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PRECACHE).catch(()=>{})).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});
self.addEventListener('message',e=>{
  if (e.data && e.data.type==='SKIP_WAITING') self.skipWaiting();
});
function timedFetch(req,ms){
  return new Promise((res,rej)=>{ const t=setTimeout(()=>rej(new Error('timeout')),ms);
    fetch(req).then(r=>{clearTimeout(t);res(r);}).catch(e=>{clearTimeout(t);rej(e);}); });
}
self.addEventListener('fetch',e=>{
  const req=e.request, url=new URL(req.url);
  if(req.method!=='GET') return;
  if(url.origin!==location.origin) return;              // 跨域（含远程数据源）：一律放行
  if(url.pathname.endsWith('/data.json')){              // 数据：网络优先，失败回退缓存
    e.respondWith(timedFetch(req,8000).then(r=>{
      const cp=r.clone(); caches.open(CACHE).then(c=>c.put(req,cp)); return r;
    }).catch(()=>caches.match(req)));
    return;
  }
  if(req.mode==='navigate'||url.pathname==='/'||url.pathname.endsWith('/index.html')){
    e.respondWith(timedFetch(req,4000).catch(()=>caches.match('./index.html')));  // 网络优先：避免永远看到旧页面
    return;
  }
  e.respondWith(caches.match(req).then(c=>{
    const net=timedFetch(req,8000).then(r=>{
      const cp=r.clone(); caches.open(CACHE).then(cc=>cc.put(req,cp)); return r;
    }).catch(()=>c);
    return c||net;
  }));
});
