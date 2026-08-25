import type {Runbook} from '../types';
import {migrateRunbook} from './runbook';

export function toExportedRunbook(book:Runbook){
 const clean={...book};
 delete clean.serverVersion;
 return clean;
}

export function exportRunbookJson(book:Runbook){
 return JSON.stringify(toExportedRunbook(book),null,2);
}

export function parseRunbookJson(raw:string){
 return migrateRunbook(JSON.parse(raw) as Runbook);
}
