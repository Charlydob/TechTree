import {StrictMode} from 'react'; import {createRoot} from 'react-dom/client'; import App from './App'; import './styles.css';
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
let updateRegistration:ServiceWorkerRegistration|undefined;
let reloading=false;
let hasController=false;

function notifyUpdate(registration:ServiceWorkerRegistration){
 updateRegistration=registration;
 window.dispatchEvent(new CustomEvent('techtree:update-available'));
}

if('serviceWorker'in navigator&&import.meta.env.PROD){
 addEventListener('load',async()=>{
  try{
   const registration=await navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'});
   hasController=Boolean(navigator.serviceWorker.controller);
   if(registration.waiting&&navigator.serviceWorker.controller)notifyUpdate(registration);
   registration.addEventListener('updatefound',()=>{
    const worker=registration.installing;
    worker?.addEventListener('statechange',()=>{
     if(worker.state==='installed'&&navigator.serviceWorker.controller)notifyUpdate(registration);
    });
   });
   navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(!hasController){hasController=true;return}
    if(reloading)return;
    reloading=true;
    notifyUpdate(registration);
   });
   window.addEventListener('techtree:apply-update',()=>{
    const worker=updateRegistration?.waiting;
    if(worker)worker.postMessage({type:'SKIP_WAITING'});
    setTimeout(()=>location.reload(),250);
   });
   const check=()=>{if(!document.hidden)void registration.update()};
   void registration.update();
   document.addEventListener('visibilitychange',check);
   window.addEventListener('online',check);
   setInterval(check,60*60*1000);
  }catch(error){
   console.warn('Service worker registration failed',error);
  }
 });
}
