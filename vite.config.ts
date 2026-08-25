import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

function makeBuildVersion(){
 const now=new Date();
 const date=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('.');
 const bytes=new Uint8Array(6);
 globalThis.crypto.getRandomValues(bytes);
 const hash=Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('').slice(0,8);
 return `${date}-${hash}`;
}

function serviceWorkerSource(buildVersion:string){
 return `const BUILD_VERSION=${JSON.stringify(buildVersion)};
const APP_CACHE_PREFIX='techtree-htde-';
const CACHE_NAME=APP_CACHE_PREFIX+BUILD_VERSION;
const APP_SHELL=['/','/index.html','/manifest.webmanifest','/icon.svg','/build-meta.json'];
const VERSIONED_ASSET_RE=/^\\/assets\\/.+-[A-Za-z0-9_-]{8,}\\.(?:js|css|png|jpg|jpeg|svg|webp|woff2?)$/;

self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).catch(()=>undefined).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(APP_CACHE_PREFIX)&&key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

self.addEventListener('message',event=>{
 if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
});

self.addEventListener('fetch',event=>{
 const {request}=event;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 if(url.pathname==='/sw.js')return;
 if(request.mode==='navigate'||request.destination==='document'||url.pathname==='/'||url.pathname.endsWith('.html')){
  event.respondWith(networkFirst(request,'/index.html'));
  return;
 }
 if(VERSIONED_ASSET_RE.test(url.pathname)){
  event.respondWith(cacheFirst(request));
  return;
 }
 event.respondWith(staleWhileRevalidate(request));
});

async function networkFirst(request,fallbackUrl){
 const cache=await caches.open(CACHE_NAME);
 try{
  const response=await fetch(new Request(request,{cache:'no-store'}));
  if(response.ok)await cache.put(request,response.clone());
  return response;
 }catch{
  return await cache.match(request)||await cache.match(fallbackUrl)||Response.error();
 }
}

async function cacheFirst(request){
 const cache=await caches.open(CACHE_NAME);
 const cached=await cache.match(request);
 if(cached)return cached;
 const response=await fetch(request);
 if(response.ok)await cache.put(request,response.clone());
 return response;
}

async function staleWhileRevalidate(request){
 const cache=await caches.open(CACHE_NAME);
 const cached=await cache.match(request);
 const fresh=fetch(request).then(response=>{
  if(response.ok)cache.put(request,response.clone());
  return response;
 }).catch(()=>undefined);
 return cached||await fresh||Response.error();
}
`;
}

const buildVersion=makeBuildVersion();

export default defineConfig({
 define:{__APP_BUILD_VERSION__:JSON.stringify(buildVersion)},
 plugins:[
  react(),
  {
   name:'techtree-pwa-build-assets',
   generateBundle(){
    this.emitFile({type:'asset',fileName:'sw.js',source:serviceWorkerSource(buildVersion)});
    this.emitFile({type:'asset',fileName:'build-meta.json',source:JSON.stringify({version:buildVersion,builtAt:new Date().toISOString()},null,2)});
   },
  },
 ],
 test:{environment:'jsdom',globals:true,setupFiles:'./src/test/setup.ts'},
});
