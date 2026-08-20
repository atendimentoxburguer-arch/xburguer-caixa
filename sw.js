const APP_VERSION='4.14.2';
const CACHE_NAME=`xburguer-caixa-${APP_VERSION}`;
const CORE_ASSETS=[
  './','./index.html','./manifest.webmanifest',
  './style1.css','./style2.css','./style3.css','./style4.css','./style5.css',
  './responsive.css','./responsive-polish.css','./mobile-menu-hotfix.css','./mobile-readable.css',
  './currency-format.css','./page-transitions.css','./login-transitions.css','./system-final.css','./version.css',
  './shell1.js','./shell2.js','./shell3.js','./shell4.js','./shell5.js','./shell6.js','./shell7.js','./shell8.js','./shell-end.js',
  './logo1.js','./logo2.js','./logo3.js','./logo4.js','./logo5.js','./logo-end.js',
  './app1.js','./app2.js','./app3.js','./app4.js','./system-hardening.js','./app5.js','./system-guard.js',
  './realtime.js','./mobile-menu-fix.js','./currency-format.js','./pwa.js',
  './icons/xburguer-app-192-v4132.png','./icons/xburguer-app-512-v4140.png'
];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await Promise.allSettled(CORE_ASSETS.map(async asset=>{
      try{
        const response=await fetch(asset,{cache:'reload'});
        if(response.ok)await cache.put(asset,response);
      }catch{}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(name=>name.startsWith('xburguer-caixa-')&&name!==CACHE_NAME).map(name=>caches.delete(name)));
  await self.clients.claim();
})()));

// Rede primeiro; cache somente como segurança quando a conexão cair.
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
      const cached=await caches.match(request,{ignoreSearch:true});
      if(cached)return cached;
      if(request.mode==='navigate'){
        const fallback=await caches.match('./index.html',{ignoreSearch:true})||await caches.match('./',{ignoreSearch:true});
        if(fallback)return fallback;
      }
      return new Response('Recurso indisponível sem conexão.',{status:503,statusText:'Offline'});
    }
  })());
});
