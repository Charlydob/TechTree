import request from 'supertest';
import {describe,expect,it} from 'vitest';
import {createApp} from './app';
import {MemoryRunbookStore} from './memoryStore';
import rfid from '../src/data/rfid.json';
import type {Runbook} from '../src/types';

const password='secret-password';
const sessionSecret='test-session-secret';
const makeApp=()=>createApp({store:new MemoryRunbookStore(),appPassword:password,sessionSecret,secureCookies:false});
const login=(agent:ReturnType<typeof request.agent>)=>agent.post('/api/auth/login').send({password});
const sample=()=>structuredClone(rfid) as Runbook;

describe('TechTree API',()=>{
 it('checks health without authentication',async()=>{
  await request(makeApp()).get('/api/health').expect(200).expect(({body})=>expect(body).toEqual({ok:true,postgres:true}));
 });

 it('requires authentication for runbook writes',async()=>{
  await request(makeApp()).post('/api/runbooks').send({runbook:sample()}).expect(401);
 });

 it('rejects invalid runbook JSON safely',async()=>{
  const agent=request.agent(makeApp());
  await login(agent).expect(200);
  await agent.post('/api/runbooks').send({runbook:{schemaVersion:1}}).expect(400).expect(({body})=>{
   expect(body.error).toBe('validation_error');
  });
 });

 it('creates, updates and deletes a runbook',async()=>{
  const agent=request.agent(makeApp());
  await login(agent).expect(200);
  const created=await agent.post('/api/runbooks').send({runbook:sample()}).expect(201);
  expect(created.body.version).toBe(1);
  const next={...created.body.runbook,title:{es:'RFID actualizado',en:'Updated RFID'}};
  const updated=await agent.put('/api/runbooks/rfid-integration').send({runbook:next,expectedVersion:1}).expect(200);
  expect(updated.body.version).toBe(2);
  await agent.delete('/api/runbooks/rfid-integration?expectedVersion=2').expect(200);
  await agent.get('/api/runbooks/rfid-integration').expect(404);
 });

 it('detects version conflicts',async()=>{
  const agent=request.agent(makeApp());
  await login(agent).expect(200);
  await agent.post('/api/runbooks').send({runbook:sample()}).expect(201);
  const stale={...sample(),description:{es:'Cambio antiguo'}};
  await agent.put('/api/runbooks/rfid-integration').send({runbook:stale,expectedVersion:99}).expect(409).expect(({body})=>{
   expect(body.message).toContain('modified');
  });
 });

 it('stores folders',async()=>{
  const agent=request.agent(makeApp());
  await login(agent).expect(200);
  const folders=[{id:'folder-1',name:'Produccion',createdAt:new Date().toISOString()}];
  await agent.put('/api/folders').send({folders}).expect(200);
  await agent.get('/api/folders').expect(200).expect(({body})=>expect(body.folders).toEqual(folders));
 });

 it('emits SSE events after confirmed writes',async()=>{
  const server=makeApp().listen(0);
  try{
   const address=server.address();
   if(!address||typeof address==='string')throw new Error('Test server did not expose a port');
   const baseUrl=`http://127.0.0.1:${address.port}`;
   const loginResponse=await fetch(`${baseUrl}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
   const cookie=loginResponse.headers.get('set-cookie')??'';
   const events=await fetch(`${baseUrl}/api/events`,{headers:{cookie}});
   const reader=events.body?.getReader();
   if(!reader)throw new Error('SSE response did not expose a reader');
   await reader.read();
   await fetch(`${baseUrl}/api/runbooks`,{method:'POST',headers:{'Content-Type':'application/json',cookie},body:JSON.stringify({runbook:sample()})});
   const eventText=await readUntil(reader,'runbook.created');
   expect(eventText).toContain('event: runbook.created');
   expect(eventText).toContain('"id":"rfid-integration"');
   expect(eventText).toContain('"revision":1');
   await reader.cancel();
  }finally{
   await new Promise<void>(resolve=>server.close(()=>resolve()));
  }
 });
});

async function readUntil(reader:ReadableStreamDefaultReader<Uint8Array>,text:string){
 const decoder=new TextDecoder();
 let buffer='';
 const deadline=Date.now()+2000;
 while(Date.now()<deadline){
  const {value,done}=await reader.read();
  if(done)break;
  buffer+=decoder.decode(value,{stream:true});
  if(buffer.includes(text))return buffer;
 }
 throw new Error(`Timed out waiting for ${text}. Received: ${buffer}`);
}
