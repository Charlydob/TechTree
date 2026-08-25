import type {FolderItem} from '../src/lib/storage';
import type {Runbook} from '../src/types';

export interface StoredRunbook {
 runbook:Runbook;
 version:number;
 createdAt:string;
 updatedAt:string;
}

export interface RunbookStore {
 health():Promise<void>;
 listRunbooks():Promise<StoredRunbook[]>;
 getRunbook(id:string):Promise<StoredRunbook|undefined>;
 createRunbook(runbook:Runbook):Promise<StoredRunbook>;
 updateRunbook(id:string,runbook:Runbook,expectedVersion:number):Promise<StoredRunbook>;
 deleteRunbook(id:string,expectedVersion?:number):Promise<boolean>;
 duplicateRunbook(id:string,newId:string):Promise<StoredRunbook>;
 listFolders():Promise<FolderItem[]>;
 replaceFolders(folders:FolderItem[]):Promise<FolderItem[]>;
 close?():Promise<void>;
}

export class ConflictError extends Error {
 constructor(message='Runbook version conflict'){
  super(message);
  this.name='ConflictError';
 }
}

export class NotFoundError extends Error {
 constructor(message='Runbook not found'){
  super(message);
  this.name='NotFoundError';
 }
}
