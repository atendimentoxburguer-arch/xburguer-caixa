const APP_VERSION='4.13.2';

self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));

// Mantém o app instalável sem cache agressivo.
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method==='GET' && url.origin===self.location.origin){
    event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>fetch(event.request)));
  }
});
