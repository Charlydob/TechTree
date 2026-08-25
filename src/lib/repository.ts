import type {Runbook} from '../types';
import {migrateRunbook} from './runbook';
import {
 type FolderItem,
 type PendingChange,
 hasCompletedServerMigration,
 hasStoredLibrary,
 loadFolders,
 loadLibrary,
 loadPendingChanges,
 markServerMigrationDone,
 saveFolders,
 saveLibrary,
 savePendingChanges,
} from './storage';

export type SyncState='synced'|'saving'|'offline'|'pending'|'error'|'auth';
export interface StoredRunbook {runbook:Runbook;version:number;createdAt:string;updatedAt:string}
export interface SyncSnapshot {runbooks:Runbook[];folders:FolderItem[]}
export interface MigrationResult {uploaded:number;existing:number;conflicts:number;errors:number}

export class AuthRequiredError extends Error {constructor(){super('Authentication required');this.name='AuthRequiredError'}}
export class OfflineError extends Error {constructor(){super('Offline');this.name='OfflineError'}}
export class ApiConflictError extends Error {constructor(message:string,public serverRunbook?:Runbook){super(message);this.name='ApiConflictError'}}
export class ImportRunbookExistsError extends Error {
 constructor(public importedRunbook:Runbook,public serverRunbook:Runbook){
  super('A server runbook with this ID already exists.');
  this.name='ImportRunbookExistsError';
 }
}

function versionOf(runbook:Runbook){
 const parsed=runbook.serverVersion;
 return typeof parsed==='number'&&Number.isInteger(parsed)&&parsed>0?parsed:undefined;
}

function withServerVersion(item:StoredRunbook){
 return {...migrateRunbook(item.runbook),serverVersion:item.version,metadata:{...item.runbook.metadata,updatedAt:item.updatedAt}};
}

function withoutServerVersion(runbook:Runbook){
 const clean={...runbook};
 delete clean.serverVersion;
 return clean;
}

function comparableContent(runbook:Runbook){
 const content={...migrateRunbook(runbook)};
 delete content.serverVersion;
 delete content.metadata;
 return content;
}

function sameRunbookContent(a:Runbook,b:Runbook){
 return JSON.stringify(comparableContent(a))===JSON.stringify(comparableContent(b));
}

async function parseApiResponse<T>(response:Response):Promise<T>{
 const body=await response.json().catch(()=>({}));
 if(response.status===401)throw new AuthRequiredError();
 if(response.status===409)throw new ApiConflictError(body.message??'Este procedimiento fue modificado desde otro dispositivo.');
 if(!response.ok)throw new Error(body.message??`API error ${response.status}`);
 return body as T;
}

export class LocalRunbookRepository {
 constructor(private fallback:Runbook[]){}

 list():SyncSnapshot{
  const runbooks=loadLibrary(this.fallback);
  return {runbooks,folders:loadFolders(runbooks)};
 }

 saveRunbooks(runbooks:Runbook[]){
  saveLibrary(runbooks.map(migrateRunbook));
 }

 saveFolders(folders:FolderItem[]){
  saveFolders(folders);
 }

 pending(){
  return loadPendingChanges();
 }

 hasLegacyLibrary(){
  return hasStoredLibrary()&&!hasCompletedServerMigration();
 }

 markMigrated(){
  markServerMigrationDone();
 }

 enqueue(change:PendingChange){
  const pending=loadPendingChanges();
  const compacted=pending.filter(item=>{
   if(change.type==='save'&&item.type==='save')return item.runbook.id!==change.runbook.id;
   if(change.type==='delete')return item.type!=='save'||item.runbook.id!==change.runbookId;
   if(change.type==='folders')return item.type!=='folders';
   return true;
  });
  savePendingChanges([...compacted,change]);
 }

 replacePending(changes:PendingChange[]){
  savePendingChanges(changes);
 }
}

export class ServerRunbookRepository {
 constructor(private local:LocalRunbookRepository,private baseUrl='/api'){}

 localSnapshot(){
  return this.local.list();
 }

 pendingCount(){
  return this.local.pending().length;
 }

 needsMigrationPrompt(){
  return this.local.hasLegacyLibrary();
 }

 markMigrationHandled(){
  this.local.markMigrated();
 }

 stageLocalRunbook(runbook:Runbook){
  this.updateLocalBook(migrateRunbook(withoutServerVersion(runbook)));
 }

 async login(password:string){
  await parseApiResponse(await fetch(`${this.baseUrl}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({password})}));
 }

 async me(){
  const result=await parseApiResponse<{authenticated:boolean}>(await fetch(`${this.baseUrl}/auth/me`,{credentials:'include'}));
  return result.authenticated;
 }

 async list(){
  try{
   const result=await parseApiResponse<{runbooks:StoredRunbook[];folders:FolderItem[]}>(await fetch(`${this.baseUrl}/sync`,{credentials:'include'}));
   const runbooks=result.runbooks.map(withServerVersion);
   this.local.saveRunbooks(runbooks);
   this.local.saveFolders(result.folders);
   return {runbooks,folders:result.folders};
  }catch(error){
   if(error instanceof AuthRequiredError)throw error;
   if(!navigator.onLine||error instanceof TypeError)return this.localSnapshot();
   throw error;
  }
 }

 async forceSave(runbook:Runbook){
  try{
   const current=await parseApiResponse<StoredRunbook>(await fetch(`${this.baseUrl}/runbooks/${encodeURIComponent(runbook.id)}`,{credentials:'include'}));
   const saved=withServerVersion(await parseApiResponse<StoredRunbook>(await fetch(`${this.baseUrl}/runbooks/${encodeURIComponent(runbook.id)}`,{method:'PUT',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({runbook:withoutServerVersion(runbook),expectedVersion:current.version})})));
   this.updateLocalBook(saved);
   return saved;
  }catch(error){
   if(error instanceof ApiConflictError||error instanceof AuthRequiredError)throw error;
   if(error instanceof TypeError||!navigator.onLine)throw new OfflineError();
   throw error;
  }
 }

 async save(runbook:Runbook){
  const expectedVersion=versionOf(runbook);
  const body=JSON.stringify(expectedVersion?{runbook:withoutServerVersion(runbook),expectedVersion}:{runbook:withoutServerVersion(runbook)});
  const method=expectedVersion?'PUT':'POST';
  const url=expectedVersion?`${this.baseUrl}/runbooks/${encodeURIComponent(runbook.id)}`:`${this.baseUrl}/runbooks`;
  try{
   const saved=withServerVersion(await parseApiResponse<StoredRunbook>(await fetch(url,{method,headers:{'Content-Type':'application/json'},credentials:'include',body})));
   this.updateLocalBook(saved);
   return saved;
  }catch(error){
   if(error instanceof ApiConflictError||error instanceof AuthRequiredError)throw error;
   if(!navigator.onLine||error instanceof TypeError){
    this.updateLocalBook(runbook);
    this.local.enqueue({id:`pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,type:'save',runbook,expectedVersion,createdAt:new Date().toISOString()});
    throw new OfflineError();
   }
   throw error;
  }
 }

 async getServerRunbook(id:string){
  try{
   const response=await fetch(`${this.baseUrl}/runbooks/${encodeURIComponent(id)}`,{credentials:'include'});
   if(response.status===404)return undefined;
   return withServerVersion(await parseApiResponse<StoredRunbook>(response));
  }catch(error){
   if(error instanceof AuthRequiredError)throw error;
   if(!navigator.onLine||error instanceof TypeError)throw new OfflineError();
   throw error;
  }
 }

 async importRunbook(runbook:Runbook){
  const imported=migrateRunbook(withoutServerVersion(runbook));
  try{
   const existing=await this.getServerRunbook(imported.id);
   if(existing)throw new ImportRunbookExistsError(imported,existing);
   const saved=withServerVersion(await parseApiResponse<StoredRunbook>(await fetch(`${this.baseUrl}/runbooks`,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({runbook:withoutServerVersion(imported)})})));
   this.updateLocalBook(saved);
   return saved;
  }catch(error){
   if(error instanceof ImportRunbookExistsError||error instanceof AuthRequiredError)throw error;
   if(error instanceof ApiConflictError){
    const existing=await this.getServerRunbook(imported.id).catch(()=>undefined);
    if(existing)throw new ImportRunbookExistsError(imported,existing);
   }
   this.updateLocalBook(imported);
   if(error instanceof OfflineError||!navigator.onLine||error instanceof TypeError){
    this.local.enqueue({id:`pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,type:'save',runbook:imported,createdAt:new Date().toISOString()});
    throw new OfflineError();
   }
   throw error;
  }
 }

 async replaceImportedRunbook(runbook:Runbook){
  const imported=migrateRunbook(withoutServerVersion(runbook));
  try{
   const current=await this.getRequiredServerRunbook(imported.id);
   const expectedVersion=versionOf(current);
   if(!expectedVersion)throw new Error('Server version is required.');
   const saved=withServerVersion(await parseApiResponse<StoredRunbook>(await fetch(`${this.baseUrl}/runbooks/${encodeURIComponent(imported.id)}`,{method:'PUT',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({runbook:withoutServerVersion(imported),expectedVersion})})));
   this.updateLocalBook(saved);
   return saved;
  }catch(error){
   if(error instanceof ApiConflictError||error instanceof AuthRequiredError)throw error;
   this.updateLocalBook(imported);
   if(error instanceof OfflineError||!navigator.onLine||error instanceof TypeError){
    this.local.enqueue({id:`pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,type:'save',runbook:imported,expectedVersion:versionOf(imported),createdAt:new Date().toISOString()});
    throw new OfflineError();
   }
   throw error;
  }
 }

 async importRunbookAsCopy(runbook:Runbook){
  let copy={...migrateRunbook(withoutServerVersion(runbook)),id:this.uniqueLocalRunbookId(runbook.id),serverVersion:undefined,metadata:{...runbook.metadata,updatedAt:new Date().toISOString()}};
  try{
   copy={...copy,id:await this.uniqueRunbookId(runbook.id)};
   const saved=withServerVersion(await parseApiResponse<StoredRunbook>(await fetch(`${this.baseUrl}/runbooks`,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({runbook:withoutServerVersion(copy)})})));
   this.updateLocalBook(saved);
   return saved;
  }catch(error){
   this.updateLocalBook(copy);
   if(error instanceof AuthRequiredError)throw error;
   if(error instanceof OfflineError||!navigator.onLine||error instanceof TypeError){
    this.local.enqueue({id:`pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,type:'save',runbook:copy,createdAt:new Date().toISOString()});
    throw new OfflineError();
   }
   throw error;
  }
 }

 async delete(runbook:Runbook){
  const expectedVersion=versionOf(runbook);
  try{
   const suffix=expectedVersion?`?expectedVersion=${expectedVersion}`:'';
   await parseApiResponse(await fetch(`${this.baseUrl}/runbooks/${encodeURIComponent(runbook.id)}${suffix}`,{method:'DELETE',credentials:'include'}));
   const snapshot=this.local.list();
   this.local.saveRunbooks(snapshot.runbooks.filter(item=>item.id!==runbook.id));
  }catch(error){
   if(error instanceof ApiConflictError||error instanceof AuthRequiredError)throw error;
   if(!navigator.onLine||error instanceof TypeError){
    const snapshot=this.local.list();
    this.local.saveRunbooks(snapshot.runbooks.filter(item=>item.id!==runbook.id));
    this.local.enqueue({id:`pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,type:'delete',runbookId:runbook.id,expectedVersion,createdAt:new Date().toISOString()});
    throw new OfflineError();
   }
   throw error;
  }
 }

 async saveFolders(folders:FolderItem[]){
  this.local.saveFolders(folders);
  try{
   await parseApiResponse(await fetch(`${this.baseUrl}/folders`,{method:'PUT',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({folders})}));
  }catch(error){
   if(error instanceof AuthRequiredError)throw error;
   if(!navigator.onLine||error instanceof TypeError){
    this.local.enqueue({id:`pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,type:'folders',folders,createdAt:new Date().toISOString()});
    throw new OfflineError();
   }
   throw error;
  }
 }

 async pushPending(){
  const pending=this.local.pending();
  const remaining:PendingChange[]=[];
  for(const change of pending){
   try{
    if(change.type==='save')await this.save(change.runbook);
    if(change.type==='delete')await parseApiResponse(await fetch(`${this.baseUrl}/runbooks/${encodeURIComponent(change.runbookId)}${change.expectedVersion?`?expectedVersion=${change.expectedVersion}`:''}`,{method:'DELETE',credentials:'include'}));
    if(change.type==='folders')await this.saveFolders(change.folders);
   }catch(error){
    if(error instanceof OfflineError||error instanceof AuthRequiredError||error instanceof ApiConflictError)remaining.push(change);
    else remaining.push(change);
   }
  }
  this.local.replacePending(remaining);
  return remaining.length;
 }

 async migrateLocalRunbooksToServer(runbooks:Runbook[]){
  const result:MigrationResult={uploaded:0,existing:0,conflicts:0,errors:0};
  for(const runbook of runbooks){
   const localRunbook=migrateRunbook(withoutServerVersion(runbook));
   try{
    const existing=await this.getServerRunbook(localRunbook.id);
    if(!existing){
     await this.save(localRunbook);
     result.uploaded++;
    }else if(sameRunbookContent(localRunbook,existing)){
     this.updateLocalBook(existing);
     result.existing++;
    }else{
     result.conflicts++;
    }
   }catch{
    result.errors++;
   }
  }
  this.local.markMigrated();
  return result;
 }

 private updateLocalBook(runbook:Runbook){
  const snapshot=this.local.list();
  this.local.saveRunbooks([runbook,...snapshot.runbooks.filter(item=>item.id!==runbook.id)]);
 }

 private async getRequiredServerRunbook(id:string){
  const current=await this.getServerRunbook(id);
  if(!current)throw new Error('Server runbook not found.');
  return current;
 }

 private async uniqueRunbookId(sourceId:string){
  const localIds=new Set(this.local.list().runbooks.map(item=>item.id));
  let index=1;
  while(true){
   const id=index===1?`${sourceId}-copy`:`${sourceId}-copy-${index}`;
   if(!localIds.has(id)&&!await this.getServerRunbook(id))return id;
   index++;
  }
 }

 private uniqueLocalRunbookId(sourceId:string){
  const localIds=new Set(this.local.list().runbooks.map(item=>item.id));
  let id=`${sourceId}-copy`;
  let index=2;
  while(localIds.has(id))id=`${sourceId}-copy-${index++}`;
  return id;
 }
}
