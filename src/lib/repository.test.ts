import {beforeEach,describe,expect,it,vi} from 'vitest';
import rfid from '../data/rfid.json';
import type {Runbook} from '../types';
import {LocalRunbookRepository,OfflineError,ServerRunbookRepository} from './repository';
import {loadPendingChanges,markServerMigrationDone,saveLibrary} from './storage';

const defaultBooks=[rfid as Runbook];

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
});
