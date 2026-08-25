import {readFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Pool} from 'pg';
import {ConflictError,NotFoundError,type RunbookStore,type StoredRunbook} from './types';
import type {FolderItem} from '../src/lib/storage';
import type {Runbook} from '../src/types';

function requireEnv(name:string){
 const value=process.env[name];
 if(!value)throw new Error(`${name} is required`);
 return value;
}

function rowToStored(row:{data:Runbook;version:number;created_at:Date|string;updated_at:Date|string}):StoredRunbook{
 const runbook={...row.data,metadata:{...row.data.metadata,version:String(row.version),updatedAt:new Date(row.updated_at).toISOString()}};
 return {runbook,version:row.version,createdAt:new Date(row.created_at).toISOString(),updatedAt:new Date(row.updated_at).toISOString()};
}

export class PgRunbookStore implements RunbookStore {
 private pool:Pool;

 constructor(databaseUrl=process.env.DATABASE_URL){
  this.pool=new Pool({connectionString:databaseUrl??requireEnv('DATABASE_URL')});
 }

 async migrate(){
  const root=dirname(fileURLToPath(import.meta.url));
  const sql=await readFile(join(root,'migrations','001_initial.sql'),'utf8');
  await this.pool.query(sql);
 }

 async health(){
  await this.pool.query('SELECT 1');
 }

 async listRunbooks(){
  const result=await this.pool.query('SELECT data, version, created_at, updated_at FROM runbooks ORDER BY updated_at DESC, id ASC');
  return result.rows.map(rowToStored);
 }

 async getRunbook(id:string){
  const result=await this.pool.query('SELECT data, version, created_at, updated_at FROM runbooks WHERE id=$1',[id]);
  return result.rows[0]?rowToStored(result.rows[0]):undefined;
 }

 async createRunbook(runbook:Runbook){
  const result=await this.pool.query(
   `INSERT INTO runbooks (id,title,category,folder,data)
    VALUES ($1,$2,$3,$4,$5)
    RETURNING data, version, created_at, updated_at`,
   [runbook.id,JSON.stringify(runbook.title),runbook.category,runbook.folder??null,JSON.stringify(runbook)],
  );
  return rowToStored(result.rows[0]);
 }

 async updateRunbook(id:string,runbook:Runbook,expectedVersion:number){
  const existing=await this.getRunbook(id);
  if(!existing)throw new NotFoundError();
  if(existing.version!==expectedVersion)throw new ConflictError('This runbook was modified from another device.');
  const result=await this.pool.query(
   `UPDATE runbooks
    SET id=$2, title=$3, category=$4, folder=$5, data=$6, updated_at=now(), version=version+1
    WHERE id=$1
    RETURNING data, version, created_at, updated_at`,
   [id,runbook.id,JSON.stringify(runbook.title),runbook.category,runbook.folder??null,JSON.stringify(runbook)],
  );
  return rowToStored(result.rows[0]);
 }

 async deleteRunbook(id:string,expectedVersion?:number){
  if(expectedVersion!==undefined){
   const existing=await this.getRunbook(id);
   if(!existing)return false;
   if(existing.version!==expectedVersion)throw new ConflictError('This runbook was modified from another device.');
  }
  const result=await this.pool.query('DELETE FROM runbooks WHERE id=$1',[id]);
  return (result.rowCount??0)>0;
 }

 async duplicateRunbook(id:string,newId:string){
  const source=await this.getRunbook(id);
  if(!source)throw new NotFoundError();
  return this.createRunbook({...source.runbook,id:newId,metadata:{...source.runbook.metadata,version:'1',updatedAt:new Date().toISOString()}});
 }

 async listFolders(){
  const result=await this.pool.query('SELECT id, name, parent_id, created_at FROM folders ORDER BY created_at ASC, name ASC');
  return result.rows.map(row=>({id:row.id,name:row.name,parentId:row.parent_id??undefined,createdAt:new Date(row.created_at).toISOString()}));
 }

 async replaceFolders(folders:FolderItem[]){
  const client=await this.pool.connect();
  try{
   await client.query('BEGIN');
   await client.query('DELETE FROM folders');
   for(const folder of folders){
    await client.query('INSERT INTO folders (id,name,parent_id,created_at) VALUES ($1,$2,$3,$4)',[folder.id,folder.name,folder.parentId??null,folder.createdAt]);
   }
   await client.query('COMMIT');
   return folders;
  }catch(error){
   await client.query('ROLLBACK');
   throw error;
  }finally{
   client.release();
  }
 }

 async close(){
  await this.pool.end();
 }
}
