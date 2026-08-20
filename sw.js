const APP_VERSION='4.14.0';
const CACHE_NAME=`xburguer-caixa-${APP_VERSION}`;

self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(name=>name.startsWith('xburguer-caixa-')&&name!==CACHE_NAME).map(name=>caches.delete(name)));
  await self.clients.claim();
})()));

// Rede primeiro, cache somente como segurança quando a conexão cair.
self.addEventListener('fetch',event=>{
  const request=event.request;
  const url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;

  event.respondWith((async()=>{
    try{
      const response=await fetch(request,{cache:'no-store'});
      if(response&&response.ok){
        const cache=await caches.open(CACHE_NAME);
        cache.put(request,response.clone()).catch(()=>{});
      }
      return response;
    }catch{
      const cached=await caches.match(request);
      if(cached)return cached;
      if(request.mode==='navigate'){
        const fallback=await caches.match('./')||await caches.match('./index.html');
        if(fallback)return fallback;
      }
      throw new Error('Sem conexão e recurso não disponível no cache.');
    }
  })());
});
