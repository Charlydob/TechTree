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

export class AuthRequiredError extends Error {constructor(){super('Authentication required');this.name='AuthRequiredError'}}
export class OfflineError extends Error {constructor(){super('Offline');this.name='OfflineError'}}
export class ApiConflictError extends Error {constructor(message:string,public serverRunbook?:Runbook){super(message);this.name='ApiConflictError'}}

function versionOf(runbook:Runbook){
 const parsed=Number(runbook.metadata?.version);
 return Number.isInteger(parsed)&&parsed>0?parsed:undefined;
}

function withServerVersion(item:StoredRunbook){
 return {...migrateRunbook(item.runbook),metadata:{...item.runbook.metadata,version:String(item.version),updatedAt:item.updatedAt}};
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
   const saved=withServerVersion(await parseApiResponse<StoredRunbook>(await fetch(`${this.baseUrl}/runbooks/${encodeURIComponent(runbook.id)}`,{method:'PUT',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({runbook,expectedVersion:current.version})})));
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
  const body=JSON.stringify(expectedVersion?{runbook,expectedVersion}:{runbook});
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
  for(const runbook of runbooks){
   const clean={...runbook,metadata:{...runbook.metadata,version:undefined}};
   await this.save(clean);
  }
  this.local.markMigrated();
 }

 private updateLocalBook(runbook:Runbook){
  const snapshot=this.local.list();
  this.local.saveRunbooks([runbook,...snapshot.runbooks.filter(item=>item.id!==runbook.id)]);
 }
}
