import {beforeEach,describe,expect,it,vi} from 'vitest';
import rfid from '../data/rfid.json';
import type {Runbook} from '../types';
import {ImportRunbookExistsError,LocalRunbookRepository,OfflineError,ServerRunbookRepository} from './repository';
import {exportRunbookJson,parseRunbookJson} from './importExport';
import {loadPendingChanges,markServerMigrationDone,saveLibrary} from './storage';

const defaultBooks=[rfid as Runbook];
const stored=(runbook:Runbook,version=1)=>({runbook,version,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z'});
const jsonResponse=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const withId=(id:string,patch:Partial<Runbook>={}):Runbook=>({...structuredClone(defaultBooks[0]),id,...patch});

beforeEach(()=>{
 localStorage.clear();
 vi.restoreAllMocks();
 Object.defineProperty(navigator,'onLine',{value:true,configurable:true});
});

describe('runbook repositories',()=>{
 it('detects legacy local data that has not been migrated',()=>{
  saveLibrary(defaultBooks);
  const repository=new ServerRunbookRepository(new LocalRunbookRepository(defaultBooks));
  expect(repository.needsMigrationPrompt()).toBe(true);
  markServerMigrationDone();
  expect(repository.needsMigrationPrompt()).toBe(false);
 });

 it('falls back to local data when offline',async()=>{
  saveLibrary(defaultBooks);
  Object.defineProperty(navigator,'onLine',{value:false,configurable:true});
  vi.stubGlobal('fetch',vi.fn(()=>Promise.reject(new TypeError('offline'))));
  const repository=new ServerRunbookRepository(new LocalRunbookRepository([]));
  const snapshot=await repository.list();
  expect(snapshot.runbooks).toHaveLength(1);
  expect(snapshot.runbooks[0].id).toBe('rfid-integration');
 });

 it('queues offline edits without losing the local copy',async()=>{
  Object.defineProperty(navigator,'onLine',{value:false,configurable:true});
  vi.stubGlobal('fetch',vi.fn(()=>Promise.reject(new TypeError('offline'))));
  const repository=new ServerRunbookRepository(new LocalRunbookRepository(defaultBooks));
  const changed={...defaultBooks[0],description:{es:'Cambio offline'}};
  await expect(repository.save(changed)).rejects.toBeInstanceOf(OfflineError);
  expect(repository.localSnapshot().runbooks[0].description).toEqual({es:'Cambio offline'});
 expect(loadPendingChanges()).toMatchObject([{type:'save',runbook:{id:'rfid-integration'}}]);
 });

 it('imports a new JSON runbook with POST',async()=>{
  const imported=withId('new-import',{metadata:{author:'HTDE',version:'1.0.0'}});
  const fetchMock=vi.fn(async (input:RequestInfo|URL,init?:RequestInit)=>{
   const url=String(input);
   if(url.endsWith('/runbooks/new-import'))return jsonResponse({error:'not_found'},404);
   if(url.endsWith('/runbooks')&&init?.method==='POST')return jsonResponse(stored(imported,1),201);
   throw new Error(`Unexpected request ${init?.method??'GET'} ${url}`);
  });
  vi.stubGlobal('fetch',fetchMock);
  const repository=new ServerRunbookRepository(new LocalRunbookRepository([]));

  const saved=await repository.importRunbook(imported);
  const post=fetchMock.mock.calls.find(([,init])=>init?.method==='POST');

  expect(saved.serverVersion).toBe(1);
  expect(post).toBeTruthy();
  expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({runbook:{id:'new-import',metadata:{version:'1.0.0'}}});
 });

 it('does not blindly POST when importing a JSON runbook whose ID already exists',async()=>{
  const imported=withId('existing-import',{metadata:{version:'1.0.0'}});
  const server=withId('existing-import',{description:{es:'Servidor'}});
  const fetchMock=vi.fn(async (input:RequestInfo|URL,init?:RequestInit)=>{
   const url=String(input);
   if(url.endsWith('/runbooks/existing-import')&&!init?.method)return jsonResponse(stored(server,4));
   throw new Error(`Unexpected request ${init?.method??'GET'} ${url}`);
  });
  vi.stubGlobal('fetch',fetchMock);
  const repository=new ServerRunbookRepository(new LocalRunbookRepository([]));

  await expect(repository.importRunbook(imported)).rejects.toBeInstanceOf(ImportRunbookExistsError);
  expect(fetchMock.mock.calls.some(([,init])=>init?.method==='POST')).toBe(false);
 });

 it('replaces an existing imported runbook with PUT and the current server version',async()=>{
  const imported=withId('replace-import',{metadata:{version:'1.0.0'}});
  const fetchMock=vi.fn(async (input:RequestInfo|URL,init?:RequestInit)=>{
   const url=String(input);
   if(url.endsWith('/runbooks/replace-import')&&!init?.method)return jsonResponse(stored(withId('replace-import'),7));
   if(url.endsWith('/runbooks/replace-import')&&init?.method==='PUT')return jsonResponse(stored(imported,8));
   throw new Error(`Unexpected request ${init?.method??'GET'} ${url}`);
  });
  vi.stubGlobal('fetch',fetchMock);
  const repository=new ServerRunbookRepository(new LocalRunbookRepository([]));

  await repository.replaceImportedRunbook(imported);
  const put=fetchMock.mock.calls.find(([,init])=>init?.method==='PUT');

  expect(put).toBeTruthy();
  expect(JSON.parse(String(put?.[1]?.body))).toMatchObject({expectedVersion:7,runbook:{id:'replace-import',metadata:{version:'1.0.0'}}});
 });

 it('imports an existing runbook as a copy with a unique ID',async()=>{
  const imported=withId('copy-source');
  const fetchMock=vi.fn(async (input:RequestInfo|URL,init?:RequestInit)=>{
   const url=String(input);
   if(url.endsWith('/runbooks/copy-source-copy')&&!init?.method)return jsonResponse({error:'not_found'},404);
   if(url.endsWith('/runbooks')&&init?.method==='POST'){
    const body=JSON.parse(String(init.body)) as {runbook:Runbook};
    return jsonResponse(stored(body.runbook,1),201);
   }
   throw new Error(`Unexpected request ${init?.method??'GET'} ${url}`);
  });
  vi.stubGlobal('fetch',fetchMock);
  const repository=new ServerRunbookRepository(new LocalRunbookRepository([imported]));

  const saved=await repository.importRunbookAsCopy(imported);

  expect(saved.id).toBe('copy-source-copy');
  expect(fetchMock.mock.calls.some(([,init])=>init?.method==='POST')).toBe(true);
 });

 it('continues migration when one existing runbook conflicts',async()=>{
  const first=withId('migration-one');
  const conflicting=withId('migration-two',{description:{es:'Local'}});
  const third=withId('migration-three');
  const serverConflict=withId('migration-two',{description:{es:'Servidor'}});
  const fetchMock=vi.fn(async (input:RequestInfo|URL,init?:RequestInit)=>{
   const url=String(input);
   if(url.endsWith('/runbooks/migration-two')&&!init?.method)return jsonResponse(stored(serverConflict,2));
   if((url.endsWith('/runbooks/migration-one')||url.endsWith('/runbooks/migration-three'))&&!init?.method)return jsonResponse({error:'not_found'},404);
   if(url.endsWith('/runbooks')&&init?.method==='POST'){
    const body=JSON.parse(String(init.body)) as {runbook:Runbook};
    return jsonResponse(stored(body.runbook,1),201);
   }
   throw new Error(`Unexpected request ${init?.method??'GET'} ${url}`);
  });
  vi.stubGlobal('fetch',fetchMock);
  const repository=new ServerRunbookRepository(new LocalRunbookRepository([]));

  const result=await repository.migrateLocalRunbooksToServer([first,conflicting,third]);

  expect(result).toEqual({uploaded:2,existing:0,conflicts:1,errors:0});
  expect(fetchMock.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(2);
 });

 it('uses serverVersion, not metadata.version, as the concurrency version',async()=>{
  const changed=withId('versioned-import',{serverVersion:5,metadata:{version:'1.0.0'}});
  const fetchMock=vi.fn(async (input:RequestInfo|URL,init?:RequestInit)=>{
   const url=String(input);
   if(url.endsWith('/runbooks/versioned-import')&&init?.method==='PUT')return jsonResponse(stored(changed,6));
   throw new Error(`Unexpected request ${init?.method??'GET'} ${url}`);
  });
  vi.stubGlobal('fetch',fetchMock);
  const repository=new ServerRunbookRepository(new LocalRunbookRepository([]));

  await repository.save(changed);
  const body=JSON.parse(String(fetchMock.mock.calls[0][1]?.body));

  expect(fetchMock.mock.calls[0][1]?.method).toBe('PUT');
  expect(body.expectedVersion).toBe(5);
  expect(body.runbook.metadata.version).toBe('1.0.0');
 });

 it('keeps an imported runbook local when the server rejects the save',async()=>{
  const imported=withId('failed-import',{metadata:{version:'1.0.0'}});
  const fetchMock=vi.fn(async (input:RequestInfo|URL,init?:RequestInit)=>{
   const url=String(input);
   if(url.endsWith('/runbooks/failed-import')&&!init?.method)return jsonResponse({error:'not_found'},404);
   if(url.endsWith('/runbooks')&&init?.method==='POST')return jsonResponse({message:'database unavailable'},500);
   throw new Error(`Unexpected request ${init?.method??'GET'} ${url}`);
  });
  vi.stubGlobal('fetch',fetchMock);
  const repository=new ServerRunbookRepository(new LocalRunbookRepository([]));

  await expect(repository.importRunbook(imported)).rejects.toThrow('database unavailable');
  const local=repository.localSnapshot().runbooks.find(item=>item.id==='failed-import');

  expect(local?.nodes).toHaveLength(imported.nodes.length);
 });

 it('preserves every node during a valid import',async()=>{
  const imported=withId('node-preserving-import');
  const fetchMock=vi.fn(async (input:RequestInfo|URL,init?:RequestInit)=>{
   const url=String(input);
   if(url.endsWith('/runbooks/node-preserving-import')&&!init?.method)return jsonResponse({error:'not_found'},404);
   if(url.endsWith('/runbooks')&&init?.method==='POST')return jsonResponse(stored(imported,1),201);
   throw new Error(`Unexpected request ${init?.method??'GET'} ${url}`);
  });
  vi.stubGlobal('fetch',fetchMock);
  const repository=new ServerRunbookRepository(new LocalRunbookRepository([]));

  const saved=await repository.importRunbook(imported);

  expect(saved.nodes).toHaveLength(imported.nodes.length);
 });

 it('keeps node and connection counts stable across export, import, export',()=>{
  const countConnections=(book:Runbook)=>book.nodes.reduce((count,node)=>count+(node.nextNode?1:0)+(node.outcomes??[]).filter(outcome=>outcome.nextNode).length,0);
  const source=withId('roundtrip',{serverVersion:12});
  const imported=parseRunbookJson(exportRunbookJson(source));
  const exportedAgain=parseRunbookJson(exportRunbookJson(imported));

  expect(imported.nodes).toHaveLength(source.nodes.length);
  expect(exportedAgain.nodes).toHaveLength(source.nodes.length);
  expect(countConnections(exportedAgain)).toBe(countConnections(source));
  expect(JSON.parse(exportRunbookJson(source)).serverVersion).toBeUndefined();
 });
});
