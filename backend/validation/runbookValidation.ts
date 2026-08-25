import {validateRunbook} from '../../src/lib/validation';
import {toExportedRunbook} from '../../src/lib/importExport';
import type {Runbook} from '../../src/types';

export function assertValidRunbook(value:unknown):Runbook{
 const result=validateRunbook(value);
 if(!result.valid){
  const error=new Error(result.errors.join('; ')||'Invalid runbook');
  error.name='ValidationError';
  throw error;
 }
 return toExportedRunbook(value as Runbook) as Runbook;
}

export function assertRunbookId(value:unknown):string{
 if(typeof value!=='string'||!/^[a-z0-9][a-z0-9-]*$/.test(value)){
  const error=new Error('Invalid runbook id');
  error.name='ValidationError';
  throw error;
 }
 return value;
}
