import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import App from './App';
import rfid from './data/rfid.json';
import type {Runbook} from './types';
import {exportRunbookJson} from './lib/importExport';

const jsonResponse=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const stored=(runbook:Runbook,version=1)=>({runbook,version,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z'});
const largeRunbook=(id='ui-corrupt-import'):Runbook=>{
 const nodes=Array.from({length:55},(_,index)=>({
  id:index===0?'inicio':`node-${index}`,
  type:index===54?'solution':'action',
  title:{es:index===0?'Inicio':`Paso ${index}`,en:index===0?'Start':`Step ${index}`},
  body:{es:`Contenido ${index}`,en:`Body ${index}`},
  nextNode:index<54?`node-${index+1}`:undefined,
 })) as Runbook['nodes'];
 return {...(structuredClone(rfid) as Runbook),id,startNode:'inicio',nodes};
};

class FakeEventSource {
 static instances:FakeEventSource[]=[];
 listeners=new Map<string,Set<(event:MessageEvent)=>void>>();
 onopen?:()=>void;
 onerror?:()=>void;
 constructor(public url:string,public init?:EventSourceInit){FakeEventSource.instances.push(this)}
 addEventListener(type:string,listener:(event:MessageEvent)=>void){
  const listeners=this.listeners.get(type)??new Set();
  listeners.add(listener);
  this.listeners.set(type,listeners);
 }
 removeEventListener(type:string,listener:(event:MessageEvent)=>void){this.listeners.get(type)?.delete(listener)}
 close(){}
 open(){this.onopen?.()}
 error(){this.onerror?.()}
 emit(type:string,data:unknown){this.listeners.get(type)?.forEach(listener=>listener(new MessageEvent(type,{data:JSON.stringify(data)})))}
}

beforeEach(()=>{
 localStorage.clear();
 vi.restoreAllMocks();
 FakeEventSource.instances=[];
 vi.stubGlobal('EventSource',FakeEventSource);
 Object.defineProperty(navigator,'onLine',{value:true,configurable:true});
});

describe('App sync',()=>{
 it('does not load default runbooks when the server returns an empty library',async()=>{
  vi.stubGlobal('fetch',vi.fn(async (input:RequestInfo|URL,init?:RequestInit)=>{
   const url=String(input);
   if(url.endsWith('/sync'))return jsonResponse({runbooks:[],folders:[]});
   if(url.endsWith('/folders')&&init?.method==='PUT')return jsonResponse({folders:[]});
   throw new Error(`Unexpected request ${init?.method??'GET'} ${url}`);
  }));

  const {container}=render(<App/>);

  await waitFor(()=>expect(container.querySelectorAll('.workflow-card')).toHaveLength(0));
 });

 it('refreshes another client when SSE reports create, update and delete',async()=>{
  const source=structuredClone(rfid) as Runbook;
  let serverRunbooks:Runbook[]=[];
  vi.stubGlobal('fetch',vi.fn(async (input:RequestInfo|URL)=>{
   const url=String(input);
   if(url.endsWith('/sync'))return jsonResponse({runbooks:serverRunbooks.map((book,index)=>stored(book,index+1)),folders:[]});
   throw new Error(`Unexpected request ${url}`);
  }));

  const {container}=render(<App/>);
  await waitFor(()=>expect(container.querySelectorAll('.workflow-card')).toHaveLength(0));
  FakeEventSource.instances[0].open();

  serverRunbooks=[source];
  FakeEventSource.instances[0].emit('runbook.created',{type:'runbook.created',id:source.id,revision:1});
  await waitFor(()=>expect(container.querySelectorAll('.workflow-card')).toHaveLength(1));

  serverRunbooks=[{...source,title:{es:'RFID editado',en:'Edited RFID'}}];
  FakeEventSource.instances[0].emit('runbook.updated',{type:'runbook.updated',id:source.id,revision:2});
  await waitFor(()=>expect(container.textContent).toContain('RFID editado'));

  serverRunbooks=[];
  FakeEventSource.instances[0].emit('runbook.deleted',{type:'runbook.deleted',id:source.id,revision:3});
  await waitFor(()=>expect(container.querySelectorAll('.workflow-card')).toHaveLength(0));
 });

 it('runs /api/sync after SSE reconnects',async()=>{
  let syncCalls=0;
  vi.stubGlobal('fetch',vi.fn(async (input:RequestInfo|URL)=>{
   const url=String(input);
   if(url.endsWith('/sync')){syncCalls++;return jsonResponse({runbooks:[],folders:[]})}
   throw new Error(`Unexpected request ${url}`);
  }));

  render(<App/>);
  await waitFor(()=>expect(syncCalls).toBe(1));
  FakeEventSource.instances[0].error();
  FakeEventSource.instances[0].open();

  await waitFor(()=>expect(syncCalls).toBeGreaterThanOrEqual(2));
 });

 it('keeps the importer open and reports corruption when post-save verification fails',async()=>{
  const imported=largeRunbook();
  const empty={...imported,startNode:'start',nodes:[]};
  let getCount=0;
  vi.stubGlobal('fetch',vi.fn(async (input:RequestInfo|URL,init?:RequestInit)=>{
   const url=String(input);
   if(url.endsWith('/sync'))return jsonResponse({runbooks:[],folders:[]});
   if(url.endsWith('/runbooks/ui-corrupt-import')&&!init?.method)return ++getCount===1?jsonResponse({error:'not_found'},404):jsonResponse(stored(empty,1));
   if(url.endsWith('/runbooks')&&init?.method==='POST')return jsonResponse(stored(imported,1),201);
   throw new Error(`Unexpected request ${init?.method??'GET'} ${url}`);
  }));

  const {container}=render(<App/>);
  await waitFor(()=>expect(container.querySelectorAll('.workflow-card')).toHaveLength(0));
  fireEvent.click(screen.getByText('Importar guia'));
  const input=container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input,{target:{files:[new File([exportRunbookJson(imported)],'import.json',{type:'application/json'})]}});
  await screen.findByText(/55 Nodo/i);
  fireEvent.click(screen.getByText('Importar a biblioteca'));

  await screen.findByText('El servidor no devolvió la misma guía que acabas de importar.');
  expect(screen.getByText('Importar a biblioteca')).toBeInTheDocument();
  expect(screen.getByText(/Nodos importados/i)).toBeInTheDocument();
 });

 it('does not add invalid media just by opening the media dialog',async()=>{
  const source=structuredClone(rfid) as Runbook;
  vi.stubGlobal('fetch',vi.fn(async (input:RequestInfo|URL)=>{
   const url=String(input);
   if(url.endsWith('/sync'))return jsonResponse({runbooks:[stored(source)],folders:[]});
   throw new Error(`Unexpected request ${url}`);
  }));

  const {container}=render(<App/>);
  await waitFor(()=>expect(container.querySelectorAll('.workflow-card')).toHaveLength(1));
  const editButton=container.querySelector('.workflow-actions button[title="Modificar este procedimiento."]') as HTMLButtonElement;
  fireEvent.click(editButton);
  await screen.findByText('EDITOR VISUAL HTDE');
  const addMedia=container.querySelector('.media-head button') as HTMLButtonElement;
  fireEvent.click(addMedia);
  await screen.findByRole('heading',{name:'Anadir multimedia'});
  expect(localStorage.getItem('tech-runbook.draft.rfid-integration')).toBeNull();
  fireEvent.click(screen.getByText('Cancelar'));
  expect(localStorage.getItem('tech-runbook.draft.rfid-integration')).toBeNull();
 });

 it('uploads image media and saves only the returned URL in the runbook',async()=>{
  const source=structuredClone(rfid) as Runbook;
  let savedBody:unknown;
  vi.stubGlobal('fetch',vi.fn(async (input:RequestInfo|URL,init?:RequestInit)=>{
   const url=String(input);
   if(url.endsWith('/sync'))return jsonResponse({runbooks:[stored(source)],folders:[]});
   if(url.endsWith('/uploads')&&init?.method==='POST')return jsonResponse({url:'/uploads/mobile-photo.jpg',type:'image',filename:'mobile photo.jpg',size:4},201);
   if(url.endsWith('/runbooks/rfid-integration')&&init?.method==='PUT'){
    savedBody=JSON.parse(String(init.body));
    return jsonResponse(stored((savedBody as {runbook:Runbook}).runbook,2));
   }
   throw new Error(`Unexpected request ${init?.method??'GET'} ${url}`);
  }));

  const {container}=render(<App/>);
  await waitFor(()=>expect(container.querySelectorAll('.workflow-card')).toHaveLength(1));
  const editButton=container.querySelector('.workflow-actions button[title="Modificar este procedimiento."]') as HTMLButtonElement;
  fireEvent.click(editButton);
  await screen.findByText('EDITOR VISUAL HTDE');
  fireEvent.click(container.querySelector('.media-head button') as HTMLButtonElement);
  await screen.findByRole('heading',{name:'Anadir multimedia'});
  const cameraInput=container.querySelector('.media-source-row input[capture]') as HTMLInputElement;
  fireEvent.change(cameraInput,{target:{files:[new File(['jpeg'],'photo.jpg',{type:'image/jpeg'})]}});
  await screen.findByDisplayValue('/uploads/mobile-photo.jpg');
  fireEvent.click(screen.getByText('Crear'));
  fireEvent.click(container.querySelector('button[title="Guardar"]') as HTMLButtonElement);

  await waitFor(()=>expect(savedBody).toBeTruthy());
  const media=(savedBody as {runbook:Runbook}).runbook.nodes[0].media;
  expect(media?.[0]).toMatchObject({type:'image',url:'/uploads/mobile-photo.jpg'});
  expect(JSON.stringify(media)).not.toContain('data:');
 });
});
