import {render,waitFor} from '@testing-library/react';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import App from './App';

const jsonResponse=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});

beforeEach(()=>{
 localStorage.clear();
 vi.restoreAllMocks();
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
});
