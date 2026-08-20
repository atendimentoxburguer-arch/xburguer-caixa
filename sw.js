const APP_VERSION='4.12.9';

self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));

// Mantém o app instalável sem criar cache agressivo.
// Isso evita servir versões antigas enquanto o sistema ainda recebe ajustes.
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method==='GET' && url.origin===self.location.origin){
    event.respondWith(fetch(event.request));
  }
});
