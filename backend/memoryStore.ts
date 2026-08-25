import {ConflictError,NotFoundError,type RunbookStore,type StoredRunbook} from './types';
import type {FolderItem} from '../src/lib/storage';
import type {Runbook} from '../src/types';

const clone=<T>(value:T):T=>structuredClone(value);

export class MemoryRunbookStore implements RunbookStore {
 private runbooks=new Map<string,StoredRunbook>();
 private folders:FolderItem[]=[];

 async health(){}

 async listRunbooks(){
  return [...this.runbooks.values()].map(clone).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
 }

 async getRunbook(id:string){
  const item=this.runbooks.get(id);
  return item?clone(item):undefined;
 }

 async createRunbook(runbook:Runbook){
  if(this.runbooks.has(runbook.id))throw new ConflictError('Runbook id already exists.');
  const now=new Date().toISOString();
  const stored={runbook:{...clone(runbook),metadata:{...runbook.metadata,version:'1',updatedAt:now}},version:1,createdAt:now,updatedAt:now};
  this.runbooks.set(runbook.id,stored);
  return clone(stored);
 }

 async updateRunbook(id:string,runbook:Runbook,expectedVersion:number){
  const current=this.runbooks.get(id);
  if(!current)throw new NotFoundError();
  if(current.version!==expectedVersion)throw new ConflictError('This runbook was modified from another device.');
  const now=new Date().toISOString();
  const next={runbook:{...clone(runbook),metadata:{...runbook.metadata,version:String(current.version+1),updatedAt:now}},version:current.version+1,createdAt:current.createdAt,updatedAt:now};
  if(id!==runbook.id)this.runbooks.delete(id);
  this.runbooks.set(runbook.id,next);
  return clone(next);
 }

 async deleteRunbook(id:string,expectedVersion?:number){
  const current=this.runbooks.get(id);
  if(!current)return false;
  if(expectedVersion!==undefined&&current.version!==expectedVersion)throw new ConflictError('This runbook was modified from another device.');
  return this.runbooks.delete(id);
 }

 async duplicateRunbook(id:string,newId:string){
  const source=this.runbooks.get(id);
  if(!source)throw new NotFoundError();
  return this.createRunbook({...clone(source.runbook),id:newId,metadata:{...source.runbook.metadata,version:'1',updatedAt:new Date().toISOString()}});
 }

 async listFolders(){
  return clone(this.folders);
 }

 async replaceFolders(folders:FolderItem[]){
  this.folders=clone(folders);
  return clone(this.folders);
 }
}
