import express,{type ErrorRequestHandler} from 'express';
import cookieParser from 'cookie-parser';
import {clearSessionCookie,isAuthenticated,passwordMatches,requireAuth,setSessionCookie} from './auth';
import {ConflictError,NotFoundError,type RunbookStore} from './types';
import {assertRunbookId,assertValidRunbook} from './validation/runbookValidation';
import type {FolderItem} from '../src/lib/storage';

interface AppOptions {
 store:RunbookStore;
 appPassword:string;
 sessionSecret:string;
 secureCookies?:boolean;
 jsonLimit?:string;
}

function validationError(message:string){
 const error=new Error(message);
 error.name='ValidationError';
 return error;
}

function validateVersion(value:unknown,required=true){
 if(value===undefined||value===null){
  if(required)throw validationError('expectedVersion is required');
  return undefined;
 }
 const version=Number(value);
 if(!Number.isInteger(version)||version<1)throw validationError('expectedVersion must be a positive integer');
 return version;
}

function validateFolders(value:unknown):FolderItem[]{
 if(!Array.isArray(value))throw validationError('folders must be an array');
 const ids=new Set<string>();
 for(const folder of value){
  if(!folder||typeof folder!=='object')throw validationError('folder must be an object');
  const item=folder as Partial<FolderItem>;
  if(typeof item.id!=='string'||!item.id.trim())throw validationError('folder.id is required');
  if(typeof item.name!=='string'||!item.name.trim())throw validationError('folder.name is required');
  if(item.parentId!==undefined&&typeof item.parentId!=='string')throw validationError('folder.parentId must be a string');
  if(typeof item.createdAt!=='string'||Number.isNaN(Date.parse(item.createdAt)))throw validationError('folder.createdAt must be an ISO date');
  if(ids.has(item.id))throw validationError('folder ids must be unique');
  ids.add(item.id);
 }
 for(const folder of value as FolderItem[]){
  if(folder.parentId&& !ids.has(folder.parentId))throw validationError(`folder parent "${folder.parentId}" does not exist`);
 }
 return value as FolderItem[];
}

export function createApp({store,appPassword,sessionSecret,secureCookies=process.env.NODE_ENV==='production',jsonLimit='2mb'}:AppOptions){
 const app=express();
 app.disable('x-powered-by');
 app.use(express.json({limit:jsonLimit}));
 app.use(cookieParser());

 app.get('/api/health',async (_request,response,next)=>{
  try{
   await store.health();
   response.json({ok:true,postgres:true});
  }catch(error){
   next(error);
  }
 });

 app.post('/api/auth/login',(request,response)=>{
  const password=typeof request.body?.password==='string'?request.body.password:'';
  if(!passwordMatches(password,appPassword))return response.status(401).json({error:'invalid_credentials',message:'Invalid password.'});
  setSessionCookie(response,sessionSecret,secureCookies);
  response.json({ok:true});
 });

 app.post('/api/auth/logout',(_request,response)=>{
  clearSessionCookie(response,secureCookies);
  response.json({ok:true});
 });

 app.get('/api/auth/me',(request,response)=>{
  response.json({authenticated:isAuthenticated(request,sessionSecret)});
 });

 app.use('/api',requireAuth(sessionSecret));

 app.get('/api/runbooks',async (_request,response,next)=>{
  try{
   response.json({runbooks:await store.listRunbooks()});
  }catch(error){
   next(error);
  }
 });

 app.get('/api/runbooks/:id',async (request,response,next)=>{
  try{
   const id=assertRunbookId(request.params.id);
   const item=await store.getRunbook(id);
   if(!item)return response.status(404).json({error:'not_found',message:'Runbook not found.'});
   response.json(item);
  }catch(error){
   next(error);
  }
 });

 app.post('/api/runbooks',async (request,response,next)=>{
  try{
   const runbook=assertValidRunbook(request.body?.runbook??request.body);
   response.status(201).json(await store.createRunbook(runbook));
  }catch(error){
   next(error);
  }
 });

 app.put('/api/runbooks/:id',async (request,response,next)=>{
  try{
   const id=assertRunbookId(request.params.id);
   const expectedVersion=validateVersion(request.body?.expectedVersion);
   const runbook=assertValidRunbook(request.body?.runbook);
   response.json(await store.updateRunbook(id,runbook,expectedVersion!));
  }catch(error){
   next(error);
  }
 });

 app.delete('/api/runbooks/:id',async (request,response,next)=>{
  try{
   const id=assertRunbookId(request.params.id);
   const expectedVersion=validateVersion(request.query.expectedVersion, false);
   const deleted=await store.deleteRunbook(id,expectedVersion);
   response.status(deleted?200:404).json(deleted?{ok:true}:{error:'not_found',message:'Runbook not found.'});
  }catch(error){
   next(error);
  }
 });

 app.post('/api/runbooks/:id/duplicate',async (request,response,next)=>{
  try{
   const id=assertRunbookId(request.params.id);
   const newId=assertRunbookId(request.body?.newId);
   response.status(201).json(await store.duplicateRunbook(id,newId));
  }catch(error){
   next(error);
  }
 });

 app.get('/api/folders',async (_request,response,next)=>{
  try{
   response.json({folders:await store.listFolders()});
  }catch(error){
   next(error);
  }
 });

 app.put('/api/folders',async (request,response,next)=>{
  try{
   const folders=validateFolders(request.body?.folders);
   response.json({folders:await store.replaceFolders(folders)});
  }catch(error){
   next(error);
  }
 });

 app.get('/api/sync',async (_request,response,next)=>{
  try{
   const [runbooks,folders]=await Promise.all([store.listRunbooks(),store.listFolders()]);
   response.json({runbooks,folders});
  }catch(error){
   next(error);
  }
 });

 app.post('/api/sync/push',async (request,response,next)=>{
  try{
   const changes=Array.isArray(request.body?.changes)?request.body.changes:[];
   const results=[];
   for(const change of changes){
    if(change.type==='save'){
     const runbook=assertValidRunbook(change.runbook);
     const expectedVersion=validateVersion(change.expectedVersion,false);
     results.push(expectedVersion?await store.updateRunbook(runbook.id,runbook,expectedVersion):await store.createRunbook(runbook));
    }else if(change.type==='delete'){
     const id=assertRunbookId(change.id);
     const expectedVersion=validateVersion(change.expectedVersion,false);
     results.push({id,deleted:await store.deleteRunbook(id,expectedVersion)});
    }else{
     throw validationError('Unsupported sync change type');
    }
   }
   response.json({results});
  }catch(error){
   next(error);
  }
 });

 const errorHandler:ErrorRequestHandler=(error,_request,response,_next)=>{
  void _next;
  if(error instanceof ConflictError)return response.status(409).json({error:'conflict',message:error.message});
  if(error instanceof NotFoundError)return response.status(404).json({error:'not_found',message:error.message});
  if(error?.name==='ValidationError')return response.status(400).json({error:'validation_error',message:error.message});
  if(error?.type==='entity.too.large')return response.status(413).json({error:'payload_too_large',message:'Request body is too large.'});
  const message=process.env.NODE_ENV==='production'?'Internal server error.':error?.message??'Internal server error.';
  response.status(500).json({error:'internal_error',message});
 };
 app.use(errorHandler);

 return app;
}
